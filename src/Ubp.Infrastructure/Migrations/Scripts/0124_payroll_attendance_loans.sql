-- Payroll phase 2: attendance, leaves and loans
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS attendance_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    work_date date NOT NULL,
    worked_hours numeric(10,2) NOT NULL DEFAULT 0,
    overtime_hours numeric(10,2) NOT NULL DEFAULT 0,
    absence_hours numeric(10,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'raw',
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT chk_attendance_hours CHECK (worked_hours >= 0 AND overtime_hours >= 0 AND absence_hours >= 0)
);

CREATE INDEX IF NOT EXISTS ix_attendance_daily_date ON attendance_daily (work_date, employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_daily ON attendance_daily (employee_id, work_date);

CREATE TABLE IF NOT EXISTS leave_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type_code varchar(50) NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    days numeric(10,2) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_leave_requests_dates_days CHECK (to_date >= from_date AND days >= 0)
);

CREATE INDEX IF NOT EXISTS ix_leave_requests_employee_date ON leave_requests (employee_id, from_date, to_date);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    payroll_item_id uuid REFERENCES payroll_items(id) ON DELETE RESTRICT,
    amount numeric(19,4) NOT NULL,
    effective_date date NOT NULL,
    is_taxable boolean NOT NULL DEFAULT false,
    is_insurable boolean NOT NULL DEFAULT false,
    status varchar(20) NOT NULL DEFAULT 'draft',
    source_reference varchar(100),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_payroll_adjustments_employee_date ON payroll_adjustments (employee_id, effective_date);

CREATE TABLE IF NOT EXISTS employee_loans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    principal numeric(19,4) NOT NULL CHECK (principal > 0),
    outstanding_balance numeric(19,4) NOT NULL CHECK (outstanding_balance >= 0),
    installments integer NOT NULL CHECK (installments > 0),
    status varchar(20) NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employee_loan_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id uuid NOT NULL REFERENCES employee_loans(id) ON DELETE RESTRICT,
    installment_no integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(19,4) NOT NULL CHECK (amount >= 0),
    paid_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status varchar(20) NOT NULL DEFAULT 'open',
    UNIQUE (loan_id, installment_no)
);

CREATE TABLE IF NOT EXISTS employee_loan_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    installment_id uuid NOT NULL REFERENCES employee_loan_installments(id) ON DELETE RESTRICT,
    payroll_run_id uuid,
    amount numeric(19,4) NOT NULL CHECK (amount > 0),
    transaction_key varchar(100) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_loan_transactions_amount_pos CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_loan_transactions_key ON employee_loan_transactions (transaction_key);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 124)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;