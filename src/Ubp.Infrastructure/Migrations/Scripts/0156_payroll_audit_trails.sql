-- Payroll phase 2: advanced audit trails
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_audit_trail_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    run_id uuid,
    employee_id uuid,
    change_type varchar(30) NOT NULL,
    table_name varchar(100) NOT NULL,
    record_id uuid,
    field_name varchar(100),
    old_value text,
    new_value text,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    ip_address inet,
    trace_id varchar(100),
    session_id varchar(100)
);

CREATE INDEX IF NOT EXISTS ix_payroll_audit_history_company ON payroll_audit_trail_history (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_history_employee ON payroll_audit_trail_history (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_history_run ON payroll_audit_trail_history (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_history_trace ON payroll_audit_trail_history (trace_id);

-- Data category audit
CREATE TABLE IF NOT EXISTS payroll_data_category_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    category_name varchar(50) NOT NULL, -- 'EMPLOYEE', 'CONTRACT', 'ITEM', 'POLICY', 'RUN', 'PAYMENT', 'SETTLEMENT'
    action_type varchar(30) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'POST', 'PAY'
    record_count integer NOT NULL DEFAULT 0,
    performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    performed_at timestamptz NOT NULL DEFAULT now(),
    summary jsonb
);

CREATE INDEX IF NOT EXISTS ix_payroll_data_category_company ON payroll_data_category_audit (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_data_category_action ON payroll_data_category_audit (action_type);
