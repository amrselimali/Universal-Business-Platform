-- Payroll phase 2: performance indexes and optimization
-- Version V6.1 -- 21 November 2026

-- Advanced indexes for payroll queries
CREATE INDEX IF NOT EXISTS ix_payroll_runs_employee_status ON payroll_runs (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_status ON payroll_run_employees (run_id, calculation_status);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_employee_item ON payroll_run_lines (run_employee_id, payroll_item_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_trace ON payroll_run_lines (calculation_trace_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_quantity ON payroll_run_lines (quantity);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_rate ON payroll_run_lines (rate);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_status_employee ON payroll_final_settlements (status, employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_dates ON payroll_final_settlements (settlement_date, termination_date);

-- Indexes for insurance tables
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_company_branch ON payroll_insurance_balances (company_id, branch_id);
CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_balance ON payroll_insurance_transactions (balance_id);

-- Indexes for health insurance
CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_company ON payroll_health_insurance_balances (company_id);

-- Indexes for tax balances
CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_company_employee ON payroll_tax_balances (company_id, employee_id);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_company_trace ON payroll_audit_log (company_id, trace_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_log_employee_changed ON payroll_audit_log (employee_id, changed_at DESC);

-- Partition strategy considerations (comment only, actual partitioning via ALTER TABLE)
-- ALTER TABLE payroll_runs SET (partitionkey = company_id, range (created_at));
-- ALTER TABLE payroll_run_employees SET (partitionkey = run_id, range (calculated_at));

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 159) ON CONFLICT DO NOTHING;