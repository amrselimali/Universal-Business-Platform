-- =========================================================================
-- المرحلة 2: منظومة المحاسبة الذرّية الموحّدة (Unified Server-side Accounting)
-- -------------------------------------------------------------------------
-- هذا السكربت يوحّد دفتر اليومية المحاسبي في جدول واحد رسمي: `journal_entries`
-- ويحذف الدفاتر المزدوجة القديمة (gl_journals / gl_journal_lines)،
-- ويوفر دوال الترحيل، العكس، والتحصيل والاسترداد الذرّي في قاعدة البيانات.
--
-- الخصائص:
--   1. دفتر واحد موحّد: `journal_entries` يقرأ ويكتب فيه التطبيق والـ API معاً.
--   2. استخراج البنود بـ SQL: عبر View تحليلي `v_journal_entry_lines`.
--   3. دوال ذرّية كاملة: fn_post_journal, fn_reverse_journal,
--      fn_post_customer_receipt, fn_post_customer_refund.
--   4. قراءة حساب العميل من جدول `parties` الفعلي (لا app_records المحذوف).
-- =========================================================================

-- 1) التأكد من وجود جدول قيود اليومية الموحّد (journal_entries) -----------------
CREATE TABLE IF NOT EXISTS journal_entries (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  entry_number VARCHAR(100),
  entry_date VARCHAR(20),
  date VARCHAR(50),
  description TEXT,
  is_posted BOOLEAN DEFAULT TRUE,
  payload JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(150),
  deleted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء للمزامنة والبحث
CREATE INDEX IF NOT EXISTS journal_entries_tenant_date_idx ON journal_entries (tenant_id, entry_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS journal_entries_sync_idx ON journal_entries (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS journal_entries_keyset_idx ON journal_entries (id) WHERE deleted_at IS NULL;

-- 2) View تحليلي لبنود القيود لتمكين استعلامات ميزان المراجعة وكشوف الحسابات بـ SQL --
CREATE OR REPLACE VIEW v_journal_entry_lines AS
SELECT 
  j.id AS journal_id,
  j.tenant_id,
  j.branch_id,
  j.entry_number,
  COALESCE(j.entry_date, j.date) AS entry_date,
  j.description AS journal_description,
  j.is_posted,
  COALESCE(l.elem->>'id', 'line-' || l.idx) AS line_id,
  (l.elem->>'accountId') AS account_id,
  (l.elem->>'accountCode') AS account_code,
  (l.elem->>'accountNameAr') AS account_name_ar,
  (l.elem->>'memo') AS memo,
  COALESCE((l.elem->>'debit')::numeric, 0) AS debit,
  COALESCE((l.elem->>'credit')::numeric, 0) AS credit,
  j.updated_at
FROM journal_entries j,
LATERAL jsonb_array_elements(COALESCE(j.payload->'lines', '[]'::jsonb)) WITH ORDINALITY AS l(elem, idx)
WHERE j.deleted_at IS NULL;

-- 3) طبيعة الحساب (مدين/دائن) ----------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_debit_normal(p_type text) RETURNS boolean AS $$
  SELECT p_type IN ('Asset', 'Expense', 'أصول', 'مصروفات');
$$ LANGUAGE sql IMMUTABLE;

-- 4) حساب العميل من الكود المسلسل (يقرأ من جدول parties الفعلي) -------------
CREATE OR REPLACE FUNCTION fn_customer_account_id(p_tenant text, p_customer_code text)
RETURNS text AS $$
DECLARE v_id text;
BEGIN
  -- 1) ابحث في جدول parties مباشرة
  SELECT (p.payload->>'accountId') INTO v_id
    FROM parties p
   WHERE p.tenant_id = p_tenant
     AND (
       p.customer_code = p_customer_code
       OR p.payload->>'customerCode' = p_customer_code
       OR p.payload->>'code' = p_customer_code
       OR p.payload->>'systemCode' = p_customer_code
     )
     AND p.deleted_at IS NULL
   LIMIT 1;

  -- 2) احتياطي: حساب العملاء والمدينين التجاريين 1120 أو 2000
  IF v_id IS NULL THEN
    SELECT a.id INTO v_id FROM accounts a
     WHERE a.tenant_id = p_tenant AND a.code = '1120' AND a.deleted_at IS NULL LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT a.id INTO v_id FROM accounts a
     WHERE a.tenant_id = p_tenant AND a.code = '2000' AND a.deleted_at IS NULL LIMIT 1;
  END IF;

  RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- 5) الترحيل الذرّي لقيد متوازن في الدفتر الموحّد journal_entries ----------
