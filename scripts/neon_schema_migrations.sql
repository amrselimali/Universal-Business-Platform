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
-- تم بنجاح! هذا الكود آمن تماماً ولا يمس أو يحذف أي بيانات مسجلة.
-- =========================================================================
