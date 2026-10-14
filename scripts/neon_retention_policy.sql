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