CREATE OR REPLACE FUNCTION fn_post_journal(
  p_tenant text, p_branch text, p_date text, p_description text,
  p_source text, p_lines jsonb, p_actor text
) RETURNS text AS $$
DECLARE
  v_id text;
  v_entry text;
  v_dr numeric;
  v_cr numeric;
  v_line jsonb;
  v_payload jsonb;
  v_acc_rec RECORD;
BEGIN
  -- التحقق من توازن القيد
  SELECT COALESCE(SUM((l->>'debit')::numeric), 0), COALESCE(SUM((l->>'credit')::numeric), 0)
    INTO v_dr, v_cr FROM jsonb_array_elements(p_lines) l;

  IF v_dr <= 0 OR round(v_dr, 2) <> round(v_cr, 2) THEN
    RAISE EXCEPTION 'unbalanced journal: debit % vs credit %', v_dr, v_cr;
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) l
             WHERE (l->>'debit')::numeric > 0 AND (l->>'credit')::numeric > 0) THEN
    RAISE EXCEPTION 'a journal line cannot be both debit and credit';
  END IF;

  -- توليد معرّف القيد ورقم القيد
  v_id := 'jv-' || extract(epoch from now())::bigint || '-' || substr(gen_random_uuid()::text, 1, 5);
  v_entry := 'JV-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 4);

  -- بناء الـ payload المتوافق مع الواجهة
  v_payload := jsonb_build_object(
    'id', v_id,
    'tenantId', p_tenant,
    'branchId', p_branch,
    'entryNumber', v_entry,
    'date', p_date,
    'entryDate', p_date,
    'description', p_description,
    'sourceDocument', COALESCE(p_source, 'API'),
    'isPosted', TRUE,
    'lines', p_lines,
    'createdAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedBy', COALESCE(p_actor, 'app')
  );

  -- كتابة القيد مباشرة في journal_entries
  INSERT INTO journal_entries (
    id, tenant_id, branch_id, entry_number, entry_date, date,
    description, is_posted, payload, version, updated_at, updated_by
  ) VALUES (
    v_id, p_tenant, p_branch, v_entry, p_date, p_date,
    p_description, TRUE, v_payload, 1, NOW(), COALESCE(p_actor, 'app')
  )
  ON CONFLICT (id) DO UPDATE SET
    payload = EXCLUDED.payload,
    updated_at = NOW(),
    version = journal_entries.version + 1;

  -- تحديث أرصدة الحسابات
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    UPDATE accounts a
       SET balance = COALESCE(a.balance, 0) +
           CASE WHEN fn_is_debit_normal(a.account_type)
                THEN COALESCE((v_line->>'debit')::numeric, 0) - COALESCE((v_line->>'credit')::numeric, 0)
                ELSE COALESCE((v_line->>'credit')::numeric, 0) - COALESCE((v_line->>'debit')::numeric, 0)
           END,
           updated_at = NOW()
     WHERE a.tenant_id = p_tenant 
       AND (a.id = v_line->>'account_id' OR a.code = v_line->>'account_code');
  END LOOP;

  RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- 6) عكس قيد (مع حفظ القيد الأصلي والقيد العكسي في journal_entries) ---------
CREATE OR REPLACE FUNCTION fn_reverse_journal(
  p_tenant text, p_journal_id text, p_reason text, p_actor text
) RETURNS text AS $$
DECLARE
  v_orig RECORD;
  v_lines jsonb;
  v_new text;
BEGIN
  SELECT * INTO v_orig FROM journal_entries WHERE tenant_id = p_tenant AND id = p_journal_id;
  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'journal not found: %', p_journal_id;
  END IF;

  -- استخراج السطور من payload وعكس المدين والدائن
  SELECT jsonb_agg(jsonb_build_object(
           'accountId', COALESCE(l->>'accountId', l->>'account_id'),
           'account_id', COALESCE(l->>'accountId', l->>'account_id'),
           'accountCode', COALESCE(l->>'accountCode', l->>'account_code'),
           'account_code', COALESCE(l->>'accountCode', l->>'account_code'),
           'accountNameAr', COALESCE(l->>'accountNameAr', l->>'account_name_ar'),
           'account_name_ar', COALESCE(l->>'accountNameAr', l->>'account_name_ar'),
           'memo', 'عكس: ' || COALESCE(l->>'memo', ''),
           'debit', (l->>'credit')::numeric,
           'credit', (l->>'debit')::numeric
         ))
    INTO v_lines
    FROM jsonb_array_elements(COALESCE(v_orig.payload->'lines', '[]'::jsonb)) l;

  IF v_lines IS NULL OR jsonb_array_length(v_lines) < 2 THEN
    RAISE EXCEPTION 'cannot reverse journal without valid lines';
  END IF;

  v_new := fn_post_journal(
    p_tenant,
    v_orig.branch_id,
    COALESCE(v_orig.entry_date, v_orig.date),
    'عكس قيد: ' || COALESCE(v_orig.entry_number, v_orig.id) || ' - ' || COALESCE(p_reason, ''),
    'REVERSAL_OF:' || v_orig.id,
    v_lines,
    p_actor
  );

  RETURN v_new;
