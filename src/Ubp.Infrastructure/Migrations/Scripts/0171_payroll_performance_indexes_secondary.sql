-- Payroll phase 2: secondary performance indexes
-- Version V6.1 -- 21 November 2026

DO $$
BEGIN
    -- Additional optimized indexes
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_runs_company_status_created ON payroll_runs (company_id, status, created_at DESC);
    END IF;

    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'run_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'calculation_status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_run_status ON payroll_run_employees (run_id, calculation_status, employee_id);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'run_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'payroll_item_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_run_item ON payroll_run_lines (run_id, payroll_item_id);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'payroll_item_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'quantity') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item_quantity ON payroll_run_lines (payroll_item_id, quantity);
    END IF;

    IF to_regclass('public.payroll_run_lines') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'payroll_item_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_lines' AND column_name = 'rate') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item_rate ON payroll_run_lines (payroll_item_id, rate);
    END IF;

    -- Indexes for final settlements
    IF to_regclass('public.payroll_final_settlements') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'employee_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_employee_status ON payroll_final_settlements (employee_id, status);
    END IF;

    IF to_regclass('public.payroll_final_settlements') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'settlement_date')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_final_settlements' AND column_name = 'termination_date') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_dates ON payroll_final_settlements (settlement_date, termination_date);
    END IF;

    -- Indexes for tax balances with composite keys
    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'employee_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'scope_type') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_company_employee_scope ON payroll_tax_balances (company_id, employee_id, scope_type);
    END IF;

    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'last_run_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_last_run ON payroll_tax_balances (last_run_id);
    END IF;

    -- Indexes for insurance balances
    IF to_regclass('public.payroll_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_balances' AND column_name = 'employee_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_balances' AND column_name = 'policy_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_employee_policy ON payroll_insurance_balances (employee_id, policy_id);
    END IF;

    IF to_regclass('public.payroll_insurance_transactions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_transactions' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_employee ON payroll_insurance_transactions (employee_id);
    END IF;

    -- Indexes for health insurance
    IF to_regclass('public.payroll_health_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_health_insurance_balances' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_employee ON payroll_health_insurance_balances (employee_id);
    END IF;

    -- Indexes for audit logs optimized
    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_company_employee ON payroll_audit_log (company_id, employee_id);
    END IF;

    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'employee_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'trace_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'changed_at') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_employee_trace ON payroll_audit_log (employee_id, trace_id, changed_at DESC);
    END IF;

    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'trace_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_trace_company ON payroll_audit_log (trace_id, company_id);
    END IF;

    -- Indexes for test executions
    IF to_regclass('public.payroll_test_executions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'test_scenario_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_scenario_status ON payroll_test_executions (test_scenario_id, status);
    END IF;

    IF to_regclass('public.payroll_test_executions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_company_status ON payroll_test_executions (company_id, status);
    END IF;

    -- Indexes for data quality
    IF to_regclass('public.payroll_data_quality_checks') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_data_quality_checks' AND column_name = 'rule_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_data_quality_checks_rule ON payroll_data_quality_checks (rule_id);
    END IF;

    IF to_regclass('public.payroll_data_quality_checks') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_data_quality_checks' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_data_quality_checks_company ON payroll_data_quality_checks (company_id);
    END IF;

    IF to_regclass('public.payroll_quality_results') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_quality_results' AND column_name = 'check_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_quality_results_check ON payroll_quality_results (check_id);
    END IF;

    -- Indexes for migration tracking
    IF to_regclass('public.payroll_migration_batches') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_batches' AND column_name = 'company_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_batches' AND column_name = 'batch_status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_batches_company_status ON payroll_migration_batches (company_id, batch_status);
    END IF;

    IF to_regclass('public.payroll_migration_row_results') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_row_results' AND column_name = 'batch_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_row_results' AND column_name = 'source_primary_key') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_results_batch_key ON payroll_migration_row_results (batch_id, source_primary_key);
    END IF;
END
$$;