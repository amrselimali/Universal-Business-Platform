-- Payroll phase 2: sequences and series
-- Version V6.1 -- 21 November 2026

-- Arithmetic sequences for calculations
CREATE TABLE IF NOT EXISTS payroll_arithmetic_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_name varchar(100) NOT NULL,
    start_value numeric(19,4) NOT NULL,
    common_difference numeric(19,4) NOT NULL,
    number_of_terms integer NOT NULL DEFAULT 1,
    current_term integer NOT NULL DEFAULT 1,
    last_term numeric(19,4),
    sum_of_terms numeric(19,4),
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_sequences_name ON payroll_arithmetic_sequences (sequence_name);

-- Geometric sequences for compound calculations
CREATE TABLE IF NOT EXISTS payroll_geometric_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_name varchar(100) NOT NULL,
    start_value numeric(19,4) NOT NULL,
    common_ratio numeric(15,6) NOT NULL DEFAULT 1.0,
    number_of_terms integer NOT NULL DEFAULT 1,
    current_term integer NOT NULL DEFAULT 1,
    last_term numeric(19,4),
    sum_of_terms numeric(19,4),
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_geo_sequences_name ON payroll_geometric_sequences (sequence_name);

-- Series for depreciation (though this is assets module)
CREATE TABLE IF NOT EXISTS payroll_depreciation_series (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_name varchar(100) NOT NULL,
    asset_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    annual_depreciation numeric(19,4) NOT NULL,
    accumulated_depreciation numeric(19,4) NOT NULL,
    book_value numeric(19,4) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_depreciation_asset ON payroll_depreciation_series (asset_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 167) ON CONFLICT DO NOTHING;