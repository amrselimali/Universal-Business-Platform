-- Payroll phase 2: recurring deductions
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_recurring_deductions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    deduction_code varchar(50) NOT NULL,
    description varchar(200) NOT NULL,
    amount numeric(19,4) NOT NULL DEFAULT 0,
    is_percentage boolean NOT NULL DEFAULT false,
    percentage numeric(9,6) DEFAULT 0,
    frequency varchar(30) NOT NULL, -- 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME'
    start_date date NOT NULL,
    end_date date,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS ix_payroll_recurring_employee ON payroll_recurring_deductions (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_recurring_code ON payroll_recurring_deductions (deduction_code);

-- Installment plan for deductions
CREATE TABLE IF NOT EXISTS payroll_deduction_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_id uuid NOT NULL REFERENCES payroll_recurring_deductions(id) ON DELETE CASCADE,
    installment_number integer NOT NULL,
    amount numeric(19,4) NOT NULL,
    due_date date NOT NULL,
    paid_amount numeric(19,4) NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'pending', -- 'PENDING', 'PAID', 'SKIPPED', 'COMPLETED'
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_installments_deduction ON payroll_deduction_installments (deduction_id);
CREATE INDEX IF NOT EXISTS ix_payroll_installments_due ON payroll_deduction_installments (due_date);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 153) ON CONFLICT DO NOTHING;