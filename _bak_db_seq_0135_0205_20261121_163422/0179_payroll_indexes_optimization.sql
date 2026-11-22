-- Payroll phase 2: index optimization and maintenance
-- Version V6.1 -- 21 November 2026

-- Reorganize indexes for better performance
CREATE INDEX IF NOT EXISTS ix_payroll_runs_status_created ON payroll_runs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_status ON payroll_run_employees (run_id, calculation_status);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_run_item ON payroll_run_lines (run_id, payroll_item_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item_quantity ON payroll_run_lines (payroll_item_id, quantity);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item_rate ON payroll_run_lines (payroll_item_id, rate);

-- Indexes for final settlements
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_employee_status ON payroll_final_settlements (employee_id, status);
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_dates ON payroll_final_settlements (settlement_date, termination_date);

-- Indexes for tax balances
CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_employee ON payroll_tax_balances (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_company ON payroll_tax_balances (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_scope ON payroll_tax_balances (scope_type);

-- Indexes for insurance balances
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_employee ON payroll_insurance_balances (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_policy ON payroll_insurance_balances (policy_id);
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_balance ON payroll_insurance_transactions (balance_id);

-- Indexes for health insurance
CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_employee ON payroll_health_insurance_balances (employee_id);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_company ON payroll_audit_log (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_employee ON payroll_audit_log (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_changed ON payroll_audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_trace ON payroll_audit_log (trace_id);

-- Indexes for test executions
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_scenario ON payroll_test_executions (test_scenario_id);
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_status ON payroll_test_executions (status);
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_company ON payroll_test_executions (company_id);

-- Indexes for data quality
CREATE INDEX IF NOT EXISTS ix_payroll_data_quality_checks_rule ON payroll_data_quality_checks (rule_id);
CREATE INDEX IF NOT EXISTS ix_payroll_data_quality_checks_company ON payroll_data_quality_checks (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_quality_results_check ON payroll_quality_results (check_id);

-- Indexes for migration tracking
CREATE INDEX IF NOT EXISTS ix_payroll_migration_batches_company_status ON payroll_migration_batches (company_id, batch_status);
CREATE INDEX IF NOT EXISTS ix_payroll_migration_results_batch_key ON payroll_migration_row_results (batch_id, source_primary_key);

-- Indexes for notification preferences
CREATE INDEX IF NOT EXISTS ix_payroll_notification_preferences_employee ON payroll_notification_preferences (employee_id);

-- Indexes for sensitive data access
CREATE INDEX IF NOT EXISTS ix_payroll_sensitive_access_company ON payroll_sensitive_data_access (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_sensitive_access_field ON payroll_sensitive_data_access (data_field);

-- Indexes for system config
CREATE INDEX IF NOT EXISTS ix_payroll_system_config_key ON payroll_system_config (config_key);
CREATE INDEX IF NOT EXISTS ix_payroll_system_config_category ON payroll_system_config (category);

-- Indexes for reference data
CREATE INDEX IF NOT EXISTS ix_payroll_reference_data_active ON payroll_reference_data (is_active);
CREATE INDEX IF NOT EXISTS ix_payroll_fiscal_periods_company ON payroll_fiscal_periods (company_id);

-- Indexes for encryption keys
CREATE INDEX IF NOT EXISTS ix_payroll_encryption_keys_company ON payroll_encryption_keys (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_encryption_keys_active ON payroll_encryption_keys (is_active);

-- Indexes for audit policies
CREATE INDEX IF NOT EXISTS ix_payroll_audit_policies_company ON payroll_audit_policies (company_id);

-- Indexes for retention schedule
CREATE INDEX IF NOT EXISTS ix_payroll_retention_schedule_company ON payroll_retention_schedule (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 179) ON CONFLICT DO NOTHING;