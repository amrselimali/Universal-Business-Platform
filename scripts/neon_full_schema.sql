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
-- مخزن المستندات — أُزيل من المعمارية
-- -------------------------------------------------------------------------
-- كان التطبيق يكتب كل سجل في مكانين: الجدول المنمّط + مخزن مستندات JSONB
-- (app_records ثم app_documents). أُلغيت هذه الازدواجية: **الجداول المنمّطة
-- (neon_typed_tables.sql) هي المصدر الوحيد للحقيقة**.
--
-- لا تُنشئ هذه الجداول هنا. لإزالتها من قاعدة قديمة:
--   node scripts/drop-document-store.mjs --i-have-a-backup
-- =========================================================================


-- ============================================================================
-- [الجداول المنمّطة الكاملة]
-- المصدر: scripts/neon_typed_tables.sql
-- ============================================================================

-- ============================================================================
-- الجداول المنمّطة الكاملة — المصدر الوحيد للحقيقة
-- ============================================================================
-- ⚠️ مولَّد آلياً — لا تُحرّره يدوياً.
--    المصدر: src/services/neonSchema.ts (NEON_SCHEMA_TABLES)
--    التوليد: npx tsx scripts/generate_tables_migration.ts
--
-- الهدف: إنهاء الازدواجية — التطبيق يقرأ ويكتب **الجداول المنمّطة فقط**،
--        ويُلغى الاعتماد على مخزن المستندات (app_records / app_documents).
--
-- كل جدول يحتوي:
--   • الأعمدة المنمّطة (للاستعلام والفهرسة والتقارير)
--   • payload JSONB (السجل كامل — يمنع فقدان أي حقل متشعّب مثل journal lines)
--   • updated_at / deleted_at (للمزامنة التزايدية والحذف الناعم)
--   • updated_by (أثر رقابي)
--
-- متكرر بأمان (Idempotent) — لا يحذف أي بيانات.
-- ============================================================================


