-- Payroll phase 2: audit policies and retention
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_audit_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    policy_name varchar(100) NOT NULL,
    policy_type varchar(30) NOT NULL, -- 'DATA_RETENTION', 'ACCESS_LOG', 'CHANGE_LOG', 'EXPORT_LOG', 'SECURITY_EVENT'
    retention_period integer NOT NULL, -- days
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_audit_policies_company ON payroll_audit_policies (company_id);

-- Automated audit cleanup logs
CREATE TABLE IF NOT EXISTS payroll_audit_cleanup_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    policy_id uuid REFERENCES payroll_audit_policies(id) ON DELETE SET NULL,
    cleanup_run_date date NOT NULL,
    records_deleted integer NOT NULL DEFAULT 0,
    tables_affected jsonb,
    cleanup_status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_details text,
    performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_audit_cleanup_company ON payroll_audit_cleanup_log (company_id);

-- Data retention schedule
CREATE TABLE IF NOT EXISTS payroll_retention_schedule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    data_category varchar(50) NOT NULL, -- 'EMPLOYEE', 'CONTRACT', 'PAYROLL_RUN', 'PAYMENT', 'SETTLEMENT', 'AUDIT'
    retention_start_date date NOT NULL,
    retention_end_date date,
    is_permanent boolean NOT NULL DEFAULT false,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_retention_schedule_company ON payroll_retention_schedule (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 167) ON CONFLICT DO NOTHING;