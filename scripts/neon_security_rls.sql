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