END; $$ LANGUAGE plpgsql;

-- 7) إيصال تحصيل عميل ذرّي (Debit: Safe Account / Credit: Customer Account) ----
CREATE OR REPLACE FUNCTION fn_post_customer_receipt(
  p_tenant text,
  p_branch text,
  p_customer_code text,
  p_amount numeric,
  p_date text,
  p_payment_account_id text,
  p_service text,
  p_receipt jsonb,
  p_actor text
) RETURNS jsonb AS $$
DECLARE
  v_cust_acc_id text;
  v_pay_acc RECORD;
  v_cust_acc RECORD;
  v_lines jsonb;
  v_journal_id text;
  v_receipt_id text;
  v_voucher_no text;
  v_final_receipt jsonb;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'receipt amount must be positive';
  END IF;

  -- 1) التحقق من قاعدة الربط المحاسبي (المصدر الحصري للقيود)
  DECLARE
    v_rule_id bigint;
    v_rule_code text;
    v_map_debit text;
    v_map_credit text;
  BEGIN
    SELECT id, code, debit_account_code, credit_account_code
      INTO v_rule_id, v_rule_code, v_map_debit, v_map_credit
      FROM accounting_mapping_rules
     WHERE tenant_id = p_tenant AND transaction_type = 'customer_collection' AND is_active = TRUE
     LIMIT 1;

    -- حساب العميل
    v_cust_acc_id := fn_customer_account_id(p_tenant, p_customer_code);
    IF v_cust_acc_id IS NULL THEN
      RAISE EXCEPTION 'customer account not found for code: %', p_customer_code;
    END IF;

    -- حساب السداد (الخزينة/البنك)
    SELECT id, code, name_ar INTO v_pay_acc FROM accounts
     WHERE tenant_id = p_tenant AND (id = p_payment_account_id OR code = p_payment_account_id OR code = v_map_debit)
     LIMIT 1;

    -- حساب العميل الدائن
    SELECT id, code, name_ar INTO v_cust_acc FROM accounts
     WHERE tenant_id = p_tenant AND (id = v_cust_acc_id OR code = v_map_credit)
     LIMIT 1;

    -- 2) تكوين خطوط القيد المحاسبي
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'accountId', COALESCE(v_pay_acc.id, p_payment_account_id),
        'account_id', COALESCE(v_pay_acc.id, p_payment_account_id),
        'accountCode', COALESCE(v_pay_acc.code, v_map_debit, '1111'),
        'account_code', COALESCE(v_pay_acc.code, v_map_debit, '1111'),
        'accountNameAr', COALESCE(v_pay_acc.name_ar, 'الخزينة الرئيسية'),
        'account_name_ar', COALESCE(v_pay_acc.name_ar, 'الخزينة الرئيسية'),
        'memo', 'سند تحصيل عميل كود ' || p_customer_code || ' - ' || COALESCE(p_service, ''),
        'debit', p_amount,
        'credit', 0
      ),
      jsonb_build_object(
        'accountId', COALESCE(v_cust_acc.id, v_cust_acc_id),
        'account_id', COALESCE(v_cust_acc.id, v_cust_acc_id),
        'accountCode', COALESCE(v_cust_acc.code, v_map_credit, '1120'),
        'account_code', COALESCE(v_cust_acc.code, v_map_credit, '1120'),
        'accountNameAr', COALESCE(v_cust_acc.name_ar, 'العملاء والمدينون التجاريون'),
        'account_name_ar', COALESCE(v_cust_acc.name_ar, 'العملاء والمدينون التجاريون'),
        'memo', 'سند تحصيل عميل كود ' || p_customer_code || ' - ' || COALESCE(p_service, ''),
        'debit', 0,
        'credit', p_amount
      )
    );

    -- 3) ترحيل القيد المحاسبي في journal_entries وتحديث أرصدة الحسابات
    v_journal_id := fn_post_journal(
      p_tenant,
      p_branch,
      p_date,
      'سند تحصيل نقدي/بنكي من العميل كود: ' || p_customer_code,
      'CR-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
      v_lines,
      p_actor
    );

    -- 4) حفظ سند القبض في جدول cash_receipts
    v_receipt_id := COALESCE(p_receipt->>'id', 'cr-' || extract(epoch from now())::bigint || '-' || substr(gen_random_uuid()::text, 1, 5));
    v_voucher_no := COALESCE(p_receipt->>'voucherNumber', p_receipt->>'receiptNumber', 'CR-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'));

    v_final_receipt := p_receipt || jsonb_build_object(
      'id', v_receipt_id,
      'tenantId', p_tenant,
      'branchId', p_branch,
      'voucherNumber', v_voucher_no,
      'receiptDate', p_date,
      'amount', p_amount,
      'journalEntryId', v_journal_id,
      'updatedAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    INSERT INTO cash_receipts (
      id, tenant_id, branch_id, voucher_number, receipt_date, amount, status, payload, version, updated_at
    ) VALUES (
      v_receipt_id, p_tenant, p_branch, v_voucher_no, p_date, p_amount, 'confirmed', v_final_receipt, 1, NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      payload = EXCLUDED.payload,
      amount = EXCLUDED.amount,
      updated_at = NOW();

    -- 5) تخفيض رصيد العميل في جدول parties
    UPDATE parties p
       SET balance = COALESCE(p.balance, 0) - p_amount,
           updated_at = NOW()
     WHERE p.tenant_id = p_tenant
       AND (
         p.customer_code = p_customer_code
         OR p.payload->>'customerCode' = p_customer_code
         OR p.payload->>'code' = p_customer_code
         OR p.payload->>'systemCode' = p_customer_code
       )
       AND p.deleted_at IS NULL;

    -- 6) توثيق في سجل القيود المولَّدة آلياً (للتدقيق وربط القيد بقاعدته الحصرية)
    INSERT INTO accounting_generated_entries (
      tenant_id, rule_id, rule_code, journal_entry_id, entry_number,
      source_screen, source_document, debit_account_code, credit_account_code,
      amount, is_balanced, posted_at
    ) VALUES (
      p_tenant, v_rule_id, COALESCE(v_rule_code, 'RULE-CUSTOMER-COLLECTION'),
      v_journal_id, v_voucher_no, 'شاشة التحصيلات', 'CR-' || v_voucher_no,
      COALESCE(v_pay_acc.code, v_map_debit, '1111'), COALESCE(v_cust_acc.code, v_map_credit, '1120'),
      p_amount, TRUE, NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'receiptId', v_receipt_id,
      'journalId', v_journal_id,
      'customerAccount', v_cust_acc_id,
      'paymentAccount', COALESCE(v_pay_acc.id, p_payment_account_id)
    );
  END;
