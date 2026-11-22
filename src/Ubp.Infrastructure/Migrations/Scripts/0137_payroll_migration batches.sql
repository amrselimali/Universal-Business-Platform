-- Payroll phase 2: migration management tables (complete set)
-- Version V6.1 -- 21 November 2026

-- Already created in 0132:
-- payroll_migration_batches
-- payroll_migration_row_results

-- Additional migration tracking
CREATE TABLE IF NOT EXISTS payroll_mapping_matrix (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    source_table varchar(100) NOT NULL,
    source_field varchar(100) NOT NULL,
    target_table varchar(100) NOT NULL,
    target_field varchar(100) NOT NULL,
    transformation_type varchar(30) NOT NULL, -- 'DIRECT', 'FORMULA', 'CALCULATED', 'CONSTANT'
    transformation_expression text,
    is_required boolean NOT NULL DEFAULT false,
    validation_rule text,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_mapping_matrix_company ON payroll_mapping_matrix (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_mapping_matrix_source ON payroll_mapping_matrix (source_table, source_field);

-- Data quality reports
CREATE TABLE IF NOT EXISTS payroll_data_quality_report (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    report_name varchar(100) NOT NULL,
    report_type varchar(30) NOT NULL, -- 'COMPLETENESS', 'CONSISTENCY', 'VALIDITY', 'ACCURACY'
    source_system varchar(80),
    scope jsonb,
    total_records integer NOT NULL DEFAULT 0,
    valid_records integer NOT NULL DEFAULT 0,
    invalid_records integer NOT NULL DEFAULT 0,
    warnings_count integer NOT NULL DEFAULT 0,
    errors_count integer NOT NULL DEFAULT 0,
    generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    generated_at timestamptz NOT NULL DEFAULT now(),
    approved boolean NOT NULL DEFAULT false,
    approved_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_quality_report_company ON payroll_data_quality_report (company_id);

-- Reconciliation reports
CREATE TABLE IF NOT EXISTS payroll_reconciliation_report (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    run_id uuid,
    report_type varchar(30) NOT NULL, -- 'PERIOD', 'EMPLOYEE', 'ITEM', 'TAX', 'INSURANCE'
    period_from date,
    period_to date,
    total_records integer NOT NULL DEFAULT 0,
    matched_records integer NOT NULL DEFAULT 0,
    unmatched_records integer NOT NULL DEFAULT 0,
    variance_amount numeric(19,4) NOT NULL DEFAULT 0,
    generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_reconciliation_report_company ON payroll_reconciliation_report (company_id);

-- Test results and validation
CREATE TABLE IF NOT EXISTS payroll_test_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_scenario varchar(50) NOT NULL, -- 'PAY-001' to 'PAY-056'
    test_name varchar(200) NOT NULL,
    test_description text,
    company_id uuid,
    run_id uuid,
    employee_id uuid,
    expected_result varchar(100),
    actual_result varchar(100),
    status varchar(30) NOT NULL, -- 'PASSED', 'FAILED', 'SKIPPED'
    error_details text,
    tested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    tested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_test_results_scenario ON payroll_test_results (test_scenario);
CREATE INDEX IF NOT EXISTS ix_payroll_test_results_status ON payroll_test_results (status);
