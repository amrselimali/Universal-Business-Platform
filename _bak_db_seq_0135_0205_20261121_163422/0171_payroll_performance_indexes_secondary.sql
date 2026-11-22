-- Payroll phase 2: secondary performance indexes
-- Version V6.1 -- 21 November 2026

-- Additional optimized indexes
CREATE INDEX IF NOT EXISTS ix_payroll_runs_company_status_created ON payroll_runs (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_run_status ON payroll_run_employees (run_id, calculation_status, employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_run_item ON payroll_run_lines (run_id, payroll_item_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item_quantity ON payroll_run_lines (payroll_item_id, quantity);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item_rate ON payroll_run_lines (payroll_item_id, rate);

-- Indexes for final settlements
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_employee_status ON payroll_final_settlements (employee_id, status);
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_dates ON payroll_final_settlements (settlement_date, termination_date);

-- Indexes for tax balances with composite keys
CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_company_employee_scope ON payroll_tax_balances (company_id, employee_id, scope_type);
CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_last_run ON payroll_tax_balances (last_run_id);

-- Indexes for insurance balances
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_employee_policy ON payroll_insurance_balances (employee_id, policy_id);
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_employee ON payroll_insurance_transactions (employee_id);

-- Indexes for health insurance
CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_employee ON payroll_health_insurance_balances (employee_id);

-- Indexes for audit logs optimized
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_company_employee ON payroll_audit_log (company_id, employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_employee_trace ON payroll_audit_log (employee_id, trace_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_trace_company ON payroll_audit_log (trace_id, company_id);

-- Indexes for test executions
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_scenario_status ON payroll_test_executions (test_scenario_id, status);
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_company_status ON payroll_test_executions (company_id, status);

-- Indexes for data quality
CREATE INDEX IF NOT EXISTS ix_payroll_data_quality_checks_rule ON payroll_data_quality_checks (rule_id);
CREATE INDEX IF NOT EXISTS ix_payroll_data_quality_checks_company ON payroll_data_quality_checks (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_quality_results_check ON payroll_quality_results (check_id);

-- Indexes for migration tracking
CREATE INDEX IF NOT EXISTS ix_payroll_migration_batches_company_status ON payroll_migration_batches (company_id, batch_status);
CREATE INDEX IF NOT EXISTS ix_payroll_migration_results_batch_key ON payroll_migration_row_results (batch_id, source_primary_key);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 169) ON CONFLICT DO NOTHING;