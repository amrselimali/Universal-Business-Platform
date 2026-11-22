-- Payroll phase 2: comprehensive audit log
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    run_id uuid,
    employee_id uuid,
    batch_id uuid,
    payroll_run_line_id uuid,
    payroll_payment_id uuid,
    
    change_type varchar(30) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'POST', 'PAY'
    entity_type varchar(50) NOT NULL, -- 'RUN', 'EMPLOYEE', 'LINE', 'PAYMENT', 'BATCH'
    
    old_values jsonb,
    new_values jsonb,
    
    changed_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at timestamptz NOT NULL DEFAULT now(),
    ip_address inet,
    trace_id varchar(100),
    
    description text NOT NULL,
    module varchar(50) NOT NULL DEFAULT 'PAYROLL',
    
    CONSTRAINT chk_audit_change_type CHECK (change_type IN ('CREATE','UPDATE','DELETE','APPROVE','POST','PAY','RECALCULATE','IMPORT','EXPORT')),
    CONSTRAINT chk_audit_entity CHECK (entity_type IN ('RUN','EMPLOYEE','LINE','PAYMENT','BATCH','SOURCE','ITEM','POLICY','POLICY_OVERRIDE','SIMULATION'))
);

CREATE INDEX IF NOT EXISTS ix_payroll_audit_changed ON payroll_audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_company ON payroll_audit_log (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_employee ON payroll_audit_log (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_run ON payroll_audit_log (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_audit_trace ON payroll_audit_log (trace_id);

-- Audit log for configuration changes (global)
CREATE TABLE IF NOT EXISTS payroll_configuration_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type varchar(50) NOT NULL,
    entity_id uuid,
    change_type varchar(30) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changed_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at timestamptz NOT NULL DEFAULT now(),
    reason text,
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_payroll_config_audit_entity ON payroll_configuration_audit (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_payroll_config_audit_changed ON payroll_configuration_audit (changed_at DESC);

-- Session and security audit
CREATE TABLE IF NOT EXISTS payroll_security_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    user_id uuid,
    action varchar(50) NOT NULL,
    resource varchar(100),
    success boolean NOT NULL,
    ip_address inet,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    details jsonb
);

CREATE INDEX IF NOT EXISTS ix_payroll_security_user ON payroll_security_audit (user_id);
CREATE INDEX IF NOT EXISTS ix_payroll_security_company ON payroll_security_audit (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 135) ON CONFLICT DO NOTHING;