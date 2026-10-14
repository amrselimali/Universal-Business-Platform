-- ============================================================================
-- Universal Business Platform — الهيكل الكامل (بدون أي بيانات مستخدم)
-- ============================================================================
--
-- هذا ملف واحد يبني قاعدة بيانات كاملة من الصفر:
--   • كل الجداول والفهارس والدوال والـ Triggers وسياسات الأمان (RLS)
--   • التعريفات فقط (شاشات، أفعال، عملات، سياسات تنظيف)
--   • لا يحتوي أي بيانات مستخدم (لا عملاء، لا فواتير، لا قيود)
--
-- ✅ آمن تماماً: كل الأوامر متكررة (Idempotent) — تشغيله مرتين لا يضر،
--    ولا يحذف أي بيانات موجودة مسبقاً.
--
-- طرق التشغيل:
--   1. Neon Console → SQL Editor → الصق الملف كاملاً → Run
--   2. node scripts/apply-neon-migrations.mjs
--   3. psql "postgresql://..." -f scripts/neon_full_schema.sql
--
-- ⚠️ مولَّد آلياً — لا تُحرّره يدوياً.
--    المصدر: الملفات الفردية في scripts/*.sql
--    التوليد: node scripts/build-full-schema.mjs
-- ============================================================================

-- ============================================================================
-- [المخطط الأساسي + مخزن السجلات app_records]
-- المصدر: scripts/neon_schema_migrations.sql
-- ============================================================================

-- =========================================================================
-- Neon PostgreSQL Live Database Migration Script (Safe & Non-Destructive)
-- هذا السكريبت لتحديث وهيكلة جداول قاعدة البيانات على Neon بأمان تام 100% دون مساس بأي بيانات
-- يمكن نسخه وتشغيله مباشرة داخل Neon Console (SQL Editor)
-- =========================================================================

-- 1. التأكد من وجود الجداول الأساسية (لن يعيد إنشاء الجداول الموجودة ولن يحذف أي داتا)
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'Enterprise',
  currency VARCHAR(10) DEFAULT 'EGP',
  tax_rate NUMERIC(5, 4) DEFAULT 0.1400,
  default_pos_collection_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  city VARCHAR(100),
  phone VARCHAR(50),
  is_main BOOLEAN DEFAULT FALSE,
  default_pos_collection_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  code VARCHAR(50) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  location TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  category VARCHAR(100),
  purchase_price NUMERIC(15, 2) DEFAULT 0.00,
  selling_price NUMERIC(15, 2) DEFAULT 0.00,
  min_stock_level NUMERIC(12, 2) DEFAULT 5.00,
  is_service BOOLEAN DEFAULT FALSE,
  default_collection_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_levels (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  warehouse_id VARCHAR(100) NOT NULL,
  quantity_on_hand NUMERIC(15, 3) DEFAULT 0.000
);

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  account_type VARCHAR(50) NOT NULL,
  parent_id VARCHAR(100),
  balance NUMERIC(18, 2) DEFAULT 0.00,
  level INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sales_invoices (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  warehouse_id VARCHAR(100),
  invoice_number VARCHAR(100) NOT NULL,
  customer_id VARCHAR(100),
  customer_name VARCHAR(255),
  subtotal NUMERIC(15, 2) NOT NULL,
  discount_amount NUMERIC(15, 2) DEFAULT 0.00,
  tax_amount NUMERIC(15, 2) DEFAULT 0.00,
  net_amount NUMERIC(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  cashier_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parties (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  type VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(100),
  balance NUMERIC(15, 2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  file_number VARCHAR(50),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  gender VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  patient_id VARCHAR(100),
  patient_name VARCHAR(255),
  doctor_name VARCHAR(255),
  service_name_ar VARCHAR(255),
  price NUMERIC(15, 2) DEFAULT 0.00,
  appointment_date VARCHAR(50),
  appointment_time VARCHAR(50),
  status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  entry_number VARCHAR(100),
  date VARCHAR(50),
  description TEXT,
  is_posted BOOLEAN DEFAULT TRUE
);

-- 2. إضافة الأعمدة الجديدة للأمان (في حال كانت الجداول قد تم إنشاؤها مسبقاً)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_pos_collection_only BOOLEAN DEFAULT FALSE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS default_pos_collection_only BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_collection_only BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS is_collection_only BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_fee_percentage NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_fee_amount NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS total_with_fee NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(100);

-- =========================================================================
-- مخزن السجلات الرئيسي (app_records)
-- =========================================================================
-- ⚠️ هذا الجدول هو **المصدر الوحيد للبيانات** في التطبيق: كل شاشة تقرأ وتكتب
-- منه عبر مفاتيح المستندات (doc_key) والسجلات (record_id).
--
-- كان مفقوداً من كل ملفات الـ Migrations — أي أن إنشاء قاعدة بيانات جديدة من
-- الصفر كان يفشل عند أول كتابة من الواجهة. أُضيف هنا لسدّ هذه الثغرة.
--
-- الفهارس مصمّمة لاستعلامات التطبيق الفعلية:
--   • قراءة مجموعة بيانات كاملة مرتّبة بالمفتاح (Keyset Pagination)
--   • جلب التغييرات منذ مؤشر زمني (المزامنة التزايدية)
-- =========================================================================
CREATE TABLE IF NOT EXISTS app_records (
  tenant_id  VARCHAR(100) NOT NULL,
  doc_key    VARCHAR(100) NOT NULL,
  record_id  VARCHAR(200) NOT NULL,
  payload    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pk_app_records PRIMARY KEY (tenant_id, doc_key, record_id)
);

-- قراءة مجموعة بيانات بترتيب ثابت (يمنع Sort كامل عند عشرات الآلاف من السجلات)
CREATE INDEX IF NOT EXISTS idx_app_records_doc_order
  ON app_records (tenant_id, doc_key, record_id)
  WHERE deleted_at IS NULL;

-- المزامنة التزايدية: "هات كل ما تغيّر بعد هذا الوقت"
CREATE INDEX IF NOT EXISTS idx_app_records_updated
  ON app_records (tenant_id, doc_key, updated_at DESC)
  WHERE deleted_at IS NULL;

-- البحث في السجلات المحذوفة (ناعماً) للتنظيف الدوري
CREATE INDEX IF NOT EXISTS idx_app_records_deleted
  ON app_records (tenant_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- =========================================================================
-- تم بنجاح! هذا الكود آمن تماماً ولا يمس أو يحذف أي بيانات مسجلة.
-- =========================================================================

-- =========================================================================
-- Unified document store: one JSONB row per dataset per tenant.
-- This is what the app's automatic Neon sync writes to, so EVERY dataset
-- (collection receipts, customer refunds, shifts, payroll, ...) is stored in Neon.
-- =========================================================================
CREATE TABLE IF NOT EXISTS app_documents (
  tenant_id  VARCHAR(100) NOT NULL,
  doc_key    VARCHAR(100) NOT NULL,
  payload    JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, doc_key)
);


-- ============================================================================
-- [الأمان: RLS + مستخدم app_api + الفهارس]
-- المصدر: scripts/neon_security_rls.sql
-- ============================================================================

-- =========================================================================
-- الأمان + الأداء (مُطبَّق فعليًا على الإنتاج)
-- شغّله في Neon Console (SQL Editor). آمن ومتكرر ولا يحذف بيانات.
-- =========================================================================

-- 1) فهارس الأداء على (tenant_id) في كل جدول -------------------------------
-- أكبر نقطة أداء في الأنظمة متعددة المستأجرين.
-- (طُبِّق على 39 جدولًا — استخدم الدالة أدناه لتكراره على أي جدول جديد)
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
       AND EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name=tables.table_name
                      AND c.column_name='tenant_id')
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_tenant_idx ON %I (tenant_id)', t, t);
  END LOOP;
END $$;

-- 2) عزل المستأجرين (Row-Level Security) ----------------------------------
-- ملاحظة مهمة: المالك (neondb_owner) يتخطى RLS افتراضيًا ⇒ التطبيق الحالي
-- لا يتأثر. الطبقة تُطبَّق على مستخدم التطبيق المحدود (app_api) في الـ Backend.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
       AND EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name=tables.table_name
                      AND c.column_name='tenant_id')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t);
  END LOOP;
END $$;

-- 3) مستخدم التطبيق المحدود (لا يملك DDL ولا يتخطى RLS) ------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_api') THEN
    CREATE ROLE app_api LOGIN PASSWORD 'CHANGE_ME_ON_DEPLOY';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_api;
-- ⚠️ لا تمنح app_api صلاحيات DDL (CREATE/ALTER/DROP) أبدًا

-- 4) طريقة الاستخدام من الـ Backend (كل طلب) ------------------------------
--   BEGIN;
--   SET LOCAL app.tenant_id = '<tenant من التوكن بعد التحقق>';   ← إلزامي
--   ... العمليات ...
--   COMMIT;
-- بدون تعيين app.tenant_id يرى app_api صفر صفوف (آمن افتراضيًا).


-- ============================================================================
-- [الدوال المحاسبية الذرّية]
-- المصدر: scripts/neon_accounting_functions.sql
-- ============================================================================

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


-- ============================================================================
-- [التزامن المتفاوت: عمود version + Triggers]
-- المصدر: scripts/neon_optimistic_concurrency.sql
-- ============================================================================

-- =========================================================================
-- التزامن المتفائل (Optimistic Concurrency) بعمود version
-- =========================================================================
-- المشكلة التي يحلّها هذا الملف:
--   المزامنة الحالية تقارن `updated_at` كنص. عند تعديل شركة أو فرع من جهازين،
--   قد يفوز السجل الأقدم زمنياً فيرجع الاسم القديم للواجهة (مشكلة موثّقة في
--   PROJECT_STATE.md). المقارنة الزمنية غير موثوقة: ساعات الأجهزة مختلفة،
--   ودقّة التوقيت متفاوتة، وقد يتساوى طابعان زمنيان.
--
-- الحل:
--   عمود `version` رقمي صحيح يزيده Trigger في قاعدة البيانات نفسها عند كل
--   تحديث. المقارنة تصبح: الأكبر رقماً هو الأحدث — قرار قاطع لا لبس فيه.
--
-- الأمان: السكربت متكرر (Idempotent) ولا يحذف أي بيانات إطلاقاً.
-- شغّله في Neon Console (SQL Editor) أو عبر سكربت الـ API.
-- =========================================================================

-- 1) دالة زيادة الإصدار وتحديث وقت التعديل ---------------------------------
CREATE OR REPLACE FUNCTION touch_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  IF to_jsonb(NEW) ? 'updated_at' THEN
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) إضافة عمودي version و updated_at لكل جدول تابع لمنشأة ------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND EXISTS (
             SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name = tables.table_name
                AND c.column_name = 'tenant_id'
           )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1',
      t
    );
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
      t
    );
  END LOOP;
END $$;

-- 3) ربط الـ Trigger بكل جدول (بعد حذف أي نسخة قديمة لضمان التكرار الآمن) ---
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND EXISTS (
             SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name = tables.table_name
                AND c.column_name = 'version'
           )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION touch_row()',
      t, t
    );
  END LOOP;
END $$;

-- 4) توحيد الإصدارات الحالية (أي سجل بإصدار صفر أو سالب يبدأ من 1) ----------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'version'
  LOOP
    EXECUTE format('UPDATE %I SET version = 1 WHERE version IS NULL OR version < 1', t);
  END LOOP;
END $$;

-- =========================================================================
-- تم بنجاح. المزامنة الآن تعتمد على version كمصدر حقيقة واحد.
-- =========================================================================


-- ============================================================================
-- [محرك الشاشات: المخطط]
-- المصدر: scripts/neon_metadata_engine.sql
-- ============================================================================

-- =========================================================================
-- محرك الشاشات (Metadata Engine) — المخطط الأساسي
-- =========================================================================
-- الفكرة: تعريف الشاشات والأزرار وحقول البيانات يصبح **بيانات في قاعدة البيانات**
-- لا كوداً مكتوباً يدوياً في 96 ملفاً. الفائدة:
--   • إضافة حقل أو شاشة لا تحتاج إعادة بناء الواجهة.
--   • الصلاحيات تُدار في مكان واحد ويقرأها السيرفر والعميل من نفس المصدر.
--   • يمكن توليد شاشة جدول كاملة من الـ Metadata بدل كتابتها يدوياً.
--
-- الأمان: السكربت متكرر (Idempotent) ولا يحذف أي بيانات.
-- شغّله ثم شغّل neon_metadata_seed.sql لتعبئة البيانات.
-- =========================================================================

-- 1) الشاشات (Views) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_views (
  id             VARCHAR(100) PRIMARY KEY,
  name_ar        VARCHAR(255) NOT NULL,
  name_en        VARCHAR(255) NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon_name      VARCHAR(100),
  category       VARCHAR(50) NOT NULL DEFAULT 'operations',
  sort_order     INTEGER NOT NULL DEFAULT 10,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) الأفعال (Actions) — كل زر في النظام --------------------------------
CREATE TABLE IF NOT EXISTS erp_actions (
  key            VARCHAR(150) PRIMARY KEY,
  name_ar        VARCHAR(255) NOT NULL,
  name_en        VARCHAR(255) NOT NULL,
  view_id        VARCHAR(100) REFERENCES erp_views(id) ON DELETE CASCADE,
  description_ar TEXT,
  description_en TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 10,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_erp_actions_view ON erp_actions (view_id);

-- 3) الكيانات (Entities) — الجداول التي تُدار عبر الشاشة العامة ----------
CREATE TABLE IF NOT EXISTS erp_entities (
  code             VARCHAR(150) PRIMARY KEY,   -- مثال: parties, products
  table_name       VARCHAR(150) NOT NULL,      -- اسم الجدول الفعلي
  display_name_ar  VARCHAR(255) NOT NULL,
  display_name_en  VARCHAR(255) NOT NULL,
  view_id          VARCHAR(100) REFERENCES erp_views(id) ON DELETE SET NULL,
  soft_delete      BOOLEAN NOT NULL DEFAULT TRUE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4) حقول الكيانات (Entity Fields) — تُولّد منها الواجهة آلياً -----------
CREATE TABLE IF NOT EXISTS erp_entity_fields (
  id            BIGSERIAL PRIMARY KEY,
  entity_code   VARCHAR(150) NOT NULL REFERENCES erp_entities(code) ON DELETE CASCADE,
  column_name   VARCHAR(150) NOT NULL,
  label_ar      VARCHAR(255) NOT NULL,
  label_en      VARCHAR(255) NOT NULL,
  data_type     VARCHAR(50) NOT NULL DEFAULT 'string',
  is_required   BOOLEAN NOT NULL DEFAULT FALSE,
  is_readonly   BOOLEAN NOT NULL DEFAULT FALSE,
  grid_visible  BOOLEAN NOT NULL DEFAULT TRUE,
  form_order    INTEGER NOT NULL DEFAULT 10,
  width         INTEGER NOT NULL DEFAULT 150,
  validation    JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_erp_entity_fields UNIQUE (entity_code, column_name)
);
CREATE INDEX IF NOT EXISTS idx_erp_entity_fields_entity ON erp_entity_fields (entity_code, form_order);

-- 5) الشاشات المولّدة (Screens) ------------------------------------------
CREATE TABLE IF NOT EXISTS erp_screens (
  code        VARCHAR(150) PRIMARY KEY,
  view_id     VARCHAR(100) REFERENCES erp_views(id) ON DELETE SET NULL,
  entity_code VARCHAR(150) REFERENCES erp_entities(code) ON DELETE CASCADE,
  kind        VARCHAR(30) NOT NULL DEFAULT 'grid',
  route       VARCHAR(255) NOT NULL,
  menu_group  VARCHAR(100) NOT NULL DEFAULT 'عام',
  sort_order  INTEGER NOT NULL DEFAULT 10,
  icon        VARCHAR(100) NOT NULL DEFAULT 'Layers',
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- تم بنجاح. شغّل neon_metadata_seed.sql بعد هذا الملف لتعبئة البيانات.
-- (البيانات منفصلة عن المخطط: المخطط هنا ثابت، والبيانات مولَّدة آلياً)
-- =========================================================================


-- ============================================================================
-- [محرك الشاشات: التعريفات (إعدادات، ليست بيانات مستخدم)]
-- المصدر: scripts/neon_metadata_seed.sql
-- ============================================================================

-- =========================================================================
-- بيانات محرك الشاشات (Metadata Engine) — مولَّد آلياً
-- =========================================================================
-- ⚠️ لا تُحرّر هذا الملف يدوياً.
--    المصدر: src/data/permissionsData.ts  (SYSTEM_VIEWS + SYSTEM_ACTIONS)
--    التوليد: npx tsx scripts/generate_metadata_seed.ts
--
-- شغّله بعد neon_metadata_engine.sql
-- =========================================================================

-- 1) الشاشات (22 شاشة) ----------------------------------
INSERT INTO erp_views (id, name_ar, name_en, description_ar, description_en, icon_name, category, sort_order) VALUES
  ('dashboard', 'لوحة التحكم والتحليلات', 'Dashboard & Analytics', 'مؤشرات الأداء الرئيسية والملخصات المالية والرسوم البيانية', 'KPI metrics, financial snapshots, and real-time overview', 'LayoutDashboard', 'core', 10),
  ('reception_ops', 'شاشة التشغيل (الريسيبشن)', 'Reception Operations', 'تسجيل حركات التشغيل اليومية، النبضات، المصروفات، وتسوية الشيفت وطباعة التقرير', 'Daily shift run-sheet, pulses counter, expenses, and shift balancing', 'Activity', 'operations', 20),
  ('bookings', 'إدارة الحجوزات', 'Bookings Management', 'جدول مواعيد المرضى، حجوزات اليوم، اليوم التالي، وقائمة اتصالات المتابعة', 'Patient appointments, today/tomorrow schedule, and follow-up CRM', 'CalendarCheck', 'operations', 30),
  ('pos', 'نقطة البيع السريعة (POS)', 'Fast POS Terminal', 'شاشة الكاشير السريعة لإصدار فواتير المبيعات والباركود', 'Quick cashier register, barcode scan, and instant invoice checkout', 'ShoppingCart', 'operations', 40),
  ('invoices', 'سجل فواتير المبيعات', 'Sales Invoices Log', 'استعراض والبحث في الفواتير المكتملة والإيصالات وحالات الدفع', 'Browse completed sales invoices, receipts, and payment statuses', 'Receipt', 'operations', 50),
  ('parties', 'المرضى والعملاء 360', 'Patients & Customers Directory', 'دليل المرضى والعملاء، الأكواد الورقية، الملفات الطبية واستيراد إكسيل', 'Patients and customers master directory with codes, medical records and phone numbers', 'Users', 'operations', 60),
  ('suppliers', 'سجل وإدارة الموردين', 'Suppliers Directory', 'دليل الموردين، حسابات الموردين، الأرصدة المستحقة وكشوف الحسابات', 'Suppliers master directory with payable balances, tax IDs and statements', 'Truck', 'operations', 70),
  ('staff', 'الأطباء والتمريض وفريق العمل', 'Doctors & Staff Directory', 'إدارة الكادر الطبي، الأطباء والاستشاريين والتمريض والمهن', 'Doctors, specialists, nurses, and operational staff directory', 'UserCheck', 'operations', 80),
  ('attendance', 'إدارة الحضور والانصراف والبصمة', 'Staff Attendance & Biometrics', 'تسجيل الحضور اليدوي، الربط بأجهزة البصمة الخارجية، وساعات العمل والتأخير', 'Daily attendance logs, external biometric device sync, working hours and lateness', 'Clock', 'operations', 90),
  ('inventory', 'المخازن والأصناف والخدمات', 'Inventory & Services Catalog', 'إدارة المنتجات والخدمات، متابعة الأرصدة، والتحويلات والتسويات المخزنية', 'Catalog, multi-warehouse stock levels, transfers & adjustments', 'Package', 'operations', 100),
  ('payment_methods', 'طرق الدفع والسداد', 'Payment Methods & Gateways', 'إدارة طرق التحصيل والصرف (كاش، فيزا، إنستاباي، فودافون كاش)', 'Manage payment methods (Cash, Visa, InstaPay, Mobile Wallets)', 'CreditCard', 'operations', 110),
  ('shift_reports', 'تقارير الشيفتات المقفلة', 'Shift Reports & History', 'أرشيف الشيفتات المقفلة مع حركات التشغيل والمصروفات وطباعة التقارير', 'Historical closed shifts archive, detailed run-sheet logs, and printing', 'FileSpreadsheet', 'operations', 120),
  ('accounting', 'الشجرة المحاسبية والقيود', 'Chart of Accounts & GL', 'دليل الحسابات التفاعلي والقيود المحاسبية الآلية واليدوية وميزان المراجعة', 'Interactive chart of accounts, manual journals, and trial balance', 'Calculator', 'core', 130),
  ('audit_trail', 'سجل التعديلات والمحذوفات', 'Audit Trail (Changes & Deletions)', 'التتبع الأمني الدقيق لكافة التعديلات وحذف السجلات وتعديل الأسماء مع التوقيت والمستخدم', 'Security audit trail tracking edits, cancellations, and deletions with timestamps', 'History', 'admin', 140),
  ('activity_logs', 'سجل نشاط المستخدمين', 'User Activity Logs', 'سجل التفاعلات اليومية للمستخدمين والتنقل بين الشاشات والعمليات', 'Comprehensive user interaction and operational event logs', 'ScrollText', 'admin', 150),
  ('clinics', 'العيادات والسجلات الطبية', 'Clinics & Patient Records', 'سجلات المرضى الإلكترونية، المتابعات الطبية والملفات', 'Patient EHR, clinical follow-ups, and history', 'Stethoscope', 'operations', 160),
  ('companies', 'إدارة الشركات والفروع والمخازن', 'Companies, Branches & Warehouses', 'هيكلة المؤسسة، إضافة الفروع والمخازن والتحكم بموديولات كل شركة', 'Multi-tenant hierarchy, branch/warehouse routing and module toggles', 'Building2', 'admin', 170),
  ('users', 'المستخدمين والصلاحيات (RBAC)', 'Users & Permissions', 'تحديد صلاحيات الشاشات، الفروع والمخازن المسموحة، وأزرار التحكم لكل مستخدم', 'Configure user logins, scoped branches, warehouses & in-screen buttons', 'ShieldCheck', 'admin', 180),
  ('modules', 'تخصيص وتفعيل الموديولات', 'Modules Switcher', 'تفعيل أو تعطيل الـ 15 موديول للنظام بحسب نشاط الشركة', 'Enable or disable platform business modules per tenant', 'SlidersHorizontal', 'admin', 190),
  ('metadata_studio', 'استوديو الشاشات والحقول', 'Metadata Studio', 'إدارة تعريف الشاشات والحقول من الواجهة بلا كود: تسميات، ترتيب، أنواع، وإظهار في الشبكة', 'Manage screen and field definitions without code: labels, order, types, grid visibility', 'Boxes', 'admin', 200),
  ('neon', 'قاعدة بيانات Neon PostgreSQL', 'Neon PostgreSQL Database Hub', 'لوحة التحكم والاتصال بالسيرفر السحابي ومزامنة الجداول', 'Cloud database connectivity, sync logs, and schema engine', 'Database', 'admin', 210),
  ('system_manual', 'دليل المستخدم والتوثيق التقني', 'User Manual & Tech Specs', 'الدليل الإرشادي والتوثيق المعماري ومخطط النظام ومسارات العمل', 'Comprehensive user guide, architecture specs, and system blueprints', 'BookOpen', 'admin', 220)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  icon_name = EXCLUDED.icon_name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- 2) الأفعال (44 فعل) ------------------------------------
INSERT INTO erp_actions (key, name_ar, name_en, view_id, description_ar, description_en, sort_order) VALUES
  ('reception_ops.open_shift', 'افتتاح وبدء شيفت جديد', 'Open New Shift', 'reception_ops', 'السماح للموظف بافتتاح وبدء شيفت تشغيل للفرع الحالي', NULL, 10),
  ('reception_ops.close_shift', 'تقفيل وإنهاء الشيفت', 'Close & Finalize Shift', 'reception_ops', 'إغلاق الشيفت وترحيل إجمالي الإيرادات والمصروفات والأرصدة', NULL, 20),
  ('reception_ops.add_run_row', 'إضافة حركة تشغيل جديدة', 'Add Shift Run Row', 'reception_ops', 'تسجيل مريض جديد في جدول التشغيل وحساب النبضات والقيمة المحصلة', NULL, 30),
  ('reception_ops.edit_row', 'تعديل حركات التشغيل واسم المريض', 'Edit Run Row & Patient Name', 'reception_ops', 'تعديل اسم المريض، الخدمة، النبضات، أو طريقة الدفع في الشيفت النشط', NULL, 40),
  ('reception_ops.add_expense', 'تسجيل مصروفات الشيفت', 'Record Shift Expense', 'reception_ops', 'إضافة مصروف نقدي أو بنكي مع توثيق وقت الصرف والبيان', NULL, 50),
  ('reception_ops.adjust_balance', 'تعديل تسوية طرق السداد وعدادات الأجهزة', 'Adjust Balancing & Device Counters', 'reception_ops', 'تسجيل التعديلات والملاحظات على تسوية الخزينة وعدادات الليزر', NULL, 60),
  ('reception_ops.print_shift', 'طباعة تقرير الشيفت', 'Print Shift Report', 'reception_ops', 'طباعة التقرير الشامل لحركات التشغيل والمصروفات وتسوية الخزائن', NULL, 70),
  ('bookings.create_booking', 'حجز موعد جديد', 'Create New Appointment', 'bookings', 'تسجيل حجز موعد جديد لمريض مع البحث والتسجيل الآلي للعميل', NULL, 80),
  ('bookings.edit_booking', 'تعديل بيانات الحجز', 'Edit Appointment', 'bookings', 'تعديل وقت وتاريخ والطبيب المعالج للموعد', NULL, 90),
  ('bookings.cancel_booking', 'إلغاء الموعد وتوثيق السبب', 'Cancel Appointment', 'bookings', 'إلغاء حجز الموعد مع تسجيل سبب الإلغاء في سجل التدقيق', NULL, 100),
  ('bookings.reschedule_booking', 'إعادة جدولة الموعد', 'Reschedule Appointment', 'bookings', 'ترحيل الموعد إلى يوم أو وقت آخر', NULL, 110),
  ('bookings.mark_attendance', 'تأكيد الحضور أو عدم الحضور', 'Mark Attendance / No-show', 'bookings', 'تحديث حالة حضور المريض في شيت اليوم', NULL, 120),
  ('bookings.add_followup', 'تسجيل متابعة مريض هاتفية', 'Add Follow-up Entry', 'bookings', 'إضافة تذكير أو اتصال متابعة جديد مع المريض', NULL, 130),
  ('bookings.manage_staff_schedule', 'تسجيل وتعديل مواعيد دوام الموظفين', 'Manage Staff Work Schedules', 'bookings', 'إضافة وتعديل وحذف أوقات ومواعيد عمل الموظفين في تبويب مواعيد الموظفين', NULL, 140),
  ('pos.checkout', 'إتمام البيع وإصدار الفاتورة', 'Checkout & Issue Invoices', 'pos', 'إمكانية إتمام سلة المشتريات وإصدار الفواتير النقدية والآجلة', NULL, 150),
  ('pos.discount', 'منح خصومات على الفاتورة', 'Apply Cart Discounts', 'pos', 'السماح بإدخال مبالغ خصم إضافية على الفاتورة', NULL, 160),
  ('pos.tax_edit', 'تعديل نسبة الضريبة بالفاتورة', 'Edit Invoice Tax Rate', 'pos', 'إمكانية تغيير نسبة الضريبة عن القيمة الافتراضية (0% أو نسب مخصصة)', NULL, 170),
  ('pos.close_shift', 'تقفيل الشيفت والجرد الأعمى', 'Close Shift & Blind Reconcile', 'pos', 'تقفيل درج النقدية وتسجيل الفروقات النقدية للشيفت', NULL, 180),
  ('pos.print', 'طباعة الإيصالات والفواتير', 'Print Sales Receipts', 'pos', 'إرسال الفاتورة للطابعة الحرارية', NULL, 190),
  ('staff.add_staff', 'إضافة طبيب أو موظف جديد', 'Add Doctor / Staff Member', 'staff', 'تسجيل بيانات طبيب أو ممرض أو موظف جديد في الفرع', NULL, 200),
  ('staff.edit_staff', 'تعديل بيانات الكادر الطبي والإداري', 'Edit Staff Member', 'staff', 'تحديث بيانات التخصص والهاتف والراتب والنسبة', NULL, 210),
  ('staff.delete_staff', 'حذف أو أرشفة الموظف', 'Archive / Delete Staff Member', 'staff', 'أرشفة الموظف أو إيقاف حسابه', NULL, 220),
  ('shift_reports.print', 'طباعة تقرير الشيفت المؤرشف', 'Print Archived Shift Report', 'shift_reports', 'طباعة تقرير تفصيلي لأي شيفت تاريخي مقفل', NULL, 230),
  ('shift_reports.export', 'تصدير تقارير الشيفتات إلى إكسيل', 'Export Shift Reports to Excel', 'shift_reports', 'تصدير جدول الشيفتات وحركات التشغيل لملف Excel', NULL, 240),
  ('inventory.add_item', 'إضافة أصناف وخدمات جديدة', 'Add New Products / Services', 'inventory', 'تسجيل بطاقة صنف جديدة بالباركود وأسعار الشراء والبيع', NULL, 250),
  ('inventory.delete_item', 'حذف الأصناف من النظام', 'Delete Products', 'inventory', 'حذف المنتج نهائياً من قاعدة البيانات', NULL, 260),
  ('inventory.adjust_stock', 'تسوية الجرد المخزني', 'Adjust Stock Quantities', 'inventory', 'تعديل الكميات بالزيادة أو النقصان عند الجرد الفعلي', NULL, 270),
  ('inventory.transfer', 'التحويل بين المخازن', 'Inter-Warehouse Transfers', 'inventory', 'نقل كميات من مخزن إلى مخزن آخر', NULL, 280),
  ('parties.add', 'إضافة عميل أو مريض جديد', 'Add Customer / Patient', 'parties', 'تسجيل بيانات مريض أو جهة تعامل ورصيدها الافتتاحي', NULL, 290),
  ('parties.edit', 'تعديل بيانات العملاء والمرضى', 'Edit Customer / Patient', 'parties', 'تعديل الهاتف أو الكود الورقي أو الاسم وبيانات الملف', NULL, 300),
  ('parties.delete', 'حذف العملاء والمرضى والموردين', 'Delete Party Record', 'parties', 'أرشفة أو حذف طرف التعامل من السجل', NULL, 310),
  ('parties.import', 'استيراد العملاء من ملف Excel', 'Import Parties from Excel', 'parties', 'استيراد وتحديث آلاف العملاء والمرضى دفعة واحدة من ملف إكسيل', NULL, 320),
  ('payment_methods.manage', 'إضافة وتعديل طرق السداد والحسابات المرتبطة', 'Manage Payment Methods & Accounts', 'payment_methods', 'إضافة خزائن أو محافظ إلكترونية وربطها بالشجرة المحاسبية', NULL, 330),
  ('accounting.add_entry', 'إنشاء قيود يومية يدوية', 'Create Manual Journal Entries', 'accounting', 'تسجيل قيود محاسبية مركبة بين الحسابات', NULL, 340),
  ('accounting.add_account', 'إضافة وتعديل شجرة الحسابات', 'Add / Edit Accounts', 'accounting', 'إضافة حساب فرعي أو رئيسي في دليل الحسابات', NULL, 350),
  ('clinics.add_patient', 'إنشاء وتعديل ملف مريض طبي', 'Create & Edit Patient EHR', 'clinics', 'تسجيل ملف طبي ورقم قومي وأمراض مزمنة لمريض', NULL, 360),
  ('clinics.book_appointment', 'حجز المواعيد والكشوفات الطبية', 'Book Clinic Appointments', 'clinics', 'إدراج موعد كشف في جدول الأطباء', NULL, 370),
  ('companies.create', 'إضافة شركات ومؤسسات جديدة', 'Create New Companies', 'companies', 'إنشاء شركة جديدة وتحديد موديولاتها ونسبة ضريبتها', NULL, 380),
  ('companies.edit', 'تعديل موديولات وبيانات الشركات', 'Edit Company & Modules', 'companies', 'تعديل الاسم والبطاقة الضريبية والموديولات المصاحبة', NULL, 390),
  ('branches.manage', 'إضافة وإدارة الفروع', 'Create & Manage Branches', 'companies', 'إضافة فرع جديد للشركة وتحديد مكانه وهاتفه', NULL, 400),
  ('warehouses.manage', 'إضافة وإدارة المخازن', 'Create & Manage Warehouses', 'companies', 'إضافة مخزن تخزين جديد وربطه بالفرع المناسب', NULL, 410),
  ('users.create', 'إنشاء مستخدمين جدد وتخصيص صلاحياتهم', 'Create Users & Set Scopes', 'users', 'إضافة مستخدم جديد وتحديد الشركات والفروع والمخازن والأزرار المتاحة له', NULL, 420),
  ('users.edit', 'تعديل صلاحيات وحسابات المستخدمين', 'Edit User Permissions & Scope', 'users', 'تعديل الشركات أو الفروع أو الأزرار المتاحة لمستخدم حالي', NULL, 430),
  ('users.delete', 'حذف وإلغاء تفعيل المستخدمين', 'Delete or Deactivate Users', 'users', 'إيقاف حساب موظف أو حذفه نهائياً من النظام', NULL, 440)
ON CONFLICT (key) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  view_id = EXCLUDED.view_id,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  sort_order = EXCLUDED.sort_order;

-- تم بنجاح.

-- 3) الكيانات (6 كيان) -------------------------------------
INSERT INTO erp_entities (code, table_name, display_name_ar, display_name_en, view_id) VALUES
  ('parties', 'parties', 'العملاء والموردون', 'Parties', 'parties'),
  ('products', 'products', 'الأصناف والخدمات', 'Products', 'inventory'),
  ('branches', 'branches', 'الفروع', 'Branches', 'companies'),
  ('warehouses', 'warehouses', 'المخازن', 'Warehouses', 'companies'),
  ('payment_methods', 'payment_methods', 'طرق السداد', 'Payment Methods', 'payment_methods'),
  ('accounts', 'accounts', 'دليل الحسابات', 'Chart of Accounts', 'accounting')
ON CONFLICT (code) DO UPDATE SET
  table_name = EXCLUDED.table_name,
  display_name_ar = EXCLUDED.display_name_ar,
  display_name_en = EXCLUDED.display_name_en,
  view_id = EXCLUDED.view_id;

-- 4) حقول الكيانات (32 حقل) --------------------------------
INSERT INTO erp_entity_fields (entity_code, column_name, label_ar, label_en, data_type, is_required, is_readonly, form_order, width) VALUES
  ('parties', 'name', 'الاسم', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('parties', 'name_en', 'الاسم بالإنجليزية', 'Name (EN)', 'string', FALSE, FALSE, 20, 220),
  ('parties', 'type', 'النوع', 'Type', 'badge', TRUE, FALSE, 30, 110),
  ('parties', 'phone', 'الهاتف', 'Phone', 'string', TRUE, FALSE, 40, 140),
  ('parties', 'customerCode', 'كود العميل', 'Customer Code', 'string', FALSE, TRUE, 50, 110),
  ('parties', 'systemCode', 'كود السيستم', 'System Code', 'string', FALSE, TRUE, 60, 120),
  ('parties', 'balance', 'الرصيد', 'Balance', 'currency', FALSE, TRUE, 70, 130),
  ('products', 'nameAr', 'الاسم', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('products', 'nameEn', 'الاسم بالإنجليزية', 'Name (EN)', 'string', FALSE, FALSE, 20, 220),
  ('products', 'sku', 'كود الصنف', 'SKU', 'string', TRUE, FALSE, 30, 130),
  ('products', 'barcode', 'الباركود', 'Barcode', 'string', FALSE, FALSE, 40, 150),
  ('products', 'sellingPrice', 'سعر البيع', 'Selling Price', 'currency', TRUE, FALSE, 50, 120),
  ('products', 'purchasePrice', 'سعر الشراء', 'Purchase Price', 'currency', FALSE, FALSE, 60, 120),
  ('products', 'isActive', 'مُفعّل', 'Active', 'boolean', FALSE, FALSE, 70, 90),
  ('branches', 'name', 'اسم الفرع', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('branches', 'nameEn', 'الاسم بالإنجليزية', 'Name (EN)', 'string', FALSE, FALSE, 20, 220),
  ('branches', 'code', 'كود الفرع', 'Code', 'string', FALSE, FALSE, 30, 120),
  ('branches', 'city', 'المدينة', 'City', 'string', FALSE, FALSE, 40, 150),
  ('branches', 'phone', 'الهاتف', 'Phone', 'string', FALSE, FALSE, 50, 140),
  ('branches', 'isMain', 'الفرع الرئيسي', 'Main Branch', 'boolean', FALSE, TRUE, 60, 110),
  ('warehouses', 'name', 'اسم المخزن', 'Name', 'string', TRUE, FALSE, 10, 240),
  ('warehouses', 'code', 'كود المخزن', 'Code', 'string', FALSE, FALSE, 20, 120),
  ('warehouses', 'location', 'الموقع', 'Location', 'string', FALSE, FALSE, 30, 220),
  ('payment_methods', 'code', 'كود الطريقة', 'Code', 'string', TRUE, FALSE, 10, 130),
  ('payment_methods', 'nameAr', 'الاسم', 'Name', 'string', TRUE, FALSE, 20, 220),
  ('payment_methods', 'type', 'النوع', 'Type', 'badge', TRUE, FALSE, 30, 120),
  ('payment_methods', 'displayOnReceipt', 'يظهر على الإيصال', 'On Receipt', 'boolean', FALSE, FALSE, 40, 130),
  ('accounts', 'code', 'كود الحساب', 'Code', 'string', TRUE, FALSE, 10, 120),
  ('accounts', 'nameAr', 'اسم الحساب', 'Name', 'string', TRUE, FALSE, 20, 240),
  ('accounts', 'type', 'النوع', 'Type', 'badge', TRUE, FALSE, 30, 130),
  ('accounts', 'balance', 'الرصيد', 'Balance', 'currency', FALSE, TRUE, 40, 140),
  ('accounts', 'level', 'المستوى', 'Level', 'number', FALSE, TRUE, 50, 90)
ON CONFLICT (entity_code, column_name) DO UPDATE SET
  label_ar = EXCLUDED.label_ar,
  label_en = EXCLUDED.label_en,
  data_type = EXCLUDED.data_type,
  is_required = EXCLUDED.is_required,
  is_readonly = EXCLUDED.is_readonly,
  form_order = EXCLUDED.form_order,
  width = EXCLUDED.width;

-- 5) الشاشات المولّدة (6 شاشة) --------------------------------
INSERT INTO erp_screens (code, view_id, entity_code, kind, route, menu_group, sort_order, icon) VALUES
  ('parties_grid', 'parties', 'parties', 'grid', '/parties', 'العمليات', 10, 'Users'),
  ('products_grid', 'inventory', 'products', 'grid', '/products', 'العمليات', 20, 'Package'),
  ('branches_grid', 'companies', 'branches', 'grid', '/branches', 'الإدارة', 30, 'Building2'),
  ('warehouses_grid', 'companies', 'warehouses', 'grid', '/warehouses', 'الإدارة', 40, 'Warehouse'),
  ('payment_methods_grid', 'payment_methods', 'payment_methods', 'grid', '/payment-methods', 'العمليات', 50, 'CreditCard'),
  ('accounts_grid', 'accounting', 'accounts', 'grid', '/accounts', 'المحاسبة', 60, 'Calculator')
ON CONFLICT (code) DO UPDATE SET
  view_id = EXCLUDED.view_id,
  entity_code = EXCLUDED.entity_code,
  route = EXCLUDED.route,
  menu_group = EXCLUDED.menu_group,
  sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon;

-- تم بنجاح.


-- ============================================================================
-- [Outbox + التسلسل الرقمي بلا فجوات]
-- المصدر: scripts/neon_phase4_infrastructure.sql
-- ============================================================================

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


-- ============================================================================
-- [المرفقات والعملات و ETA + الفهارس]
-- المصدر: scripts/neon_phase4_missing_tables.sql
-- ============================================================================

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


-- ============================================================================
-- [سياسة تنظيف السجلات المحذوفة ناعماً]
-- المصدر: scripts/neon_retention_policy.sql
-- ============================================================================

-- =========================================================================
-- سياسة تنظيف السجلات المحذوفة ناعماً (Soft-Delete Retention)
-- =========================================================================
-- المشكلة:
--   الحذف في التطبيق **ناعم** دائماً (`deleted_at` بدل `DELETE`)، وهذا صحيح
--   للحفاظ على الأثر الرقابي. لكن بلا سياسة تنظيف، يتراكم الجدول للأبد:
--   كل فاتورة أو حجز محذوف يبقى في القرص ويبطئ الفهارس ويضخّم النسخ الاحتياطي.
--
-- الحل:
--   دالة تنظيف صريحة تُستدعى يدوياً أو من Job مجدول، مع **فترة احتفاظ**
--   قابلة للضبط، وقيود أمان تمنع الحذف العرضي.
--
-- ⚠️ الأمان: الدالة لا تحذف إلا ما مضى على حذفه أكثر من فترة الاحتفاظ،
--    وتعمل داخل معاملة واحدة، وتُرجع تقريراً بعدد ما حُذف.
-- =========================================================================

-- 1) إعدادات الاحتفاظ (قابلة للتعديل بلا تعديل الكود) ----------------------
CREATE TABLE IF NOT EXISTS retention_policies (
  table_name        VARCHAR(150) PRIMARY KEY,
  retention_days    INTEGER NOT NULL DEFAULT 365 CHECK (retention_days > 0),
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at       TIMESTAMPTZ,
  last_deleted_rows INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO retention_policies (table_name, retention_days) VALUES
  ('app_records', 365)
ON CONFLICT (table_name) DO NOTHING;

-- 2) دالة تنظيف جدول واحد -------------------------------------------------
--    تُرجع عدد الصفوف المحذوفة فعلياً.
CREATE OR REPLACE FUNCTION purge_soft_deleted(
  p_table_name    VARCHAR,
  p_retention_days INTEGER DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_days    INTEGER;
  v_deleted BIGINT;
  v_enabled BOOLEAN;
BEGIN
  -- إعدادات الجدول (إن وُجدت)
  SELECT COALESCE(p_retention_days, rp.retention_days), rp.is_enabled
    INTO v_days, v_enabled
    FROM retention_policies rp
   WHERE rp.table_name = p_table_name;

  -- جدول بلا سياسة = لا تنظيف تلقائي (سلوك آمن افتراضي)
  IF v_days IS NULL THEN
    RETURN 0;
  END IF;
  IF v_enabled IS FALSE AND p_retention_days IS NULL THEN
    RETURN 0;
  END IF;

  -- حماية: لا تنظيف لجدول بلا عمود deleted_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = p_table_name
       AND c.column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'الجدول % لا يحتوي على عمود deleted_at', p_table_name;
  END IF;

  -- ملاحظة: لا يمكن استخدام INTO مع DELETE بلا RETURNING،
  -- لذلك ننفّذ ثم نقرأ عدد الصفوف المتأثرة عبر GET DIAGNOSTICS.
  EXECUTE format(
    'DELETE FROM %I WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - ($1 || '' days'')::interval',
    p_table_name
  ) USING v_days;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE retention_policies
     SET last_run_at = NOW(),
         last_deleted_rows = v_deleted,
         updated_at = NOW()
   WHERE table_name = p_table_name;

  RETURN COALESCE(v_deleted, 0);
END;
$$ LANGUAGE plpgsql;

-- 3) دالة تنظيف كل الجداول المُهيّأة ---------------------------------------
--    تُستخدم من Job مجدول (Hangfire / cron / GitHub Action).
CREATE OR REPLACE FUNCTION purge_all_soft_deleted()
RETURNS TABLE (table_name VARCHAR, deleted_rows BIGINT) AS $$
DECLARE
  r RECORD;
  v_deleted BIGINT;
BEGIN
  FOR r IN SELECT rp.table_name FROM retention_policies rp WHERE rp.is_enabled = TRUE
  LOOP
    v_deleted := purge_soft_deleted(r.table_name);
    table_name := r.table_name;
    deleted_rows := v_deleted;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4) معاينة ما سيُحذف بلا حذف فعلي -----------------------------------------
CREATE OR REPLACE FUNCTION preview_purge(
  p_table_name VARCHAR
)
RETURNS TABLE (would_delete BIGINT, oldest_deleted_at TIMESTAMPTZ, retention_days INTEGER) AS $$
DECLARE
  v_days INTEGER;
BEGIN
  SELECT rp.retention_days INTO v_days FROM retention_policies rp WHERE rp.table_name = p_table_name;
  IF v_days IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT count(*), min(deleted_at), %s::int FROM %I
      WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - ($1 || '' days'')::interval',
    v_days, p_table_name
  ) USING v_days;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- الاستخدام:
--   -- معاينة قبل الحذف (آمن تماماً)
--   SELECT * FROM preview_purge('app_records');
--
--   -- تنظيف جدول واحد
--   SELECT purge_soft_deleted('app_records');
--
--   -- تنظيف كل الجداول المُهيّأة
--   SELECT * FROM purge_all_soft_deleted();
-- =========================================================================


-- ============================================================================
-- ✅ انتهى. القاعدة الآن كاملة وجاهزة.
--
-- الخطوة التالية — ربط التطبيق:
--   داخل التطبيق → شاشة «قاعدة بيانات Neon» → أدخل رابط الاتصال → حفظ
--   ثم اضغط «مزامنة» لإنشاء الجداول ومزامنة البيانات.
-- ============================================================================
