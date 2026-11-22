-- Payroll phase 2: reports and queues
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_reports_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    report_type varchar(50) NOT NULL, -- 'PAYSLIP', 'SUMMARY', 'VARIANCE', 'TAX', 'INSURANCE', 'SETTLEMENT', 'EXPORT'
    parameters jsonb, -- JSON with report filters and options
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    priority integer NOT NULL DEFAULT 0,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    file_path varchar(500),
    error_message text
);

CREATE INDEX IF NOT EXISTS ix_payroll_reports_queue_company ON payroll_reports_queue (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_reports_queue_status ON payroll_reports_queue (status);
CREATE INDEX IF NOT EXISTS ix_payroll_reports_queue_type ON payroll_reports_queue (report_type);

-- Report execution history
CREATE TABLE IF NOT EXISTS payroll_report_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_queue_id uuid NOT NULL REFERENCES payroll_reports_queue(id) ON DELETE CASCADE,
    generated_at timestamptz NOT NULL DEFAULT now(),
    generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    execution_time_ms integer,
    record_count integer,
    file_size_bytes bigint,
    status varchar(30) NOT NULL DEFAULT 'COMPLETED',
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_report_history_queue ON payroll_report_history (report_queue_id);

-- Export format definitions
CREATE TABLE IF NOT EXISTS payroll_export_formats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    format_name varchar(50) NOT NULL UNIQUE, -- 'EXCEL', 'PDF', 'CSV', 'XML', 'JSON'
    format_type varchar(30) NOT NULL, -- 'EMPLOYEE_PISLIP', 'PAYROLL_SUMMARY', 'TAX_REPORT', 'INSURANCE_REPORT', 'CUSTOM'
    template jsonb, -- Template structure
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_export_formats_active ON payroll_export_formats (is_active);
