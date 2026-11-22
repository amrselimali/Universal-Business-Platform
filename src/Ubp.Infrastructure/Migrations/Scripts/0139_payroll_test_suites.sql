-- Payroll phase 2: test suites and validation
-- Version V6.1 -- 21 November 2026

-- Test scenario master table
CREATE TABLE IF NOT EXISTS payroll_test_scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_code varchar(20) NOT NULL UNIQUE, -- 'PAY-001' to 'PAY-056'
    scenario_name_ar varchar(200) NOT NULL,
    scenario_name_en varchar(200) NOT NULL,
    description_ar text,
    description_en text,
    category varchar(30) NOT NULL, -- 'BASIC', 'DISTRIBUTION', 'TAX', 'INSURANCE', 'GROSS_UP', 'SETTLEMENT', 'PERFORMANCE'
    test_data_template jsonb, -- JSON schema for test data
    expected_behavior jsonb, -- Expected outcomes
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_test_scenarios
    ADD COLUMN IF NOT EXISTS scenario_code varchar(20);
ALTER TABLE payroll_test_scenarios
    ADD COLUMN IF NOT EXISTS category varchar(30);

CREATE INDEX IF NOT EXISTS ix_payroll_test_scenarios_code ON payroll_test_scenarios (scenario_code);
CREATE INDEX IF NOT EXISTS ix_payroll_test_scenarios_category ON payroll_test_scenarios (category);

-- Test execution logs
CREATE TABLE IF NOT EXISTS payroll_test_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_scenario_id uuid NOT NULL REFERENCES payroll_test_scenarios(id) ON DELETE RESTRICT,
    run_id uuid,
    employee_id uuid,
    company_id uuid NOT NULL,
    status varchar(30) NOT NULL, -- 'PASSED', 'FAILED', 'SKIPPED', 'INTERRUPTED'
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    duration_ms integer,
    error_message text,
    stack_trace text,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text
);

ALTER TABLE payroll_test_executions
    ADD COLUMN IF NOT EXISTS test_scenario_id uuid REFERENCES payroll_test_scenarios(id) ON DELETE RESTRICT;
ALTER TABLE payroll_test_executions
    ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE payroll_test_executions
    ADD COLUMN IF NOT EXISTS status varchar(30);

CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_scenario ON payroll_test_executions (test_scenario_id);
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_company ON payroll_test_executions (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_test_executions_status ON payroll_test_executions (status);

-- Test data versions
CREATE TABLE IF NOT EXISTS payroll_test_data_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_scenario_id uuid NOT NULL REFERENCES payroll_test_scenarios(id) ON DELETE CASCADE,
    version_no integer NOT NULL,
    data jsonb NOT NULL, -- The test data used
    run_id uuid,
    result_status varchar(30),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE payroll_test_data_versions
    ADD COLUMN IF NOT EXISTS test_scenario_id uuid REFERENCES payroll_test_scenarios(id) ON DELETE CASCADE;
ALTER TABLE payroll_test_data_versions
    ADD COLUMN IF NOT EXISTS version_no integer;

CREATE INDEX IF NOT EXISTS ix_payroll_test_data_scenario ON payroll_test_data_versions (test_scenario_id, version_no);

-- Performance metrics per test
CREATE TABLE IF NOT EXISTS payroll_test_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_execution_id uuid NOT NULL REFERENCES payroll_test_executions(id) ON DELETE CASCADE,
    metric_name varchar(50) NOT NULL, -- 'CPU_TIME', 'MEMORY', 'DURATION', 'ROW_COUNT', 'THROUGHPUT'
    metric_value varchar(100) NOT NULL,
    unit varchar(20),
    recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_test_performance
    ADD COLUMN IF NOT EXISTS test_execution_id uuid REFERENCES payroll_test_executions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_payroll_test_performance_execution ON payroll_test_performance (test_execution_id);