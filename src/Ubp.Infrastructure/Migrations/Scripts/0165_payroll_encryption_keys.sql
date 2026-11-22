-- Payroll phase 2: encryption and security
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_encryption_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    key_name varchar(100) NOT NULL, -- 'SALARY_DATA', 'TAX_DATA', 'INSURANCE_DATA', 'PERSONAL_DATA', 'BANK_ACCOUNT'
    key_type varchar(30) NOT NULL, -- 'AES_256', 'RSA_4096', 'HMAC'
    key_identifier varchar(200) NOT NULL, -- Key ID in KMS or HSM
    is_active boolean NOT NULL DEFAULT true,
    rotation_date date,
    rotated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_encryption_keys_company ON payroll_encryption_keys (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_encryption_keys_active ON payroll_encryption_keys (is_active);

-- Data classification
CREATE TABLE IF NOT EXISTS payroll_data_classification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    data_field varchar(100) NOT NULL,
    classification_level varchar(30) NOT NULL, -- 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'
    requires_encryption boolean NOT NULL DEFAULT false,
    encryption_key_id uuid REFERENCES payroll_encryption_keys(id) ON DELETE SET NULL,
    is_sensitive boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_data_classification_company ON payroll_data_classification (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_data_classification_field ON payroll_data_classification (data_field);

-- Audit of access to sensitive data
CREATE TABLE IF NOT EXISTS payroll_sensitive_data_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    data_field varchar(100) NOT NULL,
    accessed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    accessed_at timestamptz NOT NULL DEFAULT now(),
    purpose varchar(100),
    session_id varchar(100),
    ip_address inet
);

CREATE INDEX IF NOT EXISTS ix_payroll_sensitive_access_company ON payroll_sensitive_data_access (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_sensitive_access_field ON payroll_sensitive_data_access (data_field);
