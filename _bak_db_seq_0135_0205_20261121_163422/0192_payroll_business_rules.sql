-- Payroll phase 2: business rules engine
-- Version V6.1 -- 21 November 2026

-- Business rules definitions
CREATE TABLE IF NOT EXISTS payroll_business_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    rule_name varchar(100) NOT NULL,
    rule_code varchar(50) NOT NULL UNIQUE,
    rule_type varchar(30) NOT NULL, -- 'CALCULATION', 'VALIDATION', 'PROCESS', 'NOTIFICATION', 'REPORTING'
    rule_expression text NOT NULL,
    rule_priority integer NOT NULL DEFAULT 0,
    depends_on uuid REFERENCES payroll_business_rules(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_business_rules_company ON payroll_business_rules (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_business_rules_code ON payroll_business_rules (rule_code);
CREATE INDEX IF NOT EXISTS ix_payroll_business_rules_type ON payroll_business_rules (rule_type);

-- Rule execution log
CREATE TABLE IF NOT EXISTS payroll_rule_execution_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid REFERENCES payroll_runs(id) ON DELETE SET NULL,
    employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    business_rule_id uuid REFERENCES payroll_business_rules(id) ON DELETE SET NULL,
    execution_order integer NOT NULL,
    result_status varchar(30) NOT NULL DEFAULT 'PASSED', -- 'PASSED', 'FAILED', 'SKIPPED'
    executed_at timestamptz NOT NULL DEFAULT now(),
    execution_time_ms integer,
    output_values jsonb,
    error_message text
);

CREATE INDEX IF NOT EXISTS ix_payroll_rule_executions_rule ON payroll_rule_execution_log (business_rule_id);
CREATE INDEX IF NOT EXISTS ix_payroll_rule_executions_employee ON payroll_rule_execution_log (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_rule_executions_run ON payroll_rule_execution_log (run_id);

-- Rule version history
CREATE TABLE IF NOT EXISTS payroll_rule_version_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_rule_id uuid REFERENCES payroll_business_rules(id) ON DELETE CASCADE,
    version_no integer NOT NULL,
    rule_expression text NOT NULL,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    change_reason text,
    is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS ix_payroll_rule_versions_rule ON payroll_rule_version_history (business_rule_id);
CREATE INDEX IF NOT EXISTS ix_payroll_rule_versions_version ON payroll_rule_version_history (version_no DESC);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 192) ON CONFLICT DO NOTHING;