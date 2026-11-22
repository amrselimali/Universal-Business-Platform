-- Payroll phase 2: advances and loans management
-- Version V6.1 -- 21 November 2026

-- Advance records (distinct from loans)
CREATE TABLE IF NOT EXISTS payroll_advances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    advance_code varchar(50) NOT NULL,
    description varchar(200) NOT NULL,
    advance_amount numeric(19,4) NOT NULL DEFAULT 0,
    amount_deducted numeric(19,4) NOT NULL DEFAULT 0,
    remaining_amount numeric(19,4) NOT NULL DEFAULT 0,
    purpose varchar(100),
    start_date date NOT NULL,
    end_date date,
    is_repayable boolean NOT NULL DEFAULT true,
    repayment_schedule varchar(30), -- 'EQUAL_INSTALLMENTS', 'PERCENTAGE_OF_SALARY', 'FIXED_AMOUNTS'
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

ALTER TABLE payroll_advances
    ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_payroll_advances_employee ON payroll_advances (employee_id);

-- Advance deduction records per run
CREATE TABLE IF NOT EXISTS payroll_advance_deductions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    advance_id uuid NOT NULL REFERENCES payroll_advances(id) ON DELETE CASCADE,
    run_employee_id uuid NOT NULL,
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    deduction_amount numeric(19,4) NOT NULL DEFAULT 0,
    deduction_date date NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'pending', -- 'PENDING', 'DEDUCTED', 'SKIPPED'
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_advance_deductions
    ADD COLUMN IF NOT EXISTS advance_id uuid REFERENCES payroll_advances(id) ON DELETE CASCADE;
ALTER TABLE payroll_advance_deductions
    ADD COLUMN IF NOT EXISTS run_employee_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_advance_deductions') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_payroll_advance_deductions_run_employee'
       ) THEN
        ALTER TABLE public.payroll_advance_deductions
            ADD CONSTRAINT fk_payroll_advance_deductions_run_employee
            FOREIGN KEY (run_employee_id) REFERENCES public.payroll_run_employees(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_advance_deductions_advance ON payroll_advance_deductions (advance_id);
CREATE INDEX IF NOT EXISTS ix_payroll_advance_deductions_employee ON payroll_advance_deductions (run_employee_id);