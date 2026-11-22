-- Payroll phase 2: data integrity checks
-- Version V6.1 -- 21 November 2026

-- Integrity check definitions
CREATE TABLE IF NOT EXISTS payroll_integrity_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    check_name varchar(100) NOT NULL,
    check_type varchar(30) NOT NULL, -- 'REFERENTIAL', 'UNIQUE', 'RANGE', 'CALCULATION', 'CONSISTENCY'
    target_table varchar(100) NOT NULL,
    target_field varchar(100),
    check_expression text,
    error_message varchar(200) NOT NULL,
    severity varchar(30) NOT NULL DEFAULT 'ERROR', -- 'ERROR', 'WARNING', 'INFO'
    is_active boolean NOT NULL DEFAULT true,
    run_frequency varchar(30) NOT NULL DEFAULT 'DAILY', -- 'DAILY', 'WEEKLY', 'MONTHLY', 'ON_DEMAND'
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_integrity_checks_company ON payroll_integrity_checks (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integrity_checks_type ON payroll_integrity_checks (check_type);
CREATE INDEX IF NOT EXISTS ix_payroll_integrity_checks_table ON payroll_integrity_checks (target_table);

-- Integrity check execution log
CREATE TABLE IF NOT EXISTS payroll_integrity_check_execution (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id uuid REFERENCES payroll_integrity_checks(id) ON DELETE CASCADE,
    company_id uuid NOT NULL,
    run_id uuid,
    execution_date timestamptz NOT NULL DEFAULT now(),
    record_count integer NOT NULL DEFAULT 0,
    passed_record_count integer NOT NULL DEFAULT 0,
    failed_record_count integer NOT NULL DEFAULT 0,
    error_details jsonb,
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_integrity_executions_check ON payroll_integrity_check_execution (check_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integrity_executions_company ON payroll_integrity_check_execution (company_id);

-- Integrity check results per record
CREATE TABLE IF NOT EXISTS payroll_integrity_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id uuid REFERENCES payroll_integrity_check_execution(id) ON DELETE CASCADE,
    record_id uuid,
    table_name varchar(100) NOT NULL,
    field_name varchar(100),
    key_value varchar(200),
    passed boolean NOT NULL,
    error_message varchar(200),
    corrected boolean NOT NULL DEFAULT false,
    corrected_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_integrity_results_execution ON payroll_integrity_results (execution_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integrity_results_record ON payroll_integrity_results (record_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 193) ON CONFLICT DO NOTHING;