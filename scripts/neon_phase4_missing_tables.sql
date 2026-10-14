-- =========================================================================
-- المرحلة 4 (2/3) — الجداول الناقصة والفهارس
-- =========================================================================
-- ثلاثة أشياء كانت ناقصة فعلياً:
--   1. المرفقات (attachments) — لا مكان لتخزين ملفات العقود والصور والفواتير.
--   2. العملات وأسعار الصرف — لا دعم لتعدد العملات.
--   3. مطابقة الفاتورة الإلكترونية (eta_submissions) — لا سجل لمحاولات
--      الإرسال لمنظومة الضرائب المصرية ونتائجها (إلزامي للتدقيق الضريبي).
--
-- مع فهارس Keyset الصحيحة على الجداول الكبيرة.
-- الأمان: متكرر (Idempotent) ولا يحذف أي بيانات.
-- =========================================================================

-- 1) المرفقات --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id            VARCHAR(150) PRIMARY KEY,
  tenant_id     VARCHAR(100) NOT NULL,
  branch_id     VARCHAR(100),
  entity_type   VARCHAR(100) NOT NULL,   -- parties / staff_members / sales_invoices ...
  entity_id     VARCHAR(150) NOT NULL,
  file_name     VARCHAR(500) NOT NULL,
  content_type  VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    BIGINT NOT NULL DEFAULT 0,
  storage_key   VARCHAR(1000) NOT NULL,  -- مسار الملف في التخزين الخارجي
  checksum      VARCHAR(128),            -- لمنع الرفع المكرر
  uploaded_by   VARCHAR(150),
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity
  ON attachments (tenant_id, entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_checksum
  ON attachments (tenant_id, checksum) WHERE checksum IS NOT NULL;

-- 2) العملات وأسعار الصرف --------------------------------------------------
CREATE TABLE IF NOT EXISTS currencies (
  code      VARCHAR(10) PRIMARY KEY,
  name_ar   VARCHAR(100) NOT NULL,
  name_en   VARCHAR(100) NOT NULL,
  symbol    VARCHAR(10),
  decimals  INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO currencies (code, name_ar, name_en, symbol, decimals) VALUES
  ('EGP', 'الجنيه المصري',    'Egyptian Pound', 'ج.م', 2),
  ('USD', 'الدولار الأمريكي', 'US Dollar',      '$',   2),
  ('EUR', 'اليورو',           'Euro',           '€',   2),
  ('SAR', 'الريال السعودي',   'Saudi Riyal',    'ر.س', 2),
  ('AED', 'الدرهم الإماراتي', 'UAE Dirham',     'د.إ', 2)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  symbol = EXCLUDED.symbol,
  decimals = EXCLUDED.decimals;

CREATE TABLE IF NOT EXISTS exchange_rates (
  id            VARCHAR(150) PRIMARY KEY,
  tenant_id     VARCHAR(100) NOT NULL,
  from_currency VARCHAR(10) NOT NULL REFERENCES currencies(code) ON DELETE RESTRICT,
  to_currency   VARCHAR(10) NOT NULL REFERENCES currencies(code) ON DELETE RESTRICT,
  rate          NUMERIC(18, 8) NOT NULL CHECK (rate > 0),
  rate_date     DATE NOT NULL,
  source        VARCHAR(100),   -- البنك المركزي / يدوي
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_exchange_rate UNIQUE (tenant_id, from_currency, to_currency, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates (tenant_id, from_currency, to_currency, rate_date DESC);

-- 3) مطابقة الفاتورة الإلكترونية (ETA) ------------------------------------
CREATE TABLE IF NOT EXISTS eta_submissions (
  id              VARCHAR(150) PRIMARY KEY,
  tenant_id       VARCHAR(100) NOT NULL,
  branch_id       VARCHAR(100),
  document_type   VARCHAR(50) NOT NULL,   -- invoice / credit_note / debit_note / receipt
  document_id     VARCHAR(150) NOT NULL,
  document_number VARCHAR(150),
  eta_uuid        VARCHAR(150),           -- المعرّف الرسمي من مصلحة الضرائب
  eta_long_id     VARCHAR(300),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  response        JSONB,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','submitted','valid','invalid','cancelled','failed')),
  attempts        INTEGER NOT NULL DEFAULT 1,
  last_error      TEXT,
  submitted_at    TIMESTAMPTZ,
  validated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eta_document
  ON eta_submissions (tenant_id, document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_eta_status
  ON eta_submissions (tenant_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_eta_uuid
  ON eta_submissions (eta_uuid) WHERE eta_uuid IS NOT NULL;

-- =========================================================================
-- 4) فهارس Keyset Pagination على الجداول الكبيرة
-- -------------------------------------------------------------------------
-- الاستعلام المعياري في التطبيق:
--     WHERE tenant_id = ? ORDER BY created_at DESC, id DESC
-- وبدون فهرس مركّب يبدأ بـ tenant_id يتحول إلى Seq Scan + Sort كامل.
-- =========================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name=tables.table_name
                      AND c.column_name='tenant_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name=tables.table_name
                      AND c.column_name='created_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name=tables.table_name
                      AND c.column_name='id')
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, created_at DESC, id DESC)',
      t || '_keyset_idx', t
    );
  END LOOP;
END $$;

-- =========================================================================
-- 5) أداة توليد البارتشنات الشهرية (قابلة لإعادة الاستخدام)
-- -------------------------------------------------------------------------
-- تُستخدم عند تحويل أي جدول كبير (مثل سجل التدقيق) إلى جدول مقسّم،
-- فلا تفشل أي عملية بعد نهاية الشهر الحالي.
-- =========================================================================
CREATE OR REPLACE FUNCTION ensure_monthly_partition(
  p_parent_table text,
  p_partition_month date
)
RETURNS text AS $$
DECLARE
  v_start date := date_trunc('month', p_partition_month)::date;
  v_end   date := (date_trunc('month', p_partition_month) + interval '1 month')::date;
  v_name  text := format('%s_%s', p_parent_table, to_char(v_start, 'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L);',
    v_name, p_parent_table, v_start, v_end
  );
  RETURN v_name;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- تم بنجاح.
-- =========================================================================
