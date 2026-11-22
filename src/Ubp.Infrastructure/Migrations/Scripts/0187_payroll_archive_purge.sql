-- Payroll phase 2: archive and purge utilities
-- Version V6.1 -- 21 November 2026

-- Archive table for historical payroll data
CREATE TABLE IF NOT EXISTS payroll_archive (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    source_table varchar(100) NOT NULL,
    archive_date date NOT NULL,
    record_count integer NOT NULL DEFAULT 0,
    archive_path varchar(500),
    compression_type varchar(30) NOT NULL DEFAULT 'GZIP', -- 'GZIP', 'ZIP', 'NONE'
    is_compressed boolean NOT NULL DEFAULT true,
    retention_policy_id uuid REFERENCES payroll_retention_schedule(id) ON DELETE SET NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_archive_company ON payroll_archive (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_archive_table ON payroll_archive (source_table);

-- Archive execution log
CREATE TABLE IF NOT EXISTS payroll_archive_execution_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_id uuid REFERENCES payroll_archive(id) ON DELETE CASCADE,
    execution_date timestamptz NOT NULL DEFAULT now(),
    records_archived integer NOT NULL DEFAULT 0,
    records_failed integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message text,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_archive_log_id ON payroll_archive_execution_log (archive_id);

-- Purge job execution log
CREATE TABLE IF NOT EXISTS payroll_purge_job_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    job_name varchar(100) NOT NULL,
    job_type varchar(50) NOT NULL, -- 'DATA_PURGE', 'LOG_PURGE', 'ARCHIVE_PURGE'
    start_date date NOT NULL,
    end_date date,
    records_deleted integer NOT NULL DEFAULT 0,
    records_archived integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message text,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_purge_log_company ON payroll_purge_job_log (company_id);

-- Data migration verification
CREATE TABLE IF NOT EXISTS payroll_migration_verification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    source_record_count integer NOT NULL DEFAULT 0,
    target_record_count integer NOT NULL DEFAULT 0,
    matched_record_count integer NOT NULL DEFAULT 0,
    discrepancy_count integer NOT NULL DEFAULT 0,
    verification_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'FAILED'
    verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    verified_at timestamptz,
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_verification_company ON payroll_migration_verification (company_id);
