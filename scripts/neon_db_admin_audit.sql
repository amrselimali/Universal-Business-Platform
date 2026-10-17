-- =========================================================================
-- سجل تدقيق لإدارة قاعدة البيانات من الواجهة (DB Admin Audit)
-- =========================================================================
-- كل عملية كتابة/تغيير هيكلي من شاشة «إدارة قاعدة البيانات» تُسجَّل هنا:
-- من نفّذ، ماذا، على أي جدول، ومتى. لا يُسمح بأي DDL/DML من الواجهة بلا أثر.
-- متكرر بأمان.
-- =========================================================================

CREATE TABLE IF NOT EXISTS db_admin_audit (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   VARCHAR(100) NOT NULL,
  actor       VARCHAR(150),
  action      VARCHAR(40) NOT NULL,   -- insert / update / delete / ddl
  target      TEXT NOT NULL,          -- schema.table[.column]
  statement   TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_db_admin_audit_tenant
  ON db_admin_audit (tenant_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT ON db_admin_audit TO app_api';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE db_admin_audit_id_seq TO app_api';
  END IF;
END $$;
