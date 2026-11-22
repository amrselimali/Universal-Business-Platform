-- Payroll phase 2: configuration versions tracking
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_configuration_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    entity_type varchar(50) NOT NULL, -- 'GROUP', 'ITEM', 'POLICY', 'POLICY_OVERRIDE', 'FORMULA', 'DATA_SOURCE', 'TAX_POLICY', 'INSURANCE_POLICY', 'GROSS_UP_POLICY'
    entity_id uuid NOT NULL,
    version_no integer NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    change_reason text,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT chk_config_entity CHECK (entity_type IN ('GROUP','ITEM','POLICY','POLICY_OVERRIDE','FORMULA','DATA_SOURCE','TAX_POLICY','INSURANCE_POLICY','GROSS_UP_POLICY'))
);

CREATE INDEX IF NOT EXISTS ix_payroll_config_versions_company ON payroll_configuration_versions (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_config_versions_entity ON payroll_configuration_versions (entity_type, entity_id, effective_from);

-- Policy priority resolution tracking
CREATE TABLE IF NOT EXISTS payroll_policy_priority_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    run_id uuid,
    employee_id uuid,
    policy_id uuid,
    applied_priority integer NOT NULL,
    resolved_conflict boolean NOT NULL DEFAULT false,
    conflict_resolved_with uuid,
    resolved_at timestamptz,
    applied_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_policy_priority_employee ON payroll_policy_priority_log (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_policy_priority_policy ON payroll_policy_priority_log (policy_id);

-- Calculation logs for debugging
CREATE TABLE IF NOT EXISTS payroll_calculation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    step_name varchar(50) NOT NULL, -- 'FORMULA_EVALUATION', 'TAX_CALCULATION', 'INSURANCE_CALC', 'DISTRIBUTION', 'GROSS_UP'
    input_values jsonb,
    output_value numeric(19,4),
    error_flag boolean NOT NULL DEFAULT false,
    error_message text,
    executed_at timestamptz NOT NULL DEFAULT now(),
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_calculation_logs_run ON payroll_calculation_logs (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_calculation_logs_employee ON payroll_calculation_logs (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_calculation_logs_step ON payroll_calculation_logs (step_name);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 136) ON CONFLICT DO NOTHING;