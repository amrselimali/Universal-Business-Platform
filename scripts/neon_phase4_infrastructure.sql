-- =========================================================================
-- المرحلة 4 (1/3) — البنية التشغيلية المشتركة
-- =========================================================================
-- يحتوي هذا الملف على ثلاث بنى كانت ناقصة في التطبيق:
--
--   1. صندوق الصادر (Transactional Outbox)
--      أي عملية تعبر أكثر من موديول (بيع ➔ مخزون ➔ قيد محاسبي) تُكتب في
--      نفس معاملة العملية. لو انطفأ السيرفر بعدها بلحظة، لا تُفقد العملية
--      لأن الحدث محفوظ وينتظر المعالجة.
--
--   2. منع تكرار المعالجة (Idempotent Consumer)
--      جدول يمنع تنفيذ نفس الحدث مرتين — حماية أساسية للقيود المالية.
--
--   3. التسلسلات الرقمية بلا فجوات (Gapless Number Sequences)
--      إلزامية لفاتورة الضرائب المصرية (ETA): لا يجوز أن يوجد رقم فاتورة
--      مفقود في السلسلة. تُخصَّص الأرقام داخل معاملة بنفس قفل الصف.
--
-- الأمان: متكرر (Idempotent) ولا يحذف أي بيانات.
-- =========================================================================

-- 1) صندوق الصادر (Outbox) -----------------------------------------------
CREATE TABLE IF NOT EXISTS outbox_events (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       VARCHAR(100) NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type      VARCHAR(150) NOT NULL,
  aggregate_type  VARCHAR(100) NOT NULL,
  aggregate_id    VARCHAR(150) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','IN_FLIGHT','PROCESSED','FAILED','COMPENSATED')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at    TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- فهرس جزئي: يجلب الأحداث الجاهزة فقط، فلا يكبر مع تراكم المعالَج.
CREATE INDEX IF NOT EXISTS idx_outbox_ready
  ON outbox_events (next_attempt_at, id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_type
  ON outbox_events (tenant_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON outbox_events (aggregate_type, aggregate_id);

-- 2) منع تكرار المعالجة ---------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_events (
  consumer     VARCHAR(150) NOT NULL,
  event_id     BIGINT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result       JSONB,
  CONSTRAINT pk_processed_events PRIMARY KEY (consumer, event_id)
);

-- 3) التسلسلات الرقمية بلا فجوات -----------------------------------------
CREATE TABLE IF NOT EXISTS number_sequences (
  tenant_id  VARCHAR(100) NOT NULL,
  doc_type   VARCHAR(50)  NOT NULL,   -- invoice / receipt / tax_invoice / journal ...
  period     VARCHAR(20)  NOT NULL,   -- 2026 أو 2026-10
  prefix     VARCHAR(30)  NOT NULL DEFAULT '',
  next_value BIGINT       NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_number_sequences PRIMARY KEY (tenant_id, doc_type, period, prefix)
);

-- دالة تخصيص رقم بلا فجوات.
-- FOR UPDATE (عبر ON CONFLICT) يقفل الصف داخل المعاملة، فيستحيل أن يحصل
-- مستخدمان على نفس الرقم، ويستحيل أن تُفقد فجوة في السلسلة.
--
-- المنطق: العمود `next_value` يخزّن **الرقم الذي سيُصرَف في هذه الدعوة**.
--   • أول دعوة  : INSERT بقيمة 1 ⇒ تُصرَف 1 ويصبح المخزَّن 1.
--   • الدعوة 2  : ON CONFLICT ⇒ المخزَّن 1+1=2 ⇒ تُصرَف 2.
--   • الدعوة 3  : 3 … وهكذا بلا أي فجوة.
CREATE OR REPLACE FUNCTION fn_next_document_number(
  p_tenant_id VARCHAR,
  p_doc_type  VARCHAR,
  p_period    VARCHAR,
  p_prefix    VARCHAR DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
  v_value BIGINT;
BEGIN
  INSERT INTO number_sequences (tenant_id, doc_type, period, prefix, next_value)
  VALUES (p_tenant_id, p_doc_type, p_period, COALESCE(p_prefix, ''), 1)
  ON CONFLICT (tenant_id, doc_type, period, prefix) DO UPDATE
    SET next_value = number_sequences.next_value + 1,
        updated_at = CURRENT_TIMESTAMP
  RETURNING next_value INTO v_value;

  RETURN COALESCE(p_prefix, '') || v_value::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- تم بنجاح.
-- =========================================================================
