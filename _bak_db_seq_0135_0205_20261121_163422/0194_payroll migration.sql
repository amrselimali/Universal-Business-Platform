-- Payroll phase 2: migration completed markers
-- Version V6.1 -- 21 November 2026

-- Migration completion markers per company
CREATE TABLE IF NOT EXISTS payroll_migration_completion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_version integer NOT NULL,
    is_database_migration_completed boolean NOT NULL DEFAULT false,
    is_application_deployment_completed boolean NOT NULL DEFAULT false,
    is_ui_deployment_completed boolean NOT NULL DEFAULT false,
    is_testing_completed boolean NOT NULL DEFAULT false,
    is_performance_testing_completed boolean NOT NULL DEFAULT false,
    is_rollback_performed boolean NOT NULL DEFAULT false,
    database_migration_date timestamptz,
    application_deployment_date timestamptz,
    ui_deployment_date timestamptz,
    testing_completion_date timestamptz,
    performance_testing_completion_date timestamptz,
    rollback_date timestamptz,
    completed_at timestamptz,
    completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text,
    CONSTRAINT uq_migration_completion_company_version UNIQUE (company_id, migration_version)
);

CREATE INDEX IF NOT EXISTS ix_payroll_migration_completion_company ON payroll_migration_completion (company_id);

-- Post-migration data validation
CREATE TABLE IF NOT EXISTS payroll_post_migration_validation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    validation_name varchar(100) NOT NULL,
    validation_type varchar(50) NOT NULL, -- 'DATA_INTEGRITY', 'PERFORMANCE', 'SECURITY', 'FUNCTIONAL'
    validation_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    started_at timestamptz,
    completed_at timestamptz,
    record_count integer NOT NULL DEFAULT 0,
    passed_record_count integer NOT NULL DEFAULT 0,
    failed_record_count integer NOT NULL DEFAULT 0,
    error_details jsonb,
    validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_post_migration_company ON payroll_post_migration_validation (company_id);

-- Final signoff records
CREATE TABLE IF NOT EXISTS payroll_final_signoff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    signoff_type varchar(50) NOT NULL, -- 'DATABASE', 'APPLICATION', 'UI', 'SECURITY', 'PERFORMANCE'
    signoff_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    signed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    signed_at timestamptz,
    signoff_remarks text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_final_signoff_company ON payroll_final_signoff (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 193) ON CONFLICT DO NOTHING;