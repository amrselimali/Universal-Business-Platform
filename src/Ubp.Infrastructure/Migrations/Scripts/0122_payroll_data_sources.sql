-- Payroll phase 2: data sources and snapshots
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_data_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    provider_code varchar(100) NOT NULL,
    aggregation_code varchar(30) NOT NULL DEFAULT 'sum',
    include_cancelled boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_data_sources_active ON payroll_data_sources (is_active);

CREATE TABLE IF NOT EXISTS payroll_source_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id uuid NOT NULL REFERENCES payroll_data_sources(id) ON DELETE RESTRICT,
    cutoff_at timestamptz NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    source_reference varchar(200),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_source_snapshots_cutoff ON payroll_source_snapshots (cutoff_at DESC);

CREATE TABLE IF NOT EXISTS payroll_source_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid NOT NULL REFERENCES payroll_source_snapshots(id) ON DELETE RESTRICT,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    allocation_method varchar(30) NOT NULL,
    source_value numeric(19,4) NOT NULL,
    allocated_value numeric(19,4) NOT NULL,
    allocation_percent numeric(7,4),
    rule_version varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_payroll_source_allocations_method
        CHECK (allocation_method IN ('direct','percentage','fixed','equal','formula','ignore'))
);

CREATE INDEX IF NOT EXISTS ix_payroll_source_allocations_employee ON payroll_source_allocations (employee_id, created_at DESC);

