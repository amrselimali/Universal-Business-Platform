-- Payroll phase 2: integration logging
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_integration_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    integration_type varchar(50) NOT NULL, -- 'HR_SYSTEM', 'TIME_ATTENDANCE', 'BANK', 'TAX_AUTHORITY', 'EXTERNAL_PAYROLL'
    direction varchar(20) NOT NULL, -- 'IMPORT', 'EXPORT', 'SYNC'
    source_system varchar(100),
    records_processed integer NOT NULL DEFAULT 0,
    records_succeeded integer NOT NULL DEFAULT 0,
    records_failed integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    error_details jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_integration_log_company ON payroll_integration_log (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integration_log_type ON payroll_integration_log (integration_type);
CREATE INDEX IF NOT EXISTS ix_payroll_integration_log_status ON payroll_integration_log (status);

-- Integration batch tracking
CREATE TABLE IF NOT EXISTS payroll_integration_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    integration_type varchar(50) NOT NULL,
    batch_name varchar(100) NOT NULL,
    source_file varchar(200),
    total_records integer NOT NULL DEFAULT 0,
    processed_records integer NOT NULL DEFAULT 0,
    failed_records integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    started_at timestamptz,
    completed_at timestamptz,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_integration_batches_company ON payroll_integration_batches (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_integration_batches_status ON payroll_integration_batches (status);
