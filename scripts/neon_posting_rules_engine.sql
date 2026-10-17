-- =========================================================================
-- محرك قواعد الترحيل المحاسبي (Posting Rules Engine) — المصدر الوحيد للتوجيه
-- =========================================================================
-- قبل هذا الملف كان القيد يُبنى من (1) حسابات مخزّنة على المنتج/طريقة الدفع،
-- و(2) أكواد مكتوبة في الكود (1111/1120/4100…)، وشاشة «ربط العمليات بالحسابات»
-- تُخزّن قواعد **لا يقرأها أي كود ترحيل** — أي مصدران أحدهما معطّل.
--
-- هنا:
--   • accounting_posting_rules     : قاعدة لكل (عملية × خلية رقمية × مُحدِّد):
--                                   الاتجاه (مدين/دائن) + الحساب.
--   • accounting_posting_documents : سجل المستندات (منع ازدواج + حالات واضحة)
--                                   ليكون الترحيل بضغطة زر ظاهرة قابلة للإعادة.
--   • accounting_period_locks      : إقفال الفترات كمصدر وحيد تفحصه الداتابيز.
--   • fn_post_document(...)        : يبني القيد من القواعد فقط، يرفض عند نقص
--                                   قاعدة، يمنع الترحيل في فترة مقفلة، ويكتب
--                                   أثراً في accounting_generated_entries.
--
-- متكرر بأمان (Idempotent) ولا يحذف أي بيانات.
-- =========================================================================

-- 1) قواعد الترحيل: خلية رقمية ← اتجاه واحد ← حساب واحد --------------------
CREATE TABLE IF NOT EXISTS accounting_posting_rules (
  id                 BIGSERIAL PRIMARY KEY,
  tenant_id          VARCHAR(100) NOT NULL,
  transaction_type   VARCHAR(100) NOT NULL,
  field_key          VARCHAR(100) NOT NULL,
  selector_key       VARCHAR(100) NOT NULL DEFAULT 'default',
  direction          VARCHAR(10)  NOT NULL CHECK (direction IN ('debit', 'credit')),
  account_code       VARCHAR(50)  NOT NULL,
  account_name       VARCHAR(255) NOT NULL,
  auto_post_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  strict_exclusive   BOOLEAN NOT NULL DEFAULT TRUE,
  version            INTEGER NOT NULL DEFAULT 1,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by         VARCHAR(150),
  CONSTRAINT uq_posting_rule UNIQUE (tenant_id, transaction_type, field_key, selector_key)
);

CREATE INDEX IF NOT EXISTS idx_posting_rules_lookup
  ON accounting_posting_rules (tenant_id, transaction_type, is_active);

-- 2) مستندات الترحيل: منع الازدواج + حالات واضحة ---------------------------
CREATE TABLE IF NOT EXISTS accounting_posting_documents (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         VARCHAR(100) NOT NULL,
  transaction_type  VARCHAR(100) NOT NULL,
  source_screen     VARCHAR(150) NOT NULL,
  source_document   VARCHAR(150) NOT NULL,
  document_date     DATE NOT NULL,
  branch_id         VARCHAR(100),
  total_amount      NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
  journal_entry_id  VARCHAR(150),
  idempotency_key   VARCHAR(200) NOT NULL,
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  payload           JSONB,
  posted_at         TIMESTAMPTZ,
  posted_by         VARCHAR(150),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_posting_document UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_posting_documents_status
  ON accounting_posting_documents (tenant_id, status, document_date DESC);

-- 3) إقفال الفترات: المصدر الوحيد الذي تفحصه الداتابيز ----------------------
CREATE TABLE IF NOT EXISTS accounting_period_locks (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   VARCHAR(100) NOT NULL,
  lock_date   DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'open')),
  reason      TEXT,
  locked_by   VARCHAR(150),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_period_lock UNIQUE (tenant_id, lock_date)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_tenant
  ON accounting_period_locks (tenant_id, status, lock_date DESC);

-- 4) هل التاريخ داخل فترة مقفلة؟ ------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_period_locked(p_tenant text, p_date date)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounting_period_locks
     WHERE tenant_id = p_tenant AND status = 'locked' AND lock_date >= p_date
  );
$$ LANGUAGE sql STABLE;

-- 5) إقفال / فتح فترة (بأزرار من الشاشة) ----------------------------------
CREATE OR REPLACE FUNCTION fn_lock_period(
  p_tenant text, p_date date, p_reason text, p_actor text
) RETURNS void AS $$
BEGIN
  INSERT INTO accounting_period_locks (tenant_id, lock_date, status, reason, locked_by)
  VALUES (p_tenant, p_date, 'locked', NULLIF(p_reason, ''), p_actor)
  ON CONFLICT (tenant_id, lock_date) DO UPDATE SET
    status = 'locked', reason = EXCLUDED.reason,
    locked_by = EXCLUDED.locked_by, updated_at = CURRENT_TIMESTAMP;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_open_period(p_tenant text, p_date date)
