-- Payroll phase 2: archive restoration
-- Version V6.1 -- 21 November 2026

-- Archive restoration queue
CREATE TABLE IF NOT EXISTS payroll_archive_restoration_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    archive_id uuid REFERENCES payroll_archive(id) ON DELETE CASCADE,
    restoration_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    requested_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    records_restored integer NOT NULL DEFAULT 0,
    error_message text,
    restored_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_archive_queue_company ON payroll_archive_restoration_queue (company_id);

-- Restoration log
CREATE TABLE IF NOT EXISTS payroll_restoration_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_restoration_id uuid REFERENCES payroll_archive_restoration_queue(id) ON DELETE CASCADE,
    company_id uuid NOT NULL,
    table_name varchar(100) NOT NULL,
    records_restored integer NOT NULL DEFAULT 0,
    restoration_time_ms integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message text,
    restored_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_restoration_log_archive ON payroll_restoration_log (archive_restoration_id);

-- Original data recovery
CREATE TABLE IF NOT EXISTS payroll_original_data_recovery (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    original_table varchar(100) NOT NULL,
    recovery_date timestamptz NOT NULL DEFAULT now(),
    records_recovered integer NOT NULL DEFAULT 0,
    recovery_method varchar(50) NOT NULL, -- 'FROM_ARCHIVE', 'FROM_BACKUP', 'FROM_LOG'
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    error_message text,
    recovered_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_original_recovery_company ON payroll_original_data_recovery (company_id);
