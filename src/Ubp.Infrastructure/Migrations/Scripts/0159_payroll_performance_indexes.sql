-- Payroll phase 2: performance indexes and optimization
-- Version V6.1 -- 21 November 2026

DO $$
BEGIN
    -- Advanced indexes for payroll queries
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_runs_employee_status ON payroll_runs (company_id, status, created_at DESC);
    END IF;

    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'run_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'calculation_status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_status ON payroll_run_employees (run_id, calculation_status);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'run_employee_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'payroll_item_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_employee_item ON payroll_run_lines (run_employee_id, payroll_item_id);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'calculation_trace_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_trace ON payroll_run_lines (calculation_trace_id);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'quantity') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_quantity ON payroll_run_lines (quantity);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'rate') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_rate ON payroll_run_lines (rate);
    END IF;

    -- Composite indexes for common query patterns
    IF to_regclass('public.payroll_final_settlements') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_status_employee ON payroll_final_settlements (status, employee_id);
    END IF;

    IF to_regclass('public.payroll_final_settlements') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'settlement_date')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'termination_date') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_dates ON payroll_final_settlements (settlement_date, termination_date);
    END IF;

    -- Indexes for insurance tables
    IF to_regclass('public.payroll_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_balances' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_balances' AND column_name = 'branch_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_company_branch ON payroll_insurance_balances (company_id, branch_id);
    END IF;

    IF to_regclass('public.payroll_insurance_transactions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_transactions' AND column_name = 'balance_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_balance ON payroll_insurance_transactions (balance_id);
    END IF;

    -- Indexes for health insurance
    IF to_regclass('public.payroll_health_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_health_insurance_balances' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_company ON payroll_health_insurance_balances (company_id);
    END IF;

    -- Indexes for tax balances
    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_company_employee ON payroll_tax_balances (company_id, employee_id);
    END IF;

    -- Indexes for audit logs
    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'trace_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_company_trace ON payroll_audit_log (company_id, trace_id);
    END IF;

    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'employee_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'changed_at') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_employee_changed ON payroll_audit_log (employee_id, changed_at DESC);
    END IF;
END
$$;

-- Partition strategy considerations (comment only, actual partitioning via ALTER TABLE)
-- ALTER TABLE payroll_runs SET (partitionkey = company_id, range (created_at));
-- ALTER TABLE payroll_run_employees SET (partitionkey = run_id, range (calculated_at));