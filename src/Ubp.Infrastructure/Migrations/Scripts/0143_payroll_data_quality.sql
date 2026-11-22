-- Payroll phase 2: data quality and validation
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_data_quality_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    rule_name varchar(100) NOT NULL,
    rule_type varchar(30) NOT NULL, -- 'REQUIRED', 'RANGE', 'PATTERN', 'COMPARISON', 'CUSTOM'
    target_table varchar(100) NOT NULL,
    target_field varchar(100) NOT NULL,
    validation_expression text,
    error_message varchar(200) NOT NULL,
    severity varchar(20) NOT NULL DEFAULT 'error', -- 'error', 'warning'
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_quality_rules_company ON payroll_data_quality_rules (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_quality_rules_table ON payroll_data_quality_rules (target_table);

-- Data quality checks execution log
CREATE TABLE IF NOT EXISTS payroll_data_quality_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id uuid NOT NULL REFERENCES payroll_data_quality_rules(id) ON DELETE RESTRICT,
    company_id uuid NOT NULL,
    run_id uuid,
    employee_id uuid,
    record_count integer NOT NULL DEFAULT 0,
    passed_count integer NOT NULL DEFAULT 0,
    failed_count integer NOT NULL DEFAULT 0,
    error_details jsonb,
    checked_at timestamptz NOT NULL DEFAULT now(),
    checked_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_quality_checks_rule ON payroll_data_quality_checks (rule_id);
CREATE INDEX IF NOT EXISTS ix_payroll_quality_checks_company ON payroll_data_quality_checks (company_id);

-- Data quality results per record
CREATE TABLE IF NOT EXISTS payroll_quality_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id uuid NOT NULL REFERENCES payroll_data_quality_checks(id) ON DELETE CASCADE,
    record_id uuid,
    table_name varchar(100) NOT NULL,
    field_name varchar(100),
    record_key varchar(200),
    passed boolean NOT NULL,
    error_message varchar(200),
    corrected boolean NOT NULL DEFAULT false,
    corrected_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_quality_results_check ON payroll_quality_results (check_id);
CREATE INDEX IF NOT EXISTS ix_payroll_quality_results_record ON payroll_quality_results (record_id);
