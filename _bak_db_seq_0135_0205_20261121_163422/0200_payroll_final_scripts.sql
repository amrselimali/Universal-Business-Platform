-- Payroll phase 2: final migration scripts
-- Version V6.1 -- 21 November 2026

-- Final validation scripts
CREATE TABLE IF NOT EXISTS payroll_final_validation_scripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    script_name varchar(100) NOT NULL,
    script_type varchar(50) NOT NULL, -- 'DATA_VALIDATION', 'PERFORMANCE_TEST', 'SECURITY_AUDIT', 'FUNCTIONAL_TEST'
    script_content text,
    execution_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_final_validation_company ON payroll_final_validation_scripts (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_final_validation_type ON payroll_final_validation_scripts (script_type);

-- Migration completion certificates
CREATE TABLE IF NOT EXISTS payroll_migration_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    certificate_name varchar(100) NOT NULL,
    certificate_type varchar(50) NOT NULL, -- 'DATABASE_MIGRATION_CERT', 'APPLICATION_DEPLOYMENT_CERT', 'SECURITY_AUDIT_CERT', 'PERFORMANCE_CERT'
    issued_date timestamptz NOT NULL DEFAULT now(),
    issued_by uuid REFERENCES users(id) ON DELETE SET NULL,
    validity_period_days integer NOT NULL DEFAULT 365,
    certificate_status varchar(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'REVOKED'
    certificate_hash varchar(100),
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_migration_certs_company ON payroll_migration_certificates (company_id);

-- Post-migration health check
CREATE TABLE IF NOT EXISTS payroll_health_check_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    check_name varchar(100) NOT NULL,
    check_type varchar(50) NOT NULL, -- 'DATA_INTEGRITY', 'PERFORMANCE', 'SECURITY', 'FUNCTIONAL'
    check_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'PASSED', 'FAILED'
    check_score numeric(5,2) DEFAULT 100.00,
    checked_at timestamptz NOT NULL DEFAULT now(),
    checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_health_checks_company ON payroll_health_check_results (company_id);

-- System readiness assessment
CREATE TABLE IF NOT EXISTS payroll_system_readiness (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    readiness_area varchar(50) NOT NULL, -- 'DATABASE', 'APPLICATION', 'UI', 'SECURITY', 'PERFORMANCE', 'COMPLIANCE'
    readiness_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIAL', 'READY', 'NOT_READY'
    readiness_score numeric(5,2) DEFAULT 0.00,
    assessed_at timestamptz NOT NULL DEFAULT now(),
    assessed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    required_actions jsonb,
    overall_readiness boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_payroll_readiness_company ON payroll_system_readiness (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 197) ON CONFLICT DO NOTHING;