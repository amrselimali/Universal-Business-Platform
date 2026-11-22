-- Payroll phase 2: performance metrics history
-- Version V6.1 -- 21 November 2026

-- Hourly performance metrics
CREATE TABLE IF NOT EXISTS payroll_hourly_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    metric_date time NOT NULL,
    metric_name varchar(50) NOT NULL, -- 'REQUESTS', 'CALCULATIONS', 'PAYMENTS', 'ERRORS'
    metric_value bigint NOT NULL DEFAULT 0,
    records_processed bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_hourly_metrics_company ON payroll_hourly_metrics (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_hourly_metrics_time ON payroll_hourly_metrics (metric_date);

-- Daily performance summary
CREATE TABLE IF NOT EXISTS payroll_daily_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    metric_date date NOT NULL,
    total_runs integer NOT NULL DEFAULT 0,
    total_employees_calculated integer NOT NULL DEFAULT 0,
    total_successful_runs integer NOT NULL DEFAULT 0,
    total_failed_runs integer NOT NULL DEFAULT 0,
    average_processing_time_ms integer NOT NULL DEFAULT 0,
    total_records_processed bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_daily_performance_company ON payroll_daily_performance (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_daily_performance_date ON payroll_daily_performance (metric_date);

-- Performance anomaly log
CREATE TABLE IF NOT EXISTS payroll_performance_anomalies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    anomaly_type varchar(50) NOT NULL, -- 'SLOW_QUERY', 'HIGH_PROCESSING_TIME', 'THROUGHPUT_DROP', 'ERROR_SPIKE'
    metric_name varchar(50) NOT NULL,
    metric_value_before numeric(19,4),
    metric_value_after numeric(19,4),
    threshold_limit numeric(19,4),
    detected_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    details jsonb
);

CREATE INDEX IF NOT EXISTS ix_payroll_anomalies_company ON payroll_performance_anomalies (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_anomalies_type ON payroll_performance_anomalies (anomaly_type);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 186) ON CONFLICT DO NOTHING;