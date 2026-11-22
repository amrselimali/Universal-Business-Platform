-- Payroll phase 2: data dictionary
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_data_dictionary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name varchar(100) NOT NULL,
    column_name varchar(100) NOT NULL,
    column_description text NOT NULL,
    data_type varchar(50) NOT NULL,
    is_nullable boolean NOT NULL DEFAULT false,
    data_precision integer,
    data_scale integer,
    lookup_table varchar(100),
    lookup_display_column varchar(100),
    lookup_value_column varchar(100),
    is_primary_key boolean NOT NULL DEFAULT false,
    is_foreign_key boolean NOT NULL DEFAULT false,
    foreign_table varchar(100),
    foreign_column varchar(100),
    is_sensitive boolean NOT NULL DEFAULT false,
    retention_period_days integer,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_data_dictionary_table ON payroll_data_dictionary (table_name);
CREATE INDEX IF NOT EXISTS ix_payroll_data_dictionary_column ON payroll_data_dictionary (column_name);

-- Column lineage tracking
CREATE TABLE IF NOT EXISTS payroll_column_lineage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table varchar(100) NOT NULL,
    source_column varchar(100) NOT NULL,
    target_table varchar(100) NOT NULL,
    target_column varchar(100) NOT NULL,
    transformation_type varchar(50) NOT NULL, -- 'DIRECT', 'FORMULA', 'CALCULATED', 'MAPPING'
    transformation_expression text,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 177) ON CONFLICT DO NOTHING;