-- Payroll phase 2: audit retention and cleanup
-- Version V6.1 -- 21 November 2026

-- Automated audit cleanup scheduler
CREATE TABLE IF NOT EXISTS payroll_audit_cleanup_scheduler (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    schedule_name varchar(100) NOT NULL,
    cleanup_policy_id uuid REFERENCES payroll_audit_policies(id),
    cron_expression varchar(50) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_run_at timestamptz,
    next_run_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_audit_scheduler_company ON payroll_audit_cleanup_scheduler (company_id);

-- Audit retention violations
CREATE TABLE IF NOT EXISTS payroll_audit_retention_violations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    table_name varchar(100) NOT NULL,
    record_count integer NOT NULL DEFAULT 0,
    retention_period_days integer NOT NULL,
    current_age_days integer NOT NULL DEFAULT 0,
    violation_date date NOT NULL,
    resolved boolean NOT NULL DEFAULT false,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    noted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    noted_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_violations_company ON payroll_audit_retention_violations (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_violations_table ON payroll_audit_retention_violations (table_name);

-- Audit summary reports
CREATE TABLE IF NOT EXISTS payroll_audit_summary_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    report_name varchar(100) NOT NULL,
    report_period_start date NOT NULL,
    report_period_end date NOT NULL,
    total_audit_records integer NOT NULL DEFAULT 0,
    total_changes_created integer NOT NULL DEFAULT 0,
    total_changes_updated integer NOT NULL DEFAULT 0,
    total_changes_deleted integer NOT NULL DEFAULT 0,
    unique_entities_affected integer NOT NULL DEFAULT 0,
    generated_at timestamptz NOT NULL DEFAULT now(),
    generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    file_path varchar(500),
    status varchar(30) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED', 'PENDING'
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_audit_summary_company ON payroll_audit_summary_reports (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 189) ON CONFLICT DO NOTHING;