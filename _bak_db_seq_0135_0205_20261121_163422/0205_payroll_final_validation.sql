-- Payroll phase 3: final validation and closeout
-- Version V6.1 -- 21 November 2026

-- Validation results
CREATE TABLE IF NOT EXISTS payroll_validation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    validation_name varchar(100) NOT NULL,
    validation_type varchar(50) NOT NULL, -- 'DATA_INTEGRITY', 'REFERENTIAL', 'BUSINESS_RULE', 'PERFORMANCE'
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'PASSED', 'FAILED'
    record_count integer NOT NULL DEFAULT 0,
    passed_count integer NOT NULL DEFAULT 0,
    failed_count integer NOT NULL DEFAULT 0,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    error_summary jsonb,
    validated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_validation_company ON payroll_validation_results (company_id);

-- Closeout certificate
CREATE TABLE IF NOT EXISTS payroll_closeout_certificate (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    certificate_number varchar(50) NOT NULL,
    migration_version integer NOT NULL,
    issue_date timestamptz NOT NULL DEFAULT now(),
    issued_by uuid REFERENCES users(id) ON DELETE SET NULL,
    status varchar(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'VOID'
    database_integrity boolean NOT NULL DEFAULT false,
    business_logic boolean NOT NULL DEFAULT false,
    performance_metrics_passed boolean NOT NULL DEFAULT false,
    security_assessment_passed boolean NOT NULL DEFAULT false,
    notes text,
    signed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    signed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_closeout_company ON payroll_closeout_certificate (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 200) ON CONFLICT DO NOTHING;