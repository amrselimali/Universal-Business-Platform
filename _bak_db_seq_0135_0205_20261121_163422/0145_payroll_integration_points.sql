-- Payroll phase 2: integration points and APIs
-- Version V6.1 -- 21 November 2026

-- External system integration log
CREATE TABLE IF NOT EXISTS payroll_external_integration_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    integration_name varchar(100) NOT NULL, -- 'HR_SYSTEM', 'TIME_AND_ATTENDANCE', 'BANK_SYSTEM', 'TAX_AUTHORITY'
    direction varchar(20) NOT NULL, -- 'IMPORT', 'EXPORT', 'SYNC'
    source_system varchar(100),
    records_count integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'pending',
    error_message text,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_integration_log_company ON payroll_external_integration_log (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integration_log_name ON payroll_external_integration_log (integration_name);

-- Integration mapping definitions
CREATE TABLE IF NOT EXISTS payroll_integration_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    source_field varchar(100) NOT NULL,
    target_field varchar(100) NOT NULL,
    integration_name varchar(100) NOT NULL,
    transformation_type varchar(30) NOT NULL, -- 'DIRECT', 'FORMULA', 'MAPPING', 'SCRIPT'
    transformation_expression text,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_integrations_mapping_company ON payroll_integration_mappings (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integrations_field ON payroll_integration_mappings (source_field);

-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS payroll_webhook_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    event_type varchar(50) NOT NULL, -- 'RUN_CREATED', 'RUN_COMPLETED', 'EMPLOYEE_ADDED', 'SALARY_CHANGED', 'APPROVAL_REQUIRED'
    url varchar(500) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    secret varchar(256),
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_webhooks_company ON payroll_webhook_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_webhooks_event ON payroll_webhook_subscriptions (event_type);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 145) ON CONFLICT DO NOTHING;