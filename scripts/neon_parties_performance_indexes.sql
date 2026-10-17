-- =========================================================================
-- فهارس أداء للعملاء/الموردين (Parties performance indexes)
-- =========================================================================
-- الغرض: تسريع البحث والترقيم على جداول تكبر (عشرات الآلاف) قبل تحويل الشاشات
-- إلى قراءة مُرقَّمة من السيرفر.
--
-- آمن ومتكرر: IF NOT EXISTS فقط، ولا يحذف/يعدّل بيانات.
-- ملاحظة: pg_trgm متاح على Neon وPostgreSQL القياسي.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) نطاق المنشأة + السجلات غير المحذوفة (أكثر شرط متكرر)
CREATE INDEX IF NOT EXISTS idx_parties_tenant_live
  ON parties (tenant_id)
  WHERE deleted_at IS NULL;

-- 2) بحث نصي سريع بالاسم والهاتف (ILIKE %...%)
CREATE INDEX IF NOT EXISTS idx_parties_name_trgm
  ON parties USING gin (lower(payload->>'name') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_parties_phone_trgm
  ON parties USING gin ((payload->>'phone') gin_trgm_ops);

-- 3) أكواد العميل/السيستم/الملف (فلترة تطابق تام/shift)
CREATE INDEX IF NOT EXISTS idx_parties_customer_code
  ON parties ((payload->>'customerCode'));

CREATE INDEX IF NOT EXISTS idx_parties_system_code
  ON parties ((payload->>'systemCode'));

CREATE INDEX IF NOT EXISTS idx_parties_file_code
  ON parties ((payload->>'fileCode'));

-- 4) الحالة والأرشفة والنوع (فلاتر الشاشة)
CREATE INDEX IF NOT EXISTS idx_parties_archived
  ON parties ((payload->>'isArchived'));

CREATE INDEX IF NOT EXISTS idx_parties_type
  ON parties ((payload->>'type'));

-- 5) الفرع وتاريخ الإنشاء (للفلترة الزمنية والترتيب)
CREATE INDEX IF NOT EXISTS idx_parties_branch
  ON parties ((payload->>'branchId'));

CREATE INDEX IF NOT EXISTS idx_parties_created_at
  ON parties (((payload->>'createdAt')));
