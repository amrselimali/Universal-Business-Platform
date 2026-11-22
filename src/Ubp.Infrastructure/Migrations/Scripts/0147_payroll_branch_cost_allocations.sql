-- Payroll phase 2: branch cost allocations
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_branch_cost_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    run_employee_id uuid NOT NULL,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    work_days numeric(12,4) NOT NULL DEFAULT 0,
    allocation_basis varchar(30) NOT NULL DEFAULT 'hours', -- 'hours', 'days', 'percentage'
    allocation_ratio numeric(12,8) NOT NULL CHECK (allocation_ratio >= 0 AND allocation_ratio <= 1),
    gross_cost numeric(19,4) NOT NULL DEFAULT 0,
    employer_contribution numeric(19,4) NOT NULL DEFAULT 0,
    total_cost numeric(19,4) NOT NULL DEFAULT 0,
    UNIQUE (run_employee_id, branch_id)
);

ALTER TABLE payroll_branch_cost_allocations
    ADD COLUMN IF NOT EXISTS run_employee_id uuid;
ALTER TABLE payroll_branch_cost_allocations
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_branch_cost_allocations') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_payroll_branch_cost_allocations_run_employee'
       ) THEN
        ALTER TABLE public.payroll_branch_cost_allocations
            ADD CONSTRAINT fk_payroll_branch_cost_allocations_run_employee
            FOREIGN KEY (run_employee_id) REFERENCES public.payroll_run_employees(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_branch_allocations_employee ON payroll_branch_cost_allocations (run_employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_branch_allocations_branch ON payroll_branch_cost_allocations (branch_id);

-- Update version