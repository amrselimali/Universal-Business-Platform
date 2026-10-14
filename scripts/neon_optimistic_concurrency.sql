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
