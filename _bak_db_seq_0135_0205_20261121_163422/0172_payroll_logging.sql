-- Payroll phase 2: comprehensive logging
-- Version V6.1 -- 21 November 2026

-- Operation log
CREATE TABLE IF NOT EXISTS payroll_operation_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    operation_type varchar(50) NOT NULL, -- 'CALCULATE', 'POST', 'PAY', 'APPROVE', 'IMPORT', 'EXPORT', 'RECALCULATE'
    entity_type varchar(50), -- 'RUN', 'EMPLOYEE', 'ITEM', 'POLICY', 'SETTLEMENT'
    entity_id uuid,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ip_address inet,
    session_id varchar(100),
    status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILURE', 'PARTIAL'
    details jsonb,
    execution_time_ms integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_operation_log_company ON payroll_operation_log (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_operation_log_entity ON payroll_operation_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_payroll_operation_log_created ON payroll_operation_log (created_at DESC);

-- Change log with before/after
CREATE TABLE IF NOT EXISTS payroll_change_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    changed_entity varchar(100) NOT NULL, -- 'RUN', 'EMPLOYEE', 'ITEM', 'POLICY', 'SETTLEMENT'
    changed_entity_id uuid,
    change_type varchar(30) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    old_values jsonb,
    new_values jsonb,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    reason text
);

CREATE INDEX IF NOT EXISTS ix_payroll_change_log_company ON payroll_change_log (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_change_log_entity ON payroll_change_log (changed_entity, changed_entity_id);
CREATE INDEX IF NOT EXISTS ix_payroll_change_log_changed ON payroll_change_log (changed_at DESC);

-- Session tracking
CREATE TABLE IF NOT EXISTS payroll_user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    session_id varchar(100) NOT NULL,
    company_id uuid,
    login_at timestamptz NOT NULL DEFAULT now(),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    ip_address inet,
    user_agent text,
    is_active boolean NOT NULL DEFAULT true,
    logout_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_user_sessions_user ON payroll_user_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_payroll_user_sessions_session ON payroll_user_sessions (session_id);
CREATE INDEX IF NOT EXISTS ix_payroll_user_sessions_company ON payroll_user_sessions (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_user_sessions_active ON payroll_user_sessions (is_active);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 172) ON CONFLICT DO NOTHING;