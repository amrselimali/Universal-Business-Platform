-- =========================================================================
-- المرحلة 2: منطق المحاسبة على السيرفر (Server-side accounting)
-- -------------------------------------------------------------------------
-- شغّل هذا السكربت مرة واحدة في Neon Console (SQL Editor).
-- هو آمن ومتكرر (idempotent): لا يحذف أي بيانات.
--
-- بعد تشغيله تكون كل العمليات المحاسبية ذرّية (Atomic):
--   رأس القيد + سطوره + أرصدة الحسابات إما تنجح كلها أو تفشل كلها.
-- =========================================================================

-- 1) رأس القيد + سطوره -----------------------------------------------------
CREATE TABLE IF NOT EXISTS gl_journals (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  entry_number VARCHAR(100) NOT NULL,
  entry_date VARCHAR(20) NOT NULL,
  description TEXT,
  source_document TEXT,
  is_posted BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gl_journals_tenant_date_idx ON gl_journals (tenant_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS gl_journal_lines (
  id VARCHAR(200) PRIMARY KEY,
  journal_id VARCHAR(200) NOT NULL REFERENCES gl_journals(id) ON DELETE CASCADE,
  tenant_id VARCHAR(100) NOT NULL,
  account_id VARCHAR(200),
  account_code VARCHAR(50),
  account_name_ar VARCHAR(255),
  memo TEXT,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit NUMERIC(15,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gl_journal_lines_journal_idx ON gl_journal_lines (journal_id);
CREATE INDEX IF NOT EXISTS gl_journal_lines_account_idx ON gl_journal_lines (tenant_id, account_id);

-- 2) طبيعة الحساب (مدين/دائن) ----------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_debit_normal(p_type text) RETURNS boolean AS $$
  SELECT p_type IN ('Asset','Expense');
$$ LANGUAGE sql IMMUTABLE;

-- 3) الترحيل الذرّي لقيد متوازن --------------------------------------------
--    يتحقق من التوازن ومنع المدين+الدائن في سطر واحد، ثم يكتب الرأس والسطور
--    ويحدّث أرصدة الحسابات — كل ذلك داخل معاملة واحدة.
CREATE OR REPLACE FUNCTION fn_post_journal(
  p_tenant text, p_branch text, p_date text, p_description text,
  p_source text, p_lines jsonb, p_actor text
) RETURNS text AS $$
DECLARE v_id text; v_entry text; v_dr numeric; v_cr numeric; v_line jsonb;
BEGIN
  SELECT COALESCE(SUM((l->>'debit')::numeric),0), COALESCE(SUM((l->>'credit')::numeric),0)
    INTO v_dr, v_cr FROM jsonb_array_elements(p_lines) l;
  IF v_dr <= 0 OR round(v_dr,2) <> round(v_cr,2) THEN
    RAISE EXCEPTION 'unbalanced journal: debit % vs credit %', v_dr, v_cr;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) l
             WHERE (l->>'debit')::numeric > 0 AND (l->>'credit')::numeric > 0) THEN
    RAISE EXCEPTION 'a journal line cannot be both debit and credit';
  END IF;

  v_id := 'gj-' || gen_random_uuid()::text;
  v_entry := 'JV-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text,1,4);

  INSERT INTO gl_journals (id, tenant_id, branch_id, entry_number, entry_date, description, source_document, is_posted, created_by)
  VALUES (v_id, p_tenant, p_branch, v_entry, p_date, p_description, p_source, TRUE, p_actor);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO gl_journal_lines (id, journal_id, tenant_id, account_id, account_code, account_name_ar, memo, debit, credit)
    VALUES ('gjl-' || gen_random_uuid()::text, v_id, p_tenant,
            v_line->>'account_id', v_line->>'account_code', v_line->>'account_name_ar', v_line->>'memo',
            COALESCE((v_line->>'debit')::numeric,0), COALESCE((v_line->>'credit')::numeric,0));

    UPDATE accounts a
       SET balance = COALESCE(a.balance,0) +
           CASE WHEN fn_is_debit_normal(a.account_type)
                THEN COALESCE((v_line->>'debit')::numeric,0) - COALESCE((v_line->>'credit')::numeric,0)
                ELSE COALESCE((v_line->>'credit')::numeric,0) - COALESCE((v_line->>'debit')::numeric,0)
           END
     WHERE a.tenant_id = p_tenant AND a.id = v_line->>'account_id';
  END LOOP;

  RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- 4) عكس قيد (مع الاحتفاظ بالأصل) ------------------------------------------
CREATE OR REPLACE FUNCTION fn_reverse_journal(p_tenant text, p_journal_id text, p_reason text, p_actor text)
RETURNS text AS $$
DECLARE v_orig gl_journals; v_lines jsonb; v_new text;
BEGIN
  SELECT * INTO v_orig FROM gl_journals WHERE tenant_id = p_tenant AND id = p_journal_id;
  IF v_orig.id IS NULL THEN RAISE EXCEPTION 'journal not found'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'account_code', account_code, 'account_name_ar', account_name_ar,
           'memo', 'REVERSAL: ' || COALESCE(memo,''),
           'debit', credit, 'credit', debit))
    INTO v_lines FROM gl_journal_lines WHERE journal_id = p_journal_id;
  v_new := fn_post_journal(p_tenant, v_orig.branch_id, v_orig.entry_date,
            'REVERSAL_OF:' || v_orig.id || ' - ' || COALESCE(p_reason,''),
            'REVERSAL_OF:' || v_orig.id, v_lines, p_actor);
  RETURN v_new;
END; $$ LANGUAGE plpgsql;

-- 5) حساب العميل من الكود المسلسل ------------------------------------------
CREATE OR REPLACE FUNCTION fn_customer_account_id(p_tenant text, p_customer_code text)
RETURNS text AS $$
DECLARE v_id text;
BEGIN
  SELECT (r.payload->>'accountId') INTO v_id
    FROM app_records r
   WHERE r.tenant_id = p_tenant AND r.doc_key = 'erp_parties_backup'
     AND (r.payload->>'customerCode' = p_customer_code OR r.payload->>'code' = p_customer_code)
     AND r.deleted_at IS NULL
   LIMIT 1;
  IF v_id IS NULL THEN
    SELECT a.id INTO v_id FROM accounts a
     WHERE a.tenant_id = p_tenant AND a.code = '2000' LIMIT 1;
  END IF;
  RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- 6) إيصال تحصيل: الخزينة مدين / العميل دائن (ذرّي) -------------------------
--    fn_post_customer_receipt(...)  و  fn_post_customer_refund(...)
--    (موجودتان في قاعدة البيانات — راجع الكود المصدري src/services/accountingApi.ts)