END; $$ LANGUAGE plpgsql;

-- 8) استرداد مستحقات عميل ذرّي (Debit: Customer Account / Credit: Safe Account) --
CREATE OR REPLACE FUNCTION fn_post_customer_refund(
  p_tenant text,
  p_branch text,
  p_customer_code text,
  p_amount numeric,
  p_units numeric,
  p_date text,
  p_payment_account_id text,
  p_service text,
  p_refund jsonb,
  p_actor text
) RETURNS jsonb AS $$
DECLARE
  v_cust_acc_id text;
  v_pay_acc RECORD;
  v_cust_acc RECORD;
  v_lines jsonb;
  v_journal_id text;
  v_refund_id text;
  v_voucher_no text;
  v_final_refund jsonb;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'refund amount must be positive';
  END IF;

  -- 1) تحديد حساب العميل
  v_cust_acc_id := fn_customer_account_id(p_tenant, p_customer_code);
  IF v_cust_acc_id IS NULL THEN
    RAISE EXCEPTION 'customer account not found for code: %', p_customer_code;
  END IF;

  -- بيانات حساب السداد
  SELECT id, code, name_ar INTO v_pay_acc FROM accounts
   WHERE tenant_id = p_tenant AND (id = p_payment_account_id OR code = p_payment_account_id)
   LIMIT 1;

  -- بيانات حساب العميل
  SELECT id, code, name_ar INTO v_cust_acc FROM accounts
   WHERE tenant_id = p_tenant AND id = v_cust_acc_id
   LIMIT 1;

  -- 2) تكوين خطوط القيد المحاسبي
  -- مدين: حساب العميل
  -- دائن: حساب الخزينة أو وسيلة الصرف
  v_lines := jsonb_build_array(
    jsonb_build_object(
      'accountId', v_cust_acc_id,
      'account_id', v_cust_acc_id,
      'accountCode', COALESCE(v_cust_acc.code, '1120'),
      'account_code', COALESCE(v_cust_acc.code, '1120'),
      'accountNameAr', COALESCE(v_cust_acc.name_ar, 'العملاء والمدينون التجاريون'),
      'account_name_ar', COALESCE(v_cust_acc.name_ar, 'العملاء والمدينون التجاريون'),
      'memo', 'سند استرداد مستحقات عميل كود ' || p_customer_code || ' - ' || COALESCE(p_service, ''),
      'debit', p_amount,
      'credit', 0
    ),
    jsonb_build_object(
      'accountId', COALESCE(v_pay_acc.id, p_payment_account_id),
      'account_id', COALESCE(v_pay_acc.id, p_payment_account_id),
      'accountCode', COALESCE(v_pay_acc.code, '1111'),
      'account_code', COALESCE(v_pay_acc.code, '1111'),
      'accountNameAr', COALESCE(v_pay_acc.name_ar, 'الخزينة الرئيسية'),
      'account_name_ar', COALESCE(v_pay_acc.name_ar, 'الخزينة الرئيسية'),
      'memo', 'سند استرداد مستحقات عميل كود ' || p_customer_code || ' - ' || COALESCE(p_service, ''),
      'debit', 0,
      'credit', p_amount
    )
  );

  -- 3) ترحيل القيد المحاسبي في journal_entries وتحديث أرصدة الحسابات
  v_journal_id := fn_post_journal(
    p_tenant,
    p_branch,
    p_date,
    'سند استرداد مستحقات للعميل كود: ' || p_customer_code,
    'CRF-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
    v_lines,
    p_actor
  );

  -- 4) حفظ سند الاسترداد في جدول customer_refunds
  v_refund_id := COALESCE(p_refund->>'id', 'crf-' || extract(epoch from now())::bigint || '-' || substr(gen_random_uuid()::text, 1, 5));
  v_voucher_no := COALESCE(p_refund->>'voucherNumber', p_refund->>'refundNumber', 'CRF-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'));

  v_final_refund := p_refund || jsonb_build_object(
    'id', v_refund_id,
    'tenantId', p_tenant,
    'branchId', p_branch,
    'voucherNumber', v_voucher_no,
    'refundDate', p_date,
    'amount', p_amount,
    'units', p_units,
    'journalEntryId', v_journal_id,
    'updatedAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  INSERT INTO customer_refunds (
    id, tenant_id, branch_id, voucher_number, refund_date, amount, status, payload, version, updated_at
  ) VALUES (
    v_refund_id, p_tenant, p_branch, v_voucher_no, p_date, p_amount, 'confirmed', v_final_refund, 1, NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    payload = EXCLUDED.payload,
    amount = EXCLUDED.amount,
    updated_at = NOW();

  -- 5) زيادة رصيد العميل (أو إرجاعه لطبيعته) في جدول parties
  UPDATE parties p
     SET balance = COALESCE(p.balance, 0) + p_amount,
         updated_at = NOW()
   WHERE p.tenant_id = p_tenant
     AND (
       p.customer_code = p_customer_code
       OR p.payload->>'customerCode' = p_customer_code
       OR p.payload->>'code' = p_customer_code
       OR p.payload->>'systemCode' = p_customer_code
     )
     AND p.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'refundId', v_refund_id,
    'journalId', v_journal_id,
    'customerAccount', v_cust_acc_id,
    'paymentAccount', COALESCE(v_pay_acc.id, p_payment_account_id)
  );
END; $$ LANGUAGE plpgsql;

-- 9) حذف الدفاتر المزدوجة القديمة والجداول المهجورة نهائياً -------------------
DROP TABLE IF EXISTS gl_journal_lines CASCADE;
DROP TABLE IF EXISTS gl_journals CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

-- 10) منح الصلاحيات لدور التطبيق المحدود app_api -----------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_is_debit_normal(text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_customer_account_id(text, text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_post_journal(text, text, text, text, text, jsonb, text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_reverse_journal(text, text, text, text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_post_customer_receipt(text, text, text, numeric, text, text, text, jsonb, text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_post_customer_refund(text, text, text, numeric, numeric, text, text, text, jsonb, text) TO app_api';
    EXECUTE 'GRANT SELECT ON v_journal_entry_lines TO app_api';
  END IF;
END $$;
