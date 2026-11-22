-- Payroll phase 2: error codes and messages
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_error_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    error_code varchar(20) NOT NULL UNIQUE,
    error_message_ar text NOT NULL,
    error_message_en text,
    error_severity varchar(30) NOT NULL DEFAULT 'ERROR', -- 'ERROR', 'WARNING', 'INFO'
    error_category varchar(50) NOT NULL, -- 'VALIDATION', 'CALCULATION', 'DATA', 'PERMISSION', 'SYSTEM'
    is_blocking boolean NOT NULL DEFAULT false, -- Whether prevents operation
    suggests_fix text,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_error_codes_category ON payroll_error_codes (error_category);
CREATE INDEX IF NOT EXISTS ix_payroll_error_codes_severity ON payroll_error_codes (error_severity);

-- Error code assignments per run
CREATE TABLE IF NOT EXISTS payroll_run_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    error_code varchar(20) NOT NULL REFERENCES payroll_error_codes(error_code),
    error_message text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    resolved boolean NOT NULL DEFAULT false,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_run_errors_run ON payroll_run_errors (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_errors_employee ON payroll_run_errors (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_errors_code ON payroll_run_errors (error_code);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 168) ON CONFLICT DO NOTHING;