RETURNS void AS $$
BEGIN
  UPDATE accounting_period_locks
     SET status = 'open', updated_at = CURRENT_TIMESTAMP
   WHERE tenant_id = p_tenant AND lock_date = p_date;
END; $$ LANGUAGE plpgsql;

-- 6) حل قاعدة الترحيل لخلية واحدة -----------------------------------------
--    غياب قاعدة فعّالة = الترحيل مرفوض (لا يوجد مصدر بديل للحساب).
CREATE OR REPLACE FUNCTION fn_resolve_posting_rule(
  p_tenant text, p_type text, p_field text, p_selector text DEFAULT 'default'
) RETURNS TABLE (
  rule_id BIGINT, rule_code TEXT, direction TEXT,
  account_code TEXT, account_name TEXT
) AS $$
  SELECT r.id,
         (r.transaction_type || '.' || r.field_key || '.' || r.selector_key)::TEXT,
         r.direction::TEXT, r.account_code::TEXT, r.account_name::TEXT
    FROM accounting_posting_rules r
   WHERE r.tenant_id = p_tenant
     AND r.transaction_type = p_type
     AND r.field_key = p_field
     AND r.is_active = TRUE
     AND r.selector_key IN (COALESCE(NULLIF(p_selector, ''), 'default'), 'default')
   ORDER BY (r.selector_key = 'default') ASC
   LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 7) الدالة المركزية: ترحيل مستند من القواعد فقط ---------------------------
