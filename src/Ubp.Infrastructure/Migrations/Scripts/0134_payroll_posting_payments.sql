-- Payroll phase 2: posting and payments
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_posting_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    batch_name varchar(100) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'pending',
    journal_entry_count integer NOT NULL DEFAULT 0,
    total_debit numeric(19,4) NOT NULL DEFAULT 0,
    total_credit numeric(19,4) NOT NULL DEFAULT 0,
    posted_at timestamptz,
    posted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_posting_batches
    ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE payroll_posting_batches
    ADD COLUMN IF NOT EXISTS status varchar(30) NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS ix_payroll_posting_batches_run ON payroll_posting_batches (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_posting_batches_status ON payroll_posting_batches (status);

CREATE TABLE IF NOT EXISTS payroll_journal_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    posting_batch_id uuid NOT NULL REFERENCES payroll_posting_batches(id) ON DELETE CASCADE,
    run_employee_id uuid REFERENCES payroll_run_employees(id) ON DELETE SET NULL,
    payroll_run_line_id uuid REFERENCES payroll_run_lines(id) ON DELETE SET NULL,
    account_code varchar(20) NOT NULL,
    debit_amount numeric(19,4) NOT NULL DEFAULT 0,
    credit_amount numeric(19,4) NOT NULL DEFAULT 0,
    description text,
    line_number integer NOT NULL DEFAULT 0
);

ALTER TABLE payroll_journal_links
    ADD COLUMN IF NOT EXISTS posting_batch_id uuid REFERENCES payroll_posting_batches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_payroll_journal_links_batch ON payroll_journal_links (posting_batch_id);

-- Payments: cash, check, bank transfer
CREATE TABLE IF NOT EXISTS payroll_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
    payment_batch_id uuid,
    payment_method varchar(30) NOT NULL, -- 'CASH', 'CHECK', 'BANK_TRANSFER', 'MOBILE'
    payment_status varchar(30) NOT NULL DEFAULT 'pending',
    total_amount numeric(19,4) NOT NULL DEFAULT 0,
    paid_amount numeric(19,4) NOT NULL DEFAULT 0,
    payment_date timestamptz,
    payment_reference varchar(100),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at timestamptz,
    UNIQUE (run_id, payment_method, payment_reference)
);

ALTER TABLE payroll_payments
    ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES payroll_runs(id) ON DELETE RESTRICT;
ALTER TABLE payroll_payments
    ADD COLUMN IF NOT EXISTS payment_status varchar(30) NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS ix_payroll_payments_run ON payroll_payments (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_payments_status ON payroll_payments (payment_status);

CREATE TABLE IF NOT EXISTS payroll_payment_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    payment_method varchar(30) NOT NULL,
    batch_name varchar(100) NOT NULL,
    total_count integer NOT NULL DEFAULT 0,
    total_amount numeric(19,4) NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'pending',
    file_name varchar(200),
    generated_at timestamptz,
    confirmed_at timestamptz,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE payroll_payment_batches
    ADD COLUMN IF NOT EXISTS payment_method varchar(30) NOT NULL DEFAULT 'CASH';

CREATE INDEX IF NOT EXISTS ix_payroll_payment_batches_method ON payroll_payment_batches (payment_method);

-- Payment transactions per employee
CREATE TABLE IF NOT EXISTS payroll_payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES payroll_payments(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    amount numeric(19,4) NOT NULL,
    currency_code char(3) NOT NULL DEFAULT 'EGP',
    transaction_key varchar(100) NOT NULL UNIQUE,
    bank_account_reference varchar(200),
    status varchar(30) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_payment_transactions
    ADD COLUMN IF NOT EXISTS transaction_key varchar(100);
ALTER TABLE payroll_payment_transactions
    ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE payroll_payment_transactions
    ADD COLUMN IF NOT EXISTS status varchar(30) NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_transactions_key ON payroll_payment_transactions (transaction_key);

CREATE INDEX IF NOT EXISTS ix_payroll_payment_transactions_employee ON payroll_payment_transactions (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_payment_transactions_status ON payroll_payment_transactions (status);