-- ── tenants (جدول عام) ── erp_tenants
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(200) PRIMARY KEY,
  code VARCHAR(50),
  name_ar VARCHAR(255),
  name_en VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS tenants_sync_idx ON tenants (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tenants_keyset_idx ON tenants (id) WHERE deleted_at IS NULL;

-- ── users ── erp_users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  name VARCHAR(255),
  username VARCHAR(150),
  user_role VARCHAR(60),
  is_active BOOLEAN,
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS users_sync_idx ON users (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS users_keyset_idx ON users (id) WHERE deleted_at IS NULL;

-- ── branches ── erp_branches
CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  name VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE branches ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS branches_sync_idx ON branches (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS branches_tenant_idx ON branches (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS branches_keyset_idx ON branches (id) WHERE deleted_at IS NULL;

-- ── warehouses ── erp_warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  name VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS warehouses_sync_idx ON warehouses (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouses_tenant_idx ON warehouses (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouses_keyset_idx ON warehouses (id) WHERE deleted_at IS NULL;

-- ── categories ── erp_categories
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS categories_sync_idx ON categories (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS categories_tenant_idx ON categories (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS categories_keyset_idx ON categories (id) WHERE deleted_at IS NULL;

-- ── products ── erp_products
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  sku VARCHAR(100),
  name_ar VARCHAR(255),
  selling_price NUMERIC(15, 2),
  is_service BOOLEAN,
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS products_sync_idx ON products (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_tenant_idx ON products (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_keyset_idx ON products (id) WHERE deleted_at IS NULL;

-- ── stock_movements ── erp_stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  product_id VARCHAR(100),
  warehouse_id VARCHAR(100),
  movement_type VARCHAR(50),
  quantity NUMERIC(15, 3),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS stock_movements_sync_idx ON stock_movements (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS stock_movements_tenant_idx ON stock_movements (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS stock_movements_keyset_idx ON stock_movements (id) WHERE deleted_at IS NULL;

-- ── stock_levels ── erp_stock_levels
CREATE TABLE IF NOT EXISTS stock_levels (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  product_id VARCHAR(100),
  warehouse_id VARCHAR(100),
  quantity_on_hand NUMERIC(15, 3),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS stock_levels_sync_idx ON stock_levels (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS stock_levels_tenant_idx ON stock_levels (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS stock_levels_keyset_idx ON stock_levels (id) WHERE deleted_at IS NULL;

-- ── accounts ── erp_accounts
CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  code VARCHAR(50),
  name_ar VARCHAR(255),
  account_type VARCHAR(40),
  balance NUMERIC(15, 2),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS accounts_sync_idx ON accounts (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS accounts_tenant_idx ON accounts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS accounts_keyset_idx ON accounts (id) WHERE deleted_at IS NULL;

-- ── journal_entries ── erp_journals
CREATE TABLE IF NOT EXISTS journal_entries (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  entry_number VARCHAR(100),
  entry_date VARCHAR(20),
  description TEXT,
  is_posted BOOLEAN,
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS journal_entries_sync_idx ON journal_entries (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS journal_entries_tenant_idx ON journal_entries (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS journal_entries_keyset_idx ON journal_entries (id) WHERE deleted_at IS NULL;

-- ── parties ── erp_parties_backup
CREATE TABLE IF NOT EXISTS parties (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  name VARCHAR(255),
  party_type VARCHAR(40),
  balance NUMERIC(15, 2),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parties ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE parties ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE parties ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE parties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS parties_sync_idx ON parties (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS parties_tenant_idx ON parties (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS parties_keyset_idx ON parties (id) WHERE deleted_at IS NULL;

-- ── sales_invoices ── erp_invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  invoice_number VARCHAR(100),
  net_amount NUMERIC(15, 2),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS sales_invoices_sync_idx ON sales_invoices (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_invoices_tenant_idx ON sales_invoices (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_invoices_keyset_idx ON sales_invoices (id) WHERE deleted_at IS NULL;

-- ── appointments ── erp_appointments
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  patient_name VARCHAR(255),
  appointment_date VARCHAR(20),
  status VARCHAR(50),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS appointments_sync_idx ON appointments (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS appointments_tenant_idx ON appointments (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS appointments_keyset_idx ON appointments (id) WHERE deleted_at IS NULL;

-- ── patient_follow_ups ── erp_patient_followups
CREATE TABLE IF NOT EXISTS patient_follow_ups (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  patient_name VARCHAR(255),
  follow_up_date VARCHAR(20),
  status VARCHAR(50),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS patient_follow_ups_sync_idx ON patient_follow_ups (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_follow_ups_tenant_idx ON patient_follow_ups (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_follow_ups_keyset_idx ON patient_follow_ups (id) WHERE deleted_at IS NULL;

-- ── treatment_plans ── erp_treatment_plans
CREATE TABLE IF NOT EXISTS treatment_plans (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  patient_name VARCHAR(255),
  status VARCHAR(50),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS treatment_plans_sync_idx ON treatment_plans (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS treatment_plans_tenant_idx ON treatment_plans (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS treatment_plans_keyset_idx ON treatment_plans (id) WHERE deleted_at IS NULL;

-- ── cash_receipts ── erp_cash_receipts
CREATE TABLE IF NOT EXISTS cash_receipts (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  voucher_number VARCHAR(100),
  receipt_date VARCHAR(20),
  amount NUMERIC(15, 2),
  status VARCHAR(40),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cash_receipts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS cash_receipts_sync_idx ON cash_receipts (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_receipts_tenant_idx ON cash_receipts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_receipts_keyset_idx ON cash_receipts (id) WHERE deleted_at IS NULL;

-- ── customer_refunds ── erp_customer_refunds
CREATE TABLE IF NOT EXISTS customer_refunds (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  voucher_number VARCHAR(100),
  refund_date VARCHAR(20),
  amount NUMERIC(15, 2),
  status VARCHAR(40),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS customer_refunds_sync_idx ON customer_refunds (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_refunds_tenant_idx ON customer_refunds (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_refunds_keyset_idx ON customer_refunds (id) WHERE deleted_at IS NULL;

-- ── cash_payments ── erp_cash_payments
CREATE TABLE IF NOT EXISTS cash_payments (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  voucher_number VARCHAR(100),
  payment_date VARCHAR(20),
  amount NUMERIC(15, 2),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cash_payments ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS cash_payments_sync_idx ON cash_payments (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_payments_tenant_idx ON cash_payments (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_payments_keyset_idx ON cash_payments (id) WHERE deleted_at IS NULL;

-- ── reception_shifts ── erp_reception_shifts
CREATE TABLE IF NOT EXISTS reception_shifts (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  shift_number VARCHAR(100),
  shift_date VARCHAR(20),
  status VARCHAR(40),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reception_shifts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE reception_shifts ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE reception_shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE reception_shifts ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE reception_shifts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reception_shifts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS reception_shifts_sync_idx ON reception_shifts (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS reception_shifts_tenant_idx ON reception_shifts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS reception_shifts_keyset_idx ON reception_shifts (id) WHERE deleted_at IS NULL;

-- ── pos_shifts ── erp_pos_shifts
CREATE TABLE IF NOT EXISTS pos_shifts (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  status VARCHAR(40),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS pos_shifts_sync_idx ON pos_shifts (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pos_shifts_tenant_idx ON pos_shifts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pos_shifts_keyset_idx ON pos_shifts (id) WHERE deleted_at IS NULL;

-- ── payment_methods ── erp_payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  name_ar VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS payment_methods_sync_idx ON payment_methods (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payment_methods_tenant_idx ON payment_methods (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payment_methods_keyset_idx ON payment_methods (id) WHERE deleted_at IS NULL;

-- ── specialized_tax_invoices ── erp_tax_invoices
CREATE TABLE IF NOT EXISTS specialized_tax_invoices (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  invoice_number VARCHAR(100),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE specialized_tax_invoices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE specialized_tax_invoices ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE specialized_tax_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE specialized_tax_invoices ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE specialized_tax_invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE specialized_tax_invoices ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS specialized_tax_invoices_sync_idx ON specialized_tax_invoices (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS specialized_tax_invoices_tenant_idx ON specialized_tax_invoices (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS specialized_tax_invoices_keyset_idx ON specialized_tax_invoices (id) WHERE deleted_at IS NULL;

-- ── goods_receipts ── erp_goods_receipts
CREATE TABLE IF NOT EXISTS goods_receipts (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  grn_number VARCHAR(100),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS goods_receipts_sync_idx ON goods_receipts (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS goods_receipts_tenant_idx ON goods_receipts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS goods_receipts_keyset_idx ON goods_receipts (id) WHERE deleted_at IS NULL;

-- ── goods_issues ── erp_goods_issues
CREATE TABLE IF NOT EXISTS goods_issues (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  gin_number VARCHAR(100),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE goods_issues ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS goods_issues_sync_idx ON goods_issues (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS goods_issues_tenant_idx ON goods_issues (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS goods_issues_keyset_idx ON goods_issues (id) WHERE deleted_at IS NULL;

-- ── staff_members ── erp_staff_members
CREATE TABLE IF NOT EXISTS staff_members (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  name VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS staff_members_sync_idx ON staff_members (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS staff_members_tenant_idx ON staff_members (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS staff_members_keyset_idx ON staff_members (id) WHERE deleted_at IS NULL;

-- ── payroll_runs ── erp_payroll_runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  month VARCHAR(20),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS payroll_runs_sync_idx ON payroll_runs (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_idx ON payroll_runs (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payroll_runs_keyset_idx ON payroll_runs (id) WHERE deleted_at IS NULL;

-- ── attendance_records ── erp_attendance_records
CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  staff_id VARCHAR(200),
  attendance_date VARCHAR(20),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS attendance_records_sync_idx ON attendance_records (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS attendance_records_tenant_idx ON attendance_records (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS attendance_records_keyset_idx ON attendance_records (id) WHERE deleted_at IS NULL;

-- ── inventory_audits ── erp_inventory_audits
CREATE TABLE IF NOT EXISTS inventory_audits (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  audit_number VARCHAR(100),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS inventory_audits_sync_idx ON inventory_audits (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_audits_tenant_idx ON inventory_audits (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_audits_keyset_idx ON inventory_audits (id) WHERE deleted_at IS NULL;

-- ── device_maintenance ── erp_device_maintenance
CREATE TABLE IF NOT EXISTS device_maintenance (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(255),
  maintenance_date VARCHAR(20),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE device_maintenance ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE device_maintenance ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE device_maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE device_maintenance ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE device_maintenance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE device_maintenance ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS device_maintenance_sync_idx ON device_maintenance (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS device_maintenance_tenant_idx ON device_maintenance (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS device_maintenance_keyset_idx ON device_maintenance (id) WHERE deleted_at IS NULL;

-- ── laser_devices ── clinic_laser_devices
CREATE TABLE IF NOT EXISTS laser_devices (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  branch_id VARCHAR(100),
  name VARCHAR(255),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE laser_devices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE laser_devices ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE laser_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE laser_devices ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE laser_devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE laser_devices ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS laser_devices_sync_idx ON laser_devices (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS laser_devices_tenant_idx ON laser_devices (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS laser_devices_keyset_idx ON laser_devices (id) WHERE deleted_at IS NULL;

-- ── period_locks ── erp_period_locks
CREATE TABLE IF NOT EXISTS period_locks (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  lock_date VARCHAR(20),
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE period_locks ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE period_locks ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE period_locks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE period_locks ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE period_locks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE period_locks ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS period_locks_sync_idx ON period_locks (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS period_locks_tenant_idx ON period_locks (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS period_locks_keyset_idx ON period_locks (id) WHERE deleted_at IS NULL;

-- ── audit_records ── erp_audit_records
CREATE TABLE IF NOT EXISTS audit_records (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE audit_records ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS audit_records_sync_idx ON audit_records (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_records_tenant_idx ON audit_records (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_records_keyset_idx ON audit_records (id) WHERE deleted_at IS NULL;

-- ── activity_logs ── erp_activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS activity_logs_sync_idx ON activity_logs (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS activity_logs_tenant_idx ON activity_logs (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS activity_logs_keyset_idx ON activity_logs (id) WHERE deleted_at IS NULL;

-- ── notifications_history ── erp_notifications_history
CREATE TABLE IF NOT EXISTS notifications_history (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  payload     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(150),
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications_history ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE notifications_history ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE notifications_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE notifications_history ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE notifications_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notifications_history ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS notifications_history_sync_idx ON notifications_history (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_history_tenant_idx ON notifications_history (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_history_keyset_idx ON notifications_history (id) WHERE deleted_at IS NULL;

-- ============================================================================
-- تم بنجاح: 34 جدولاً · 331 عموداً.
--
-- الخطوة التالية: التطبيق يقرأ ويكتب هذه الجداول فقط.
-- ============================================================================


-- ============================================================================
-- [دوال المصادقة]
-- المصدر: scripts/neon_auth_functions.sql
-- ============================================================================

-- =========================================================================
-- دوال المصادقة — تقرأ من الجداول المنمّطة
-- =========================================================================
-- الخلفية:
--   تسجيل الدخول يحدث **قبل** معرفة المنشأة، لذلك لا يوجد سياق لـ RLS
--   (`app.tenant_id`) ولا يمكن قراءة جدول `users` مباشرة من تطبيق العميل.
--
--   الحل: دالة بـ SECURITY DEFINER تُعيد فقط الصفوف المطابقة لاسم المستخدم
--   المطلوب — ولا تكشف أي شيء آخر.
--
-- ⚠️ الأمان:
--   • `SECURITY DEFINER` يمنح الدالة صلاحية القراءة متجاوزةً RLS — لذلك:
--     - `SET search_path` مثبّت (يمنع هجوم تبديل المخطط)
--     - تُعيد حقولاً محدّدة فقط (لا `SELECT *`)
--     - تُرشّح على اسم المستخدم وحده
--   • كلمات المرور تُقارَن في كود التطبيق (لا تُرسَل أو تُقارَن في SQL).
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_authenticate_user(p_username TEXT)
RETURNS TABLE (
  out_tenant_id VARCHAR,
  out_user_id   VARCHAR,
  out_payload   JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.tenant_id::VARCHAR,
         u.id::VARCHAR,
         u.payload
    FROM users u
   WHERE u.username = p_username
     AND u.deleted_at IS NULL
     AND COALESCE(u.is_active, TRUE) = TRUE;
$$;

-- =========================================================================
-- منح التنفيذ: دور التطبيق المحدود فقط (+ المالك).
-- لا يُمنح لدور التقارير للقراءة فقط.
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_authenticate_user(TEXT) TO app_api';
  END IF;
END $$;

-- =========================================================================
-- تنظيف الدالة القديمة (كانت تقرأ من مخزن المستندات app_records)
-- =========================================================================
DROP FUNCTION IF EXISTS fn_login(TEXT);

-- =========================================================================
-- تم بنجاح.
-- =========================================================================


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
-- [ربط العمليات بالحسابات: المخطط]
-- المصدر: scripts/neon_accounting_mapping.sql
-- ============================================================================

-- =========================================================================
-- شاشة ربط العمليات بالحسابات — المصدر الوحيد والحصري للقيود المحاسبية
-- =========================================================================
-- الفكرة:
--   كل قيد محاسبي في النظام يُولَّد من **قاعدة ربط** مسجّلة هنا. لا يوجد أي
--   قيد يدوي، ولا أي حساب مكتوب في الكود.
--
--   مثال: «مبيعات الكاشير» → مدين: نقدية/بنك حسب وسيلة الدفع، دائن: إيرادات.
--   تغيير الحساب = تعديل صف واحد في الشاشة، بلا نشر وبلا مبرمج.
--
-- الأمان: متكرر (Idempotent) ولا يحذف أي بيانات.
-- =========================================================================

-- 1) قواعد الربط ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_mapping_rules (
  id                   BIGSERIAL PRIMARY KEY,
  tenant_id            VARCHAR(100) NOT NULL,
  code                 VARCHAR(100) NOT NULL,   -- RULE-POS-SALE
  name_ar              VARCHAR(255) NOT NULL,
  name_en              VARCHAR(255) NOT NULL,
  transaction_type     VARCHAR(100) NOT NULL,   -- pos_sale / expense / session / supplier_payment / asset_depreciation
  source_screen        VARCHAR(150) NOT NULL,   -- الشاشة التي تُنتج هذا النوع من العمليات
  debit_account_id     VARCHAR(150),
  debit_account_code   VARCHAR(50)  NOT NULL,
  debit_account_name   VARCHAR(255) NOT NULL,
  credit_account_id    VARCHAR(150),
  credit_account_code  VARCHAR(50)  NOT NULL,
  credit_account_name  VARCHAR(255) NOT NULL,
  -- «مصدر حصري»: يمنع إنشاء قيد يدوي لهذا النوع من خارج القاعدة
  is_strict_exclusive  BOOLEAN NOT NULL DEFAULT TRUE,
  -- «ترحيل آلي»: يُرحَّل القيد فوراً بلا تدخل بشري
  auto_post_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  description          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_mapping_rule_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_tenant
  ON accounting_mapping_rules (tenant_id, is_active, transaction_type);

-- 2) سجل القيود المولَّدة آلياً (للتدقيق: أي قاعدة ولّدت أي قيد) -------------
CREATE TABLE IF NOT EXISTS accounting_generated_entries (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         VARCHAR(100) NOT NULL,
  rule_id           BIGINT REFERENCES accounting_mapping_rules(id) ON DELETE SET NULL,
  rule_code         VARCHAR(100),
  journal_entry_id  VARCHAR(150),
  entry_number      VARCHAR(100),
  source_screen     VARCHAR(150),
  source_document   VARCHAR(150),
  debit_account_code  VARCHAR(50),
  credit_account_code VARCHAR(50),
  amount            NUMERIC(18, 4) NOT NULL DEFAULT 0,
  is_balanced       BOOLEAN NOT NULL DEFAULT TRUE,
  posted_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generated_entries_tenant
  ON accounting_generated_entries (tenant_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_entries_doc
  ON accounting_generated_entries (tenant_id, source_document);

-- 3) دالة التحقق من تغطية العمليات ---------------------------------------
--    تُرجع كل نوع عملية **ليس له قاعدة ربط فعّالة** — أي قيد لن يُولَّد له.
--    تُستخدم كفحص رقابي في الشاشة وفي الـ CI.
CREATE OR REPLACE FUNCTION fn_mapping_coverage_gaps(p_tenant_id VARCHAR)
RETURNS TABLE (transaction_type VARCHAR, reason TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.type::VARCHAR,
         'لا توجد قاعدة ربط فعّالة لهذا النوع'::TEXT
    FROM (VALUES
      ('pos_sale'), ('expense'), ('session'), ('supplier_payment'),
      ('asset_depreciation'), ('purchase_receipt'), ('customer_collection'),
      ('payroll'), ('inventory_adjustment'), ('goods_issue')
    ) AS t(type)
   WHERE NOT EXISTS (
     SELECT 1 FROM accounting_mapping_rules r
      WHERE r.tenant_id = p_tenant_id
        AND r.transaction_type = t.type
        AND r.is_active = TRUE
   );
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- تم بنجاح. شغّل neon_accounting_mapping_seed.sql لتعبئة القواعد.
-- =========================================================================


-- ============================================================================
-- [ربط العمليات بالحسابات: القواعد الأساسية]
-- المصدر: scripts/neon_accounting_mapping_seed.sql
-- ============================================================================

-- =========================================================================
-- قواعد ربط العمليات بالحسابات — البيانات الأولية
-- =========================================================================
-- ⚠️ مولَّد يدوياً ليطابق دليل الحسابات الحالي في التطبيق.
--    الحسابات المستخدمة (من src/data/initialData.ts):
--      1111 الخزينة الرئيسية · 1112 البنك الأهلي · 1120 العملاء والمدينون
--      1130 المخزون · 2100 الموردون · 2150 ضريبة القيمة المضافة
--      4100 إيرادات المبيعات · 4200 إيرادات الخدمات والعيادات
--      5100 تكلفة الباعة المباعة · 5200 مصروفات تشغيلية
--      5250 صيانة أجهزة الليزر · 5300 الرواتب والأجور
--
-- التطبيق: شغّله بعد neon_accounting_mapping.sql — متكرر بأمان.
-- =========================================================================

INSERT INTO accounting_mapping_rules (
  tenant_id, code, name_ar, name_en, transaction_type, source_screen,
  debit_account_id, debit_account_code, debit_account_name,
  credit_account_id, credit_account_code, credit_account_name,
  is_strict_exclusive, auto_post_enabled, is_active, description
) VALUES

-- 1) مبيعات الكاشير — نقدي
('tenant-eg-001', 'RULE-POS-CASH', 'مبيعات الكاشير النقدية', 'POS Cash Sales', 'pos_sale', 'شاشة الكاشير (POS)',
 'acc-1111', '1111', 'الخزينة الرئيسية (النقدية بالصندوق)',
 'acc-4100', '4100', 'إيرادات مبيعات الأجهزة والمستلزمات',
 TRUE, TRUE, TRUE,
 'كل إيصال كاشير نقدي يُنشئ قيداً فورياً: نقدية مدين / إيراد مبيعات دائن. لا يُقبل قيد يدوي لهذا النوع.'),

-- 2) مبيعات الكاشير — بطاقة/بنك
('tenant-eg-001', 'RULE-POS-CARD', 'مبيعات الكاشير بالبطاقة والتحويل', 'POS Card Sales', 'pos_sale', 'شاشة الكاشير (POS)',
 'acc-1112', '1112', 'البنك الأهلي المصري (حساب جاري)',
 'acc-4100', '4100', 'إيرادات مبيعات الأجهزة والمستلزمات',
 TRUE, TRUE, TRUE,
 'المبيعات بالبطاقة أو التحويل البنكي تُرحَّل على حساب البنك بدل النقدية.'),

-- 3) جلسات التشغيل اليومية
('tenant-eg-001', 'RULE-SESSION-RUN', 'إيراد جلسة تشغيل يومية', 'Daily Session Revenue', 'session', 'شاشة التشغيل (الريسيبشن)',
 'acc-1111', '1111', 'الخزينة الرئيسية (النقدية بالصندوق)',
 'acc-4200', '4200', 'إيرادات الكشوفات والخدمات والعيادات',
 TRUE, TRUE, TRUE,
 'كل سطر في كشف تشغيل الوردية يولّد قيد إيراد خدمة. تُستخدم 4200 لأن الجلسات خدمات طبية لا بضاعة.'),

-- 4) سندات صرف المصروفات
('tenant-eg-001', 'RULE-EXP-VOUCHER', 'سند صرف مصروف تشغيلي', 'Operating Expense Voucher', 'expense', 'شاشة المصروفات / الوردية',
 'acc-5200', '5200', 'مصروفات تشغيلية وإيجارات',
 'acc-1111', '1111', 'الخزينة الرئيسية (النقدية بالصندوق)',
 TRUE, TRUE, TRUE,
 'المصروف التشغيلي (إيجار، كهرباء، صيانة عامة) يُحمَّل على 5200. مصروفات صيانة الليزر تُوجَّه إلى 5250.'),

-- 5) سداد الموردين
('tenant-eg-001', 'RULE-SUPP-PAY', 'سند سداد مديونية مورد', 'Supplier Payment', 'supplier_payment', 'شاشة المشتريات / الموردين',
 'acc-2100', '2100', 'الموردون والدائنون التجاريون',
 'acc-1112', '1112', 'البنك الأهلي المصري (حساب جاري)',
 TRUE, TRUE, TRUE,
 'السداد يخفّض مديونية المورد (مدين) ويخفّض البنك (دائن).'),

-- 6) استلام بضاعة من مورد
('tenant-eg-001', 'RULE-PURCHASE-RECEIPT', 'استلام بضاعة من مورد', 'Purchase Receipt', 'purchase_receipt', 'شاشة المشتريات',
 'acc-1130', '1130', 'مخزون البضائع ومستلزمات العيادة',
 'acc-2100', '2100', 'الموردون والدائنون التجاريون',
 TRUE, TRUE, TRUE,
 'الاستلام يزيد المخزون (مدين) ويزيد مديونية المورد (دائن).'),

-- 7) تحصيل من عميل
('tenant-eg-001', 'RULE-CUSTOMER-COLLECTION', 'تحصيل نقدية من عميل', 'Customer Collection', 'customer_collection', 'شاشة التحصيلات',
 'acc-1111', '1111', 'الخزينة الرئيسية (النقدية بالصندوق)',
 'acc-1120', '1120', 'العملاء والمدينون التجاريون',
 TRUE, TRUE, TRUE,
 'التحصيل يزيد النقدية (مدين) ويخفّض مديونية العميل (دائن).'),

-- 8) الرواتب والأجور
('tenant-eg-001', 'RULE-PAYROLL', 'صرف مسير الرواتب', 'Payroll Disbursement', 'payroll', 'شاشة الرواتب',
 'acc-5300', '5300', 'الرواتب والأجور ومكافآت الكادر',
 'acc-1112', '1112', 'البنك الأهلي المصري (حساب جاري)',
 TRUE, TRUE, TRUE,
 'اعتماد مسير الرواتب يولّد قيداً واحداً بإجمالي الصافي.'),

-- 9) صرف مخزني (استهلاك)
('tenant-eg-001', 'RULE-GOODS-ISSUE', 'صرف مخزني للاستهلاك', 'Goods Issue', 'goods_issue', 'شاشة المخازن',
 'acc-5100', '5100', 'تكلفة البضاعة المباعة (COGS)',
 'acc-1130', '1130', 'مخزون البضائع ومستلزمات العيادة',
 TRUE, TRUE, TRUE,
 'صرف المخزون للاستهلاك في الجلسات يُحمَّل على التكلفة (مدين) ويخفّض المخزون (دائن).'),

-- 10) تسوية جرد المخزون
('tenant-eg-001', 'RULE-INVENTORY-ADJ', 'تسوية عجز الجرد المخزني', 'Inventory Adjustment', 'inventory_adjustment', 'شاشة الجرد',
 'acc-5100', '5100', 'تكلفة البضاعة المباعة (COGS)',
 'acc-1130', '1130', 'مخزون البضائع ومستلزمات العيادة',
 TRUE, TRUE, TRUE,
 'العجز في الجرد يُحمَّل على التكلفة، والزيادة تعكس الاتجاه.')

ON CONFLICT (tenant_id, code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  transaction_type = EXCLUDED.transaction_type,
  source_screen = EXCLUDED.source_screen,
  debit_account_id = EXCLUDED.debit_account_id,
  debit_account_code = EXCLUDED.debit_account_code,
  debit_account_name = EXCLUDED.debit_account_name,
  credit_account_id = EXCLUDED.credit_account_id,
  credit_account_code = EXCLUDED.credit_account_code,
  credit_account_name = EXCLUDED.credit_account_name,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- =========================================================================
-- ملاحظة رقابية:
--   نوع العملية «إهلاك الأصول الثابتة» (asset_depreciation) **لم تُضف له قاعدة**
--   لأن دليل الحسابات الحالي لا يحتوي على «مجمع الإهلاك» (حساب أصول مقابل).
--
--   شاشة الربط ستُظهره تلقائياً كـ «فجوة تغطية» عبر fn_mapping_coverage_gaps().
--   المطلوب: إضافة حساب «مجمع إهلاك الأجهزة والمعدات» (مثلاً 1150) ثم قاعدة:
--     مدين 5250 (صيانة وإهلاك) / دائن 1150 (مجمع الإهلاك)
-- =========================================================================

-- التحقق من التغطية بعد التعبئة
SELECT * FROM fn_mapping_coverage_gaps('tenant-eg-001');


-- ============================================================================
-- ✅ انتهى. القاعدة الآن كاملة وجاهزة.
--
-- الخطوة التالية — ربط التطبيق:
--   داخل التطبيق → شاشة «قاعدة بيانات Neon» → أدخل رابط الاتصال → حفظ
--   ثم اضغط «مزامنة» لإنشاء الجداول ومزامنة البيانات.
-- ============================================================================
