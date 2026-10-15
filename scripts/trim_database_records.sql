-- =========================================================================
-- تنظيف وتصفية سجلات الاختبار في قاعدة البيانات إلى 10 سجلات كحد أقصى لكل جدول
-- =========================================================================
-- يقوم هذا السكربت بالاحتفاظ بـ 10 سجلات كحد أقصى لكل شاشة/جدول لاختبار النظام
-- وحذف كافة البيانات الزائدة والمكررة مع الحفاظ على تعريفات محرك الشاشات (Metadata).
-- =========================================================================

-- 1) تنظيف جدول المواعيد والحجوزات (appointments) -> إبقاء أحدث 10 سجلات
DELETE FROM appointments 
WHERE id NOT IN (
  SELECT id FROM appointments 
  ORDER BY appointment_date DESC NULLS LAST, id 
  LIMIT 10
);

-- 2) تنظيف جدول العملاء والمرضى والموردين (parties) -> إبقاء 10 سجلات
WITH kept_parties AS (
  (SELECT id FROM parties WHERE party_type = 'Supplier' LIMIT 2)
  UNION
  (SELECT id FROM parties WHERE party_type != 'Supplier' OR party_type IS NULL ORDER BY updated_at DESC, id LIMIT 8)
)
DELETE FROM parties 
WHERE id NOT IN (SELECT id FROM kept_parties);

-- 3) تنظيف جدول قيود اليومية (journal_entries) -> إبقاء أحدث 10 قيود
DELETE FROM journal_entries 
WHERE id NOT IN (
  SELECT id FROM journal_entries 
  ORDER BY updated_at DESC, id 
  LIMIT 10
);

-- 4) تنظيف جدول الأرصدة المخزنية (stock_levels) -> إبقاء 10 سجلات
DELETE FROM stock_levels 
WHERE id NOT IN (
  SELECT id FROM stock_levels 
  ORDER BY id 
  LIMIT 10
);

-- 5) تنظيف دليل الحسابات (accounts) -> إبقاء 10 حسابات رئيسية
WITH kept_accounts AS (
  SELECT DISTINCT ON (code) id 
  FROM accounts 
  WHERE code IN ('1000', '1100', '1111', '1112', '1120', '2000', '2100', '3000', '4000', '5000')
  ORDER BY code, id
  LIMIT 10
)
DELETE FROM accounts 
WHERE id NOT IN (SELECT id FROM kept_accounts);

-- 6) تفريغ أي أحداث أو سجلات مؤقتة إن وُجدت
TRUNCATE TABLE outbox_events;
TRUNCATE TABLE processed_events;
