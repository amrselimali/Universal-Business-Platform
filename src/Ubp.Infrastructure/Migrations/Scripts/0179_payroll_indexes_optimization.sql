-- Payroll phase 2: index optimization and maintenance
-- Version V6.1 -- 21 November 2026

DO $$
BEGIN
    -- Reorganize indexes for better performance
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_runs_status_created ON payroll_runs (status, created_at DESC);
    END IF;

    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'run_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'calculation_status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_status ON payroll_run_employees (run_id, calculation_status);
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

    -- Indexes for tax balances
    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_employee ON payroll_tax_balances (employee_id);
    END IF;

    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_company ON payroll_tax_balances (company_id);
    END IF;

    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_tax_balances' AND column_name = 'scope_type') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_scope ON payroll_tax_balances (scope_type);
    END IF;

    -- Indexes for insurance balances
    IF to_regclass('public.payroll_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_balances' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_employee ON payroll_insurance_balances (employee_id);
    END IF;

    IF to_regclass('public.payroll_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_balances' AND column_name = 'policy_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_policy ON payroll_insurance_balances (policy_id);
    END IF;

    IF to_regclass('public.payroll_insurance_transactions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_insurance_transactions' AND column_name = 'balance_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_balance ON payroll_insurance_transactions (balance_id);
    END IF;

    -- Indexes for health insurance
    IF to_regclass('public.payroll_health_insurance_balances') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_health_insurance_balances' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_employee ON payroll_health_insurance_balances (employee_id);
    END IF;

    -- Indexes for audit logs
    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_company ON payroll_audit_log (company_id);
    END IF;

    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_employee ON payroll_audit_log (employee_id);
    END IF;

    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'changed_at') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_changed ON payroll_audit_log (changed_at DESC);
    END IF;

    IF to_regclass('public.payroll_audit_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_log' AND column_name = 'trace_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_trace ON payroll_audit_log (trace_id);
    END IF;

    -- Indexes for test executions
    IF to_regclass('public.payroll_test_executions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'test_scenario_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_scenario ON payroll_test_executions (test_scenario_id);
    END IF;

    IF to_regclass('public.payroll_test_executions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_status ON payroll_test_executions (status);
    END IF;

    IF to_regclass('public.payroll_test_executions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_test_executions' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_company ON payroll_test_executions (company_id);
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

    -- Indexes for notification preferences
    IF to_regclass('public.payroll_notification_preferences') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_notification_preferences' AND column_name = 'employee_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_notification_preferences_employee ON payroll_notification_preferences (employee_id);
    END IF;

    -- Indexes for sensitive data access
    IF to_regclass('public.payroll_sensitive_data_access') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_sensitive_data_access' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_sensitive_access_company ON payroll_sensitive_data_access (company_id);
    END IF;

    IF to_regclass('public.payroll_sensitive_data_access') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_sensitive_data_access' AND column_name = 'data_field') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_sensitive_access_field ON payroll_sensitive_data_access (data_field);
    END IF;

    -- Indexes for system config
    IF to_regclass('public.payroll_system_config') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_system_config' AND column_name = 'config_key') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_system_config_key ON payroll_system_config (config_key);
    END IF;

    IF to_regclass('public.payroll_system_config') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_system_config' AND column_name = 'category') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_system_config_category ON payroll_system_config (category);
    END IF;

    -- Indexes for reference data
    IF to_regclass('public.payroll_reference_data') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_reference_data' AND column_name = 'is_active') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_reference_data_active ON payroll_reference_data (is_active);
    END IF;

    IF to_regclass('public.payroll_fiscal_periods') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_fiscal_periods' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_fiscal_periods_company ON payroll_fiscal_periods (company_id);
    END IF;

    -- Indexes for encryption keys
    IF to_regclass('public.payroll_encryption_keys') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_encryption_keys' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_encryption_keys_company ON payroll_encryption_keys (company_id);
    END IF;

    IF to_regclass('public.payroll_encryption_keys') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_encryption_keys' AND column_name = 'is_active') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_encryption_keys_active ON payroll_encryption_keys (is_active);
    END IF;

    -- Indexes for audit policies
    IF to_regclass('public.payroll_audit_policies') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_audit_policies' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_audit_policies_company ON payroll_audit_policies (company_id);
    END IF;

    -- Indexes for retention schedule
    IF to_regclass('public.payroll_retention_schedule') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_retention_schedule' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_retention_schedule_company ON payroll_retention_schedule (company_id);
    END IF;
END
$$;