-- ============================================================================
-- Enterprise Relational Schema for Universal Business Platform (ERP)
-- PostgreSQL / Cloud SQL Production Architecture
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANTS & MULTI-TENANCY
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_branch_code_per_tenant UNIQUE (tenant_id, code)
);

-- 3. CHART OF ACCOUNTS (شجرة الحسابات العامة)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(32) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    type VARCHAR(32) NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
    is_debit_normal BOOLEAN NOT NULL DEFAULT TRUE,
    parent_id VARCHAR(64) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    level INT NOT NULL DEFAULT 1,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_account_code_per_tenant UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_code ON chart_of_accounts(tenant_id, code);

-- 4. PARTIES / CUSTOMERS & SUPPLIERS (العملاء والموردون)
-- Strictly serialized auto-incrementing customer code per tenant
CREATE TABLE IF NOT EXISTS parties (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    customer_code VARCHAR(32) NOT NULL, -- الكود المسريل الآلي للعميل (المفتاح المالي الوحيد للربط)
    system_code VARCHAR(64),
    paper_code VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    type VARCHAR(32) NOT NULL CHECK (type IN ('Customer', 'Supplier', 'Both')),
    account_id VARCHAR(64) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    credit_limit NUMERIC(18, 2) DEFAULT 0.00,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_party_customer_code UNIQUE (tenant_id, customer_code)
);

CREATE INDEX IF NOT EXISTS idx_parties_tenant_cust_code ON parties(tenant_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type ON parties(tenant_id, type);

-- 5. PAYMENT METHODS (طرق التحصيل والسداد)
CREATE TABLE IF NOT EXISTS payment_methods (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    code VARCHAR(64) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    type VARCHAR(32) NOT NULL CHECK (type IN ('Cash', 'Card', 'Transfer', 'Wallet', 'Other')),
    linked_account_id VARCHAR(64) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_method_code UNIQUE (tenant_id, code)
);

-- 6. GENERAL JOURNAL ENTRIES (قيود اليومية العامة)
CREATE TABLE IF NOT EXISTS journal_entries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE RESTRICT,
    entry_number VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    source_document VARCHAR(255),
    is_posted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_journal_entry_number UNIQUE (tenant_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_tenant_date ON journal_entries(tenant_id, date);

-- 7. JOURNAL ENTRY LINES (أسطر القيد المتوازنة)
CREATE TABLE IF NOT EXISTS journal_lines (
    id VARCHAR(64) PRIMARY KEY,
    journal_entry_id VARCHAR(64) NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    party_id VARCHAR(64) REFERENCES parties(id) ON DELETE RESTRICT,
    debit NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    memo TEXT,
    line_order INT NOT NULL DEFAULT 1,
    CONSTRAINT chk_debit_or_credit CHECK (
        (debit > 0 AND credit = 0) OR 
        (credit > 0 AND debit = 0) OR 
        (debit = 0 AND credit = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_party ON journal_lines(party_id);

-- 8. CASH COLLECTION RECEIPTS (إيصالات التحصيل النقدية والبنكية)
CREATE TABLE IF NOT EXISTS cash_receipts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    voucher_number VARCHAR(64) NOT NULL,
    party_id VARCHAR(64) NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    customer_code VARCHAR(32) NOT NULL, -- الربط المالي الصارم بكود العميل
    date DATE NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    payment_method VARCHAR(32) NOT NULL,
    payment_method_label VARCHAR(128),
    bank_or_safe_account_id VARCHAR(64) NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    journal_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    reference_invoice_no VARCHAR(64),
    description TEXT,
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_receipt_voucher_number UNIQUE (tenant_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_party_date ON cash_receipts(party_id, date);
CREATE INDEX IF NOT EXISTS idx_receipts_customer_code ON cash_receipts(tenant_id, customer_code);

-- 9. CUSTOMER REFUNDS (استردادات مستحقات العملاء)
CREATE TABLE IF NOT EXISTS customer_refunds (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    voucher_number VARCHAR(64) NOT NULL,
    party_id VARCHAR(64) NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    customer_code VARCHAR(32) NOT NULL,
    date DATE NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    payment_account_id VARCHAR(64) NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    journal_entry_id VARCHAR(64) REFERENCES journal_entries(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_refund_voucher_number UNIQUE (tenant_id, voucher_number)
);

-- ============================================================================
-- SQL VIEW: REAL-TIME CUSTOMER RUNNING STATEMENT (كشف الحساب التراكمي اللحظي)
-- Computes precise running balances via SQL Window Functions on the database engine
-- ============================================================================
CREATE OR REPLACE VIEW v_customer_detailed_statement AS
SELECT 
    jl.party_id,
    p.customer_code,
    p.name AS customer_name,
    je.date AS transaction_date,
    je.entry_number AS document_number,
    je.source_document AS document_type,
    jl.memo AS description,
    jl.debit,
    jl.credit,
    -- الرصيد التراكمي المحسوب برمجياً داخل محرك SQL فائق السرعة
    SUM(jl.debit - jl.credit) OVER (
        PARTITION BY jl.party_id 
        ORDER BY je.date ASC, je.id ASC, jl.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_entry_id = je.id
JOIN parties p ON jl.party_id = p.id
WHERE p.type IN ('Customer', 'Both');
