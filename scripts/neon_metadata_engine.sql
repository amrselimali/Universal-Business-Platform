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
