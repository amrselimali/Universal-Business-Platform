-- Payroll phase 2: data masking and privacy
-- Version V6.1 -- 21 November 2026

-- Data masking rules
CREATE TABLE IF NOT EXISTS payroll_data_masking_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    table_name varchar(100) NOT NULL,
    column_name varchar(100) NOT NULL,
    mask_type varchar(30) NOT NULL, -- 'PARTIAL', 'HASH', 'ENCRYPT', 'REDACT', 'NULLIFY'
    mask_pattern varchar(100),
    apply_to varchar(50) NOT NULL DEFAULT 'ALL', -- 'ALL', 'HEADS', 'TAILS', 'MIDDLE'
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_masking_rules_company ON payroll_data_masking_rules (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_masking_rules_table ON payroll_data_masking_rules (table_name);

-- Masking execution log
CREATE TABLE IF NOT EXISTS payroll_masking_execution_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    masking_rule_id uuid REFERENCES payroll_data_masking_rules(id) ON DELETE CASCADE,
    company_id uuid NOT NULL,
    table_name varchar(100) NOT NULL,
    records_processed integer NOT NULL DEFAULT 0,
    records_masked integer NOT NULL DEFAULT 0,
    status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message text,
    executed_at timestamptz NOT NULL DEFAULT now(),
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_masking_log_rule ON payroll_masking_execution_log (masking_rule_id);

-- Pseudonymization for testing
CREATE TABLE IF NOT EXISTS payroll_pseudonymized_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_table varchar(100) NOT NULL,
    original_key_column varchar(100) NOT NULL,
    original_key_value varchar(200),
    pseudonymized_table varchar(100) NOT NULL,
    pseudonymized_key_column varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_pseudonymized_original ON payroll_pseudonymized_data (original_table, original_key_value);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 188) ON CONFLICT DO NOTHING;