-- Payroll phase 2: summary and aggregation tables
-- Version V6.1 -- 21 November 2026

-- Daily payroll summary
CREATE TABLE IF NOT EXISTS payroll_daily_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    summary_date date NOT NULL,
    total_employees integer NOT NULL DEFAULT 0,
    total_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_deductions numeric(19,4) NOT NULL DEFAULT 0,
    total_net numeric(19,4) NOT NULL DEFAULT 0,
    average_gross numeric(19,4) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT ux_daily_summary_unique UNIQUE (company_id, summary_date)
);

CREATE INDEX IF NOT EXISTS ix_payroll_daily_summary_company ON payroll_daily_summary (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_daily_summary_date ON payroll_daily_summary (summary_date);

-- Weekly payroll summary
CREATE TABLE IF NOT EXISTS payroll_weekly_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    summary_week date NOT NULL, -- Start of week
    total_employees integer NOT NULL DEFAULT 0,
    total_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_deductions numeric(19,4) NOT NULL DEFAULT 0,
    total_net numeric(19,4) NOT NULL DEFAULT 0,
    average_gross numeric(19,4) NOT NULL DEFAULT 0,
    number_of_runs integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT ux_weekly_summary_unique UNIQUE (company_id, summary_week)
);

CREATE INDEX IF NOT EXISTS ix_payroll_weekly_summary_company ON payroll_weekly_summary (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_weekly_summary_week ON payroll_weekly_summary (summary_week);

-- Monthly payroll summary
CREATE TABLE IF NOT EXISTS payroll_monthly_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    summary_month date NOT NULL, -- First day of month
    total_employees integer NOT NULL DEFAULT 0,
    total_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_deductions numeric(19,4) NOT NULL DEFAULT 0,
    total_net numeric(19,4) NOT NULL DEFAULT 0,
    average_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_runs integer NOT NULL DEFAULT 0,
    total_settlements integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT ux_monthly_summary_unique UNIQUE (company_id, summary_month)
);

CREATE INDEX IF NOT EXISTS ix_payroll_monthly_summary_company ON payroll_monthly_summary (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_monthly_summary_month ON payroll_monthly_summary (summary_month);

-- Annual payroll summary
CREATE TABLE IF NOT EXISTS payroll_annual_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    summary_year integer NOT NULL,
    total_employees integer NOT NULL DEFAULT 0,
    total_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_deductions numeric(19,4) NOT NULL DEFAULT 0,
    total_net numeric(19,4) NOT NULL DEFAULT 0,
    average_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_runs integer NOT NULL DEFAULT 0,
    total_settlements integer NOT NULL DEFAULT 0,
    total_terminations integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT ux_annual_summary_unique UNIQUE (company_id, summary_year)
);

CREATE INDEX IF NOT EXISTS ix_payroll_annual_summary_company ON payroll_annual_summary (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_annual_summary_year ON payroll_annual_summary (summary_year);

-- Company comparison summary
CREATE TABLE IF NOT EXISTS payroll_company_comparison (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_date date NOT NULL,
    company_id uuid NOT NULL,
    company_name_ar varchar(200),
    company_name_en varchar(200),
    employee_count integer NOT NULL DEFAULT 0,
    total_gross numeric(19,4) NOT NULL DEFAULT 0,
    total_net numeric(19,4) NOT NULL DEFAULT 0,
    average_gross numeric(19,4) NOT NULL DEFAULT 0,
    rank_by_gross integer,
    rank_by_net integer
);

CREATE INDEX IF NOT EXISTS ix_payroll_company_comparison_date ON payroll_company_comparison (comparison_date);
CREATE INDEX IF NOT EXISTS ix_payroll_company_comparison_company ON payroll_company_comparison (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 185) ON CONFLICT DO NOTHING;