-- Payroll phase 2: finalization and closeout
-- Version V6.1 -- 21 November 2026

-- Migration closeout status
CREATE TABLE IF NOT EXISTS payroll_migration_closeout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_version integer NOT NULL,
    closeout_date date NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    database_migration_completed boolean NOT NULL DEFAULT false,
    application_deployment_completed boolean NOT NULL DEFAULT false,
    ui_deployment_completed boolean NOT NULL DEFAULT false,
    testing_completed boolean NOT NULL DEFAULT false,
    performance_testing_completed boolean NOT NULL DEFAULT false,
    rollback_performed boolean NOT NULL DEFAULT false,
    notes text,
    closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_closeout_company ON payroll_migration_closeout (company_id);

-- Final verification report
CREATE TABLE IF NOT EXISTS payroll_final_verification_report (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    report_date date NOT NULL,
    generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    database_integrity_check boolean NOT NULL DEFAULT false,
    data_consistency_check boolean NOT NULL DEFAULT false,
    performance_test_results jsonb,
    security_assessment_passed boolean NOT NULL DEFAULT false,
    rollback_test_performed boolean NOT NULL DEFAULT false,
    approval_signoff varchar(100),
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    report_file_path varchar(500),
    status varchar(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'ARCHIVED'
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_verification_company ON payroll_final_verification_report (company_id);

-- Migration time capsule
CREATE TABLE IF NOT EXISTS payroll_migration_time_capsule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    capsule_name varchar(100) NOT NULL,
    capsule_description text,
    migration_version integer NOT NULL,
    scripts_included jsonb,
    data_snapshots jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    sealed_at timestamptz,
    seal_status varchar(30) NOT NULL DEFAULT 'SEALED', -- 'SEALED', 'UNSEALED'
    seal_by uuid REFERENCES users(id) ON DELETE SET NULL,
    seal_date timestamptz
);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 190) ON CONFLICT DO NOTHING;