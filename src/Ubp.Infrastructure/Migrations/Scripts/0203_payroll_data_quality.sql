-- Payroll phase 3: data quality management
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_quality_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    metric_name varchar(50) NOT NULL, -- 'COMPLETENESS', 'CONSISTENCY', 'ACCURACY', 'TIMELINESS'
    metric_value numeric(5,2) NOT NULL DEFAULT 100.00,
    record_count integer NOT NULL DEFAULT 0,
    checked_at timestamptz NOT NULL DEFAULT now(),
    checked_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_quality_metrics_company ON payroll_quality_metrics (company_id);

-- Quality rule definitions
CREATE TABLE IF NOT EXISTS payroll_quality_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    rule_name varchar(100) NOT NULL,
    rule_type varchar(30) NOT NULL, -- 'REQUIRED', 'RANGE', 'PATTERN', 'COMPARISON'
    target_table varchar(100) NOT NULL,
    target_field varchar(100),
    validation_criteria jsonb,
    error_message varchar(200),
    severity varchar(30) NOT NULL DEFAULT 'error',
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_quality_rules_company ON payroll_quality_rules (company_id);
