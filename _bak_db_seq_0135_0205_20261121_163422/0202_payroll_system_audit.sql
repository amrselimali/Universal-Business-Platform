-- Payroll phase 3: system audit and compliance
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_system_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    event_type varchar(50) NOT NULL, -- 'LOGIN', 'LOGOUT', 'DATA_ACCESS', 'CHANGE', 'APPROVAL', 'PAYMENT', 'SETTLEMENT'
    entity_type varchar(50), -- 'RUN', 'EMPLOYEE', 'ITEM', 'POLICY', 'SETTLEMENT'
    entity_id uuid,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action_details jsonb,
    ip_address inet,
    trace_id varchar(100),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    session_id varchar(100)
);

CREATE INDEX IF NOT EXISTS ix_payroll_system_audit_company ON payroll_system_audit (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_system_audit_trace ON payroll_system_audit (trace_id);
CREATE INDEX IF NOT EXISTS ix_payroll_system_audit_occurred ON payroll_system_audit (occurred_at DESC);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 197) ON CONFLICT DO NOTHING;