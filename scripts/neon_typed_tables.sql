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
