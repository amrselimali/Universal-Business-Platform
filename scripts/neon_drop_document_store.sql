-- ============================================================================
-- إزالة مخزن المستندات نهائياً (تنظيف اختياري)
-- ============================================================================
-- ⚠️⚠️ هذا الملف **يحذف جداول ودوال** — لا يُشغَّل تلقائياً مع باقي الـ Migrations.
--
-- السبب: التطبيق والسيرفر يعتمدان الآن على **الجداول المنمّطة فقط**، ومخزن
-- المستندات (app_records / app_documents) أصبح تكراراً بلا فائدة.
--
-- ✅ تم التحقق قبل الحذف (2026-10-16) من أن كل السجلات الثلاثة في
--    app_records موجودة بالفعل في جداولها المنمّطة:
--      • wh-alex-store   → warehouses ✅
--      • tenant-eg-003   → tenants    ✅
--      • branch-9513     → branches   ✅
--    ونسخة احتياطية كاملة محفوظة في:
--      docs/backups/app_records-backup-2026-10-16.json
--
-- طريقة التشغيل (يدوياً فقط):
--   node scripts/drop-document-store.mjs
-- ============================================================================

BEGIN;

-- 1) الجداول ---------------------------------------------------------------
DROP TABLE IF EXISTS app_documents        CASCADE;
DROP TABLE IF EXISTS app_documents_history CASCADE;
DROP TABLE IF EXISTS app_documents_removed CASCADE;
DROP TABLE IF EXISTS app_records          CASCADE;

-- 2) الدوال القديمة التي كانت تقرأ من مخزن المستندات ---------------------
DROP FUNCTION IF EXISTS fn_login(TEXT);
DROP FUNCTION IF EXISTS fn_upsert_records(VARCHAR, VARCHAR, JSONB, TEXT);
DROP FUNCTION IF EXISTS fn_soft_delete_records(VARCHAR, VARCHAR, JSONB, TEXT);
DROP FUNCTION IF EXISTS fn_changed_records(VARCHAR, VARCHAR, TIMESTAMPTZ);

COMMIT;

-- ============================================================================
-- ✅ تم. المصدر الوحيد للحقيقة الآن: الجداول المنمّطة.
-- ============================================================================