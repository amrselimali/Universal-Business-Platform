-- Payroll phase 2: system constants and references
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_constants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    constant_key varchar(100) NOT NULL UNIQUE,
    constant_value text NOT NULL,
    constant_type varchar(30) NOT NULL DEFAULT 'NUMERIC', -- 'NUMERIC', 'DATE', 'STRING', 'BOOLEAN'
    description text,
    category varchar(50) NOT NULL DEFAULT 'PAYROLL', -- 'PAYROLL', 'TAX', 'INSURANCE', 'CALCULATION'
    is_editable boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_constants_key ON payroll_constants (constant_key);

-- Common reference data
CREATE TABLE IF NOT EXISTS payroll_reference_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_key varchar(100) NOT NULL UNIQUE,
    reference_value varchar(200) NOT NULL,
    reference_type varchar(30) NOT NULL, -- 'CURRENCY', 'COUNTRY', 'STATUS', 'TYPE', 'RATE_TABLE'
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_reference_data_active ON payroll_reference_data (is_active);

-- fiscal periods reference
CREATE TABLE IF NOT EXISTS payroll_fiscal_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    fiscal_period integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, fiscal_year, fiscal_period)
);

CREATE INDEX IF NOT EXISTS ix_payroll_fiscal_periods_company ON payroll_fiscal_periods (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 166) ON CONFLICT DO NOTHING;