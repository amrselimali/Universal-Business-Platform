-- =========================================================================
-- شاشة ربط العمليات بالحسابات — المصدر الوحيد والحصري للقيود المحاسبية
-- =========================================================================
-- الفكرة:
--   كل قيد محاسبي في النظام يُولَّد من **قاعدة ربط** مسجّلة هنا. لا يوجد أي
--   قيد يدوي، ولا أي حساب مكتوب في الكود.
--
--   مثال: «مبيعات الكاشير» → مدين: نقدية/بنك حسب وسيلة الدفع، دائن: إيرادات.
--   تغيير الحساب = تعديل صف واحد في الشاشة، بلا نشر وبلا مبرمج.
--
-- الأمان: متكرر (Idempotent) ولا يحذف أي بيانات.
-- =========================================================================

-- 1) قواعد الربط ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_mapping_rules (
  id                   BIGSERIAL PRIMARY KEY,
  tenant_id            VARCHAR(100) NOT NULL,
  code                 VARCHAR(100) NOT NULL,   -- RULE-POS-SALE
  name_ar              VARCHAR(255) NOT NULL,
  name_en              VARCHAR(255) NOT NULL,
  transaction_type     VARCHAR(100) NOT NULL,   -- pos_sale / expense / session / supplier_payment / asset_depreciation
  source_screen        VARCHAR(150) NOT NULL,   -- الشاشة التي تُنتج هذا النوع من العمليات
  debit_account_id     VARCHAR(150),
  debit_account_code   VARCHAR(50)  NOT NULL,
  debit_account_name   VARCHAR(255) NOT NULL,
  credit_account_id    VARCHAR(150),
  credit_account_code  VARCHAR(50)  NOT NULL,
  credit_account_name  VARCHAR(255) NOT NULL,
  -- «مصدر حصري»: يمنع إنشاء قيد يدوي لهذا النوع من خارج القاعدة
  is_strict_exclusive  BOOLEAN NOT NULL DEFAULT TRUE,
  -- «ترحيل آلي»: يُرحَّل القيد فوراً بلا تدخل بشري
  auto_post_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  description          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_mapping_rule_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_tenant
  ON accounting_mapping_rules (tenant_id, is_active, transaction_type);

-- 2) سجل القيود المولَّدة آلياً (للتدقيق: أي قاعدة ولّدت أي قيد) -------------
CREATE TABLE IF NOT EXISTS accounting_generated_entries (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         VARCHAR(100) NOT NULL,
  rule_id           BIGINT REFERENCES accounting_mapping_rules(id) ON DELETE SET NULL,
  rule_code         VARCHAR(100),
  journal_entry_id  VARCHAR(150),
  entry_number      VARCHAR(100),
  source_screen     VARCHAR(150),
  source_document   VARCHAR(150),
  debit_account_code  VARCHAR(50),
  credit_account_code VARCHAR(50),
  amount            NUMERIC(18, 4) NOT NULL DEFAULT 0,
  is_balanced       BOOLEAN NOT NULL DEFAULT TRUE,
  posted_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generated_entries_tenant
  ON accounting_generated_entries (tenant_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_entries_doc
  ON accounting_generated_entries (tenant_id, source_document);

-- 3) دالة التحقق من تغطية العمليات ---------------------------------------
--    تُرجع كل نوع عملية **ليس له قاعدة ربط فعّالة** — أي قيد لن يُولَّد له.
--    تُستخدم كفحص رقابي في الشاشة وفي الـ CI.
CREATE OR REPLACE FUNCTION fn_mapping_coverage_gaps(p_tenant_id VARCHAR)
RETURNS TABLE (transaction_type VARCHAR, reason TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.type::VARCHAR,
         'لا توجد قاعدة ربط فعّالة لهذا النوع'::TEXT
    FROM (VALUES
      ('pos_sale'), ('expense'), ('session'), ('supplier_payment'),
      ('asset_depreciation'), ('purchase_receipt'), ('customer_collection'),
      ('payroll'), ('inventory_adjustment'), ('goods_issue')
    ) AS t(type)
   WHERE NOT EXISTS (
     SELECT 1 FROM accounting_mapping_rules r
      WHERE r.tenant_id = p_tenant_id
        AND r.transaction_type = t.type
        AND r.is_active = TRUE
   );
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- تم بنجاح. شغّل neon_accounting_mapping_seed.sql لتعبئة القواعد.
-- =========================================================================
