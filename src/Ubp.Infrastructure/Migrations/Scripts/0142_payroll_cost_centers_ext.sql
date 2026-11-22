-- Payroll phase 2: employee cost centers extension
-- Version V6.1 -- 21 November 2026

-- Extend existing employee_cost_centers if needed or create allocation versions
CREATE TABLE IF NOT EXISTS payroll_cost_center_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    run_employee_id uuid NOT NULL,
    cost_center_id uuid NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
    allocation_ratio numeric(12,8) NOT NULL CHECK (allocation_ratio >= 0 AND allocation_ratio <= 1),
    allocated_amount numeric(19,4) NOT NULL DEFAULT 0,
    UNIQUE (run_employee_id, cost_center_id)
);

ALTER TABLE payroll_cost_center_allocations
    ADD COLUMN IF NOT EXISTS run_employee_id uuid;
ALTER TABLE payroll_cost_center_allocations
    ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES cost_centers(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_cost_center_allocations') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_payroll_cost_center_allocations_run_employee'
       ) THEN
        ALTER TABLE public.payroll_cost_center_allocations
            ADD CONSTRAINT fk_payroll_cost_center_allocations_run_employee
            FOREIGN KEY (run_employee_id) REFERENCES public.payroll_run_employees(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_cost_center_allocations_employee ON payroll_cost_center_allocations (run_employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_cost_center_allocations_center ON payroll_cost_center_allocations (cost_center_id);

-- Update version