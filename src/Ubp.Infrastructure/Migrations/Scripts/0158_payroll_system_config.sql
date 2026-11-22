-- Payroll phase 2: system configuration
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_system_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key varchar(100) NOT NULL UNIQUE,
    config_value text NOT NULL,
    config_type varchar(30) NOT NULL DEFAULT 'STRING', -- 'STRING', 'INTEGER', 'BOOLEAN', 'DECIMAL', 'JSON'
    description text,
    is_editable boolean NOT NULL DEFAULT false, -- Only admins can edit
    is_sensitive boolean NOT NULL DEFAULT false, -- Encrypted storage
    category varchar(50) NOT NULL DEFAULT 'GENERAL', -- 'GENERAL', 'TAX', 'INSURANCE', 'CALCULATION', 'DISPLAY', 'SECURITY'
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_system_config_category ON payroll_system_config (category);

-- Configuration history
CREATE TABLE IF NOT EXISTS payroll_config_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key varchar(100) NOT NULL,
    old_value text,
    new_value text,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    reason text
);

CREATE INDEX IF NOT EXISTS ix_payroll_config_history_key ON payroll_config_history (config_key);
