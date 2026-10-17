-- =========================================================================
-- تعديل قيد محاسبي من الشاشة + مزامنة المصدر (Audited Journal Edit)
-- =========================================================================
-- المبدأ المحاسبي: القيد المُرحَّل لا يُحذف ولا يُترك يُعدَّل بصمت. هنا:
--   • كل تعديل يُسجَّل في `accounting_journal_edits` (قبل/بعد + السبب + المنفّذ).
--   • أرصدة الحسابات تُعدَّل **بالفرق** (عكس القديم ثم تطبيق الجديد) داخل معاملة.
--   • القيد يظل متوازناً وإلا رُفض التعديل.
--   • الفترة المقفلة تمنع التعديل (نفس حارس الترحيل).
--   • يُحدَّث **المصدر**: مستند الترحيل (payload + الإجمالي) والسندات المعروفة
--     (cash_receipts / customer_refunds / sales_invoices) عند وجود رابط
--     `payload->>'journalEntryId'`، مع تعليم ما يحتاج مراجعة إن تعذّر الجزم.
-- متكرر بأمان.
-- =========================================================================

CREATE TABLE IF NOT EXISTS accounting_journal_edits (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     VARCHAR(100) NOT NULL,
  journal_id    VARCHAR(200) NOT NULL,
  entry_number  VARCHAR(100),
  reason        TEXT NOT NULL,
  actor         VARCHAR(150),
  version_before INTEGER,
  version_after  INTEGER,
  total_before  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_after   NUMERIC(18, 2) NOT NULL DEFAULT 0,
  before_payload JSONB,
  after_payload  JSONB,
  source_sync    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_edits_journal
  ON accounting_journal_edits (tenant_id, journal_id, created_at DESC);

-- __APPEND__

-- تعديل قيد: يتحقق ثم يطبّق الفرق على الأرصدة ثم يزامن المصدر -----------------
CREATE OR REPLACE FUNCTION fn_update_journal(
  p_tenant text,
  p_actor text,
  p_journal_id text,
  p_date text,
  p_description text,
  p_lines jsonb,
  p_reason text
) RETURNS jsonb AS $$
DECLARE
  v_old        RECORD;
  v_old_lines  jsonb;
  v_line       jsonb;
  v_dr         numeric := 0;
  v_cr         numeric := 0;
  v_old_dr     numeric := 0;
  v_old_cr     numeric := 0;
  v_lock       date;
  v_version    integer;
  v_account_id text;
  v_type       text;
  v_payload    jsonb;
  v_source     jsonb := '[]'::jsonb;
  v_rows       integer;
BEGIN
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'سبب التعديل مطلوب — لا تعديل صامت على قيد مرحّل';
  END IF;

  SELECT * INTO v_old FROM journal_entries
   WHERE tenant_id = p_tenant AND id = p_journal_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'القيد غير موجود أو محذوف: %', p_journal_id;
  END IF;

  IF to_regclass('accounting_period_locks') IS NOT NULL THEN
    SELECT MAX(lock_date) INTO v_lock FROM accounting_period_locks
     WHERE tenant_id = p_tenant AND status = 'locked'
       AND lock_date >= COALESCE(p_date, v_old.entry_date, v_old.date)::date;
    IF v_lock IS NOT NULL THEN
      RAISE EXCEPTION 'الفترة المحاسبية مقفلة حتى % — لا يمكن تعديل القيد', v_lock;
    END IF;
  END IF;

  -- التحقق من السطور الجديدة (توازن + سطر واحد الاتجاه + حساب موجود)
  SELECT COALESCE(SUM(COALESCE((l->>'debit')::numeric, 0)), 0),
         COALESCE(SUM(COALESCE((l->>'credit')::numeric, 0)), 0)
    INTO v_dr, v_cr FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) l;

  IF jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)) < 2 THEN
    RAISE EXCEPTION 'القيد يحتاج سطرين على الأقل';
  END IF;
  IF round(v_dr, 2) <> round(v_cr, 2) OR v_dr = 0 THEN
    RAISE EXCEPTION 'القيد غير متوازن: مدين % / دائن %', v_dr, v_cr;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) l
              WHERE COALESCE((l->>'debit')::numeric, 0) > 0
                AND COALESCE((l->>'credit')::numeric, 0) > 0) THEN
    RAISE EXCEPTION 'السطر لا يكون مديناً ودائناً معاً';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT a.id INTO v_account_id FROM accounts a
     WHERE a.tenant_id = p_tenant AND a.deleted_at IS NULL
       AND (a.id = COALESCE(v_line->>'account_id', v_line->>'accountId')
            OR a.code = COALESCE(v_line->>'account_code', v_line->>'accountCode'))
     LIMIT 1;
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'حساب غير موجود في الدليل: %',
        COALESCE(v_line->>'account_code', v_line->>'accountCode', v_line->>'account_id');
    END IF;
  END LOOP;

  -- عكس أثر السطور القديمة على الأرصدة
  v_old_lines := COALESCE(v_old.payload->'lines', '[]'::jsonb);
  SELECT COALESCE(SUM(COALESCE((l->>'debit')::numeric, 0)), 0),
         COALESCE(SUM(COALESCE((l->>'credit')::numeric, 0)), 0)
    INTO v_old_dr, v_old_cr FROM jsonb_array_elements(v_old_lines) l;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_old_lines) LOOP
    SELECT a.type INTO v_type FROM accounts a
     WHERE a.tenant_id = p_tenant AND a.deleted_at IS NULL
       AND (a.id = COALESCE(v_line->>'account_id', v_line->>'accountId')
            OR a.code = COALESCE(v_line->>'account_code', v_line->>'accountCode'))
     LIMIT 1;
    IF v_type IS NULL THEN CONTINUE; END IF;
    UPDATE accounts a
       SET balance = COALESCE(a.balance, 0) -
           CASE WHEN fn_is_debit_normal(v_type)
                THEN COALESCE((v_line->>'debit')::numeric, 0) - COALESCE((v_line->>'credit')::numeric, 0)
                ELSE COALESCE((v_line->>'credit')::numeric, 0) - COALESCE((v_line->>'debit')::numeric, 0)
           END,
           updated_at = NOW()
     WHERE a.tenant_id = p_tenant AND a.deleted_at IS NULL
       AND (a.id = COALESCE(v_line->>'account_id', v_line->>'accountId')
            OR a.code = COALESCE(v_line->>'account_code', v_line->>'accountCode'));
  END LOOP;

  -- تطبيق أثر السطور الجديدة
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT a.type INTO v_type FROM accounts a
     WHERE a.tenant_id = p_tenant AND a.deleted_at IS NULL
       AND (a.id = COALESCE(v_line->>'account_id', v_line->>'accountId')
            OR a.code = COALESCE(v_line->>'account_code', v_line->>'accountCode'))
     LIMIT 1;
    UPDATE accounts a
       SET balance = COALESCE(a.balance, 0) +
           CASE WHEN fn_is_debit_normal(v_type)
                THEN COALESCE((v_line->>'debit')::numeric, 0) - COALESCE((v_line->>'credit')::numeric, 0)
                ELSE COALESCE((v_line->>'credit')::numeric, 0) - COALESCE((v_line->>'debit')::numeric, 0)
           END,
           updated_at = NOW()
     WHERE a.tenant_id = p_tenant AND a.deleted_at IS NULL
       AND (a.id = COALESCE(v_line->>'account_id', v_line->>'accountId')
            OR a.code = COALESCE(v_line->>'account_code', v_line->>'accountCode'));
  END LOOP;

  -- تحديث القيد نفسه (إصدار جديد + من عدّله)
  v_version := COALESCE(v_old.version, 1) + 1;
  v_payload := jsonb_set(
    jsonb_set(COALESCE(v_old.payload, '{}'::jsonb), '{lines}', p_lines, true),
    '{description}', to_jsonb(COALESCE(p_description, v_old.description)), true
  );
  v_payload := jsonb_set(v_payload, '{updatedBy}', to_jsonb(COALESCE(p_actor, 'ui')), true);
  v_payload := jsonb_set(v_payload, '{editedAt}', to_jsonb(now()::text), true);

  UPDATE journal_entries
     SET payload    = v_payload,
         description = COALESCE(p_description, description),
         entry_date  = COALESCE(p_date, entry_date),
         date        = COALESCE(p_date, date),
         version     = v_version,
         updated_at  = NOW(),
         updated_by  = COALESCE(p_actor, 'ui')
   WHERE tenant_id = p_tenant AND id = p_journal_id;

  -- (أ) مزامنة مستند الترحيل إن كان هو المصدر (الأدق)
  IF to_regclass('accounting_posting_documents') IS NOT NULL THEN
    UPDATE accounting_posting_documents
       SET payload = p_lines,
           total_amount = v_dr,
           updated_at = NOW()
     WHERE tenant_id = p_tenant AND journal_entry_id = p_journal_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_source := v_source || jsonb_build_object('kind', 'posting_document', 'rows', v_rows);
    END IF;
  END IF;

  -- (ب) السندات القديمة المرتبطة عبر payload->>'journalEntryId': مزامنة المبلغ
  IF EXISTS (SELECT 1 FROM cash_receipts r
              WHERE r.tenant_id = p_tenant AND r.payload->>'journalEntryId' = p_journal_id) THEN
    UPDATE cash_receipts r
       SET amount = v_dr,
           payload = jsonb_set(jsonb_set(r.payload, '{amount}', to_jsonb(v_dr), true),
                               '{journalEditedAt}', to_jsonb(now()::text), true),
           updated_at = NOW(), updated_by = COALESCE(p_actor, 'ui')
     WHERE r.tenant_id = p_tenant AND r.payload->>'journalEntryId' = p_journal_id;
    v_source := v_source || jsonb_build_object('kind', 'cash_receipt', 'amount', v_dr);
  END IF;

  IF EXISTS (SELECT 1 FROM customer_refunds r
              WHERE r.tenant_id = p_tenant AND r.payload->>'journalEntryId' = p_journal_id) THEN
    UPDATE customer_refunds r
       SET amount = v_dr,
           payload = jsonb_set(jsonb_set(r.payload, '{amount}', to_jsonb(v_dr), true),
                               '{journalEditedAt}', to_jsonb(now()::text), true),
           updated_at = NOW(), updated_by = COALESCE(p_actor, 'ui')
     WHERE r.tenant_id = p_tenant AND r.payload->>'journalEntryId' = p_journal_id;
    v_source := v_source || jsonb_build_object('kind', 'customer_refund', 'amount', v_dr);
  END IF;

  IF EXISTS (SELECT 1 FROM sales_invoices i
              WHERE i.tenant_id = p_tenant AND i.payload->>'journalEntryId' = p_journal_id) THEN
    UPDATE sales_invoices i
       SET net_amount = v_dr,
           payload = jsonb_set(jsonb_set(i.payload, '{journalEditedAt}', to_jsonb(now()::text), true),
                               '{journalEditedBy}', to_jsonb(COALESCE(p_actor, 'ui')), true),
           updated_at = NOW(), updated_by = COALESCE(p_actor, 'ui')
     WHERE i.tenant_id = p_tenant AND i.payload->>'journalEntryId' = p_journal_id;
    v_source := v_source || jsonb_build_object('kind', 'sales_invoice', 'net_amount', v_dr);
  END IF;

  -- سجل التعديل (قبل/بعد + السبب + المصدر المتزامن)
  INSERT INTO accounting_journal_edits
    (tenant_id, journal_id, entry_number, reason, actor, version_before, version_after,
     total_before, total_after, before_payload, after_payload, source_sync)
  VALUES (p_tenant, p_journal_id, v_old.entry_number, p_reason, COALESCE(p_actor, 'ui'),
          COALESCE(v_old.version, 1), v_version, round(v_old_dr, 2), round(v_dr, 2),
          v_old.payload, v_payload, v_source);

  RETURN jsonb_build_object(
    'journalId', p_journal_id,
    'version', v_version,
    'debit', v_dr,
    'credit', v_cr,
    'sourceSync', v_source
  );
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT ON accounting_journal_edits TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_update_journal(text,text,text,text,text,jsonb,text) TO app_api';
  END IF;
END $$;