--    p_components: [{ field_key, amount, selector?, memo?, optional? }, …]
--
--    ملاحظات تصميمية:
--      • سجل المستند يُنشأ/يُحدَّث **خارج** كتلة المحاولة، حتى لو فشل الترحيل
--        يُسجَّل الفشل بسببه ويظهر في الشاشة لإعادة المحاولة.
--      • كتلة المحاولة (بناء السطور + القيد + التدقيق) داخل BEGIN/EXCEPTION:
--        فشلها يتراجع كاملاً (لا قيد جزئي ولا أرصدة ملوّثة) ويُرجع status=failed.
CREATE OR REPLACE FUNCTION fn_post_document(
  p_tenant text, p_branch text, p_type text, p_screen text, p_document text,
  p_date text, p_description text, p_actor text, p_components jsonb,
  p_idempotency text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_key      text := COALESCE(NULLIF(p_idempotency, ''), p_type || ':' || p_document);
  v_doc      accounting_posting_documents%ROWTYPE;
  v_lines    jsonb := '[]'::jsonb;
  v_audit    jsonb := '[]'::jsonb;
  v_comp     jsonb;
  v_amount   numeric;
  v_dr       numeric := 0;
  v_cr       numeric := 0;
  v_missing  text[] := '{}';
  v_lock     date;
  v_count    integer := 0;
  v_journal  text;
  v_rule_id  bigint;
  v_rule_cd  text;
  v_dir      text;
  v_acc_code text;
  v_acc_name text;
  v_acc_id   text;
BEGIN
  -- (1) سجل المستند: إن كان مُرحَّلاً سابقاً نُعيد نفس القيد (Idempotency)
  SELECT * INTO v_doc FROM accounting_posting_documents
   WHERE tenant_id = p_tenant AND idempotency_key = v_key FOR UPDATE;

  IF v_doc.id IS NOT NULL AND v_doc.status = 'posted' THEN
    RETURN jsonb_build_object('status', 'already_posted',
                              'journalId', v_doc.journal_entry_id, 'documentId', v_doc.id);
  END IF;

  IF v_doc.id IS NULL THEN
    INSERT INTO accounting_posting_documents
      (tenant_id, transaction_type, source_screen, source_document, document_date,
       branch_id, idempotency_key, status, attempts, payload)
    VALUES (p_tenant, p_type, p_screen, p_document, p_date::date,
            p_branch, v_key, 'pending', 1, p_components)
    RETURNING * INTO v_doc;
  ELSE
    UPDATE accounting_posting_documents
       SET status = 'pending', attempts = attempts + 1, payload = p_components,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = v_doc.id RETURNING * INTO v_doc;
  END IF;

  -- (2) محاولة الترحيل (ذرية بالكامل): أي فشل ↦ مستند failed بسببه
  BEGIN
    SELECT MAX(lock_date) INTO v_lock FROM accounting_period_locks
     WHERE tenant_id = p_tenant AND status = 'locked' AND lock_date >= p_date::date;
    IF v_lock IS NOT NULL THEN
      RAISE EXCEPTION 'الفترة المحاسبية مقفلة حتى % — لا يمكن الترحيل في هذا التاريخ', v_lock;
    END IF;

    -- بناء السطور من القواعد فقط
    FOR v_comp IN SELECT * FROM jsonb_array_elements(COALESCE(p_components, '[]'::jsonb)) LOOP
      v_amount := round(COALESCE((v_comp->>'amount')::numeric, 0), 2);
      CONTINUE WHEN v_amount = 0;

      v_rule_id := NULL; v_rule_cd := NULL; v_dir := NULL; v_acc_code := NULL; v_acc_name := NULL;
      SELECT t.rule_id, t.rule_code, t.direction, t.account_code, t.account_name
        INTO v_rule_id, v_rule_cd, v_dir, v_acc_code, v_acc_name
        FROM fn_resolve_posting_rule(
          p_tenant, p_type, v_comp->>'field_key', COALESCE(v_comp->>'selector', 'default')) t;

      IF v_acc_code IS NULL THEN
        IF COALESCE((v_comp->>'optional')::boolean, false) THEN CONTINUE; END IF;
        v_missing := v_missing || (v_comp->>'field_key')::text;
        CONTINUE;
      END IF;

      SELECT a.id INTO v_acc_id FROM accounts a
       WHERE a.tenant_id = p_tenant AND a.code = v_acc_code AND a.deleted_at IS NULL
       LIMIT 1;

      IF v_acc_id IS NULL THEN
        RAISE EXCEPTION 'قاعدة الترحيل % تشير لحساب غير موجود في الدليل: %', v_rule_cd, v_acc_code;
      END IF;

      IF v_dir = 'debit' THEN v_dr := v_dr + v_amount;
      ELSE v_cr := v_cr + v_amount; END IF;

      v_lines := v_lines || jsonb_build_object(
        'account_id', v_acc_id, 'account_code', v_acc_code, 'account_name_ar', v_acc_name,
        'memo', COALESCE(v_comp->>'memo', p_description),
        'debit', CASE WHEN v_dir = 'debit' THEN v_amount ELSE 0 END,
        'credit', CASE WHEN v_dir = 'credit' THEN v_amount ELSE 0 END);

      v_audit := v_audit || jsonb_build_object(
        'rule_id', v_rule_id, 'rule_code', v_rule_cd,
        'account_code', v_acc_code, 'direction', v_dir, 'amount', v_amount);

      v_count := v_count + 1;
    END LOOP;

    -- لا ترحيل بلا قاعدة: القواعد هي المصدر الوحيد للحساب
    IF array_length(v_missing, 1) > 0 THEN
      RAISE EXCEPTION 'لا توجد قاعدة ترحيل فعّالة للخلايا: % — افتح شاشة ربط العمليات بالقيود',
        array_to_string(v_missing, ', ');
    END IF;

    IF v_count = 0 OR v_dr = 0 OR round(v_dr, 2) <> round(v_cr, 2) THEN
      RAISE EXCEPTION 'القواعد لا تنتج قيداً متوازناً: مدين % / دائن %', v_dr, v_cr;
    END IF;

    -- الترحيل الذري عبر دالة النظام (توازن + أرصدة + منع سطر مدين ودائن معاً)
    v_journal := fn_post_journal(p_tenant, p_branch, p_date, p_description,
                                 p_screen || ':' || p_document, v_lines, p_actor);

    -- أثر تدقيقي: أي قاعدة أنتجت أي سطر
    INSERT INTO accounting_generated_entries
      (tenant_id, rule_code, journal_entry_id, entry_number, source_screen, source_document,
       debit_account_code, credit_account_code, amount, is_balanced)
    SELECT p_tenant, (a->>'rule_code'), v_journal, v_journal, p_screen, p_document,
           CASE WHEN a->>'direction' = 'debit'  THEN a->>'account_code' END,
           CASE WHEN a->>'direction' = 'credit' THEN a->>'account_code' END,
           (a->>'amount')::numeric, TRUE
      FROM jsonb_array_elements(v_audit) a;

    UPDATE accounting_posting_documents
       SET status = 'posted', journal_entry_id = v_journal, total_amount = v_dr,
           posted_at = CURRENT_TIMESTAMP, posted_by = p_actor, last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = v_doc.id;

    RETURN jsonb_build_object('status', 'posted', 'journalId', v_journal,
                              'debit', v_dr, 'credit', v_cr, 'lines', v_count,
                              'documentId', v_doc.id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE accounting_posting_documents
       SET status = 'failed', last_error = SQLERRM, updated_at = CURRENT_TIMESTAMP
     WHERE id = v_doc.id;
    RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM, 'documentId', v_doc.id);
  END;
END; $$ LANGUAGE plpgsql;
-- 8) الصلاحيات (إن كان دور التطبيق موجوداً) -------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON accounting_posting_rules TO app_api';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON accounting_posting_documents TO app_api';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON accounting_period_locks TO app_api';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE accounting_posting_rules_id_seq TO app_api';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE accounting_posting_documents_id_seq TO app_api';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE accounting_period_locks_id_seq TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_post_document(text,text,text,text,text,text,text,text,jsonb,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_resolve_posting_rule(text,text,text,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_is_period_locked(text,date) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_lock_period(text,date,text,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_open_period(text,date) TO app_api';
  END IF;
END $$;



