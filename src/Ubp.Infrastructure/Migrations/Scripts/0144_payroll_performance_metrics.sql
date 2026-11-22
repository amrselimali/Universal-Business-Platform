-- Payroll phase 2: performance metrics and monitoring
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_performance_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    metric_date date NOT NULL,
    metric_name varchar(50) NOT NULL, -- 'EMPLOYEE_COUNT', 'RUNS_CREATED', 'EMPLOYEES_CALCULATED', 'ERROR_COUNT', 'PROCESSING_TIME'
    metric_value bigint NOT NULL,
    unit varchar(20),
    description text,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_performance_metrics_date ON payroll_performance_metrics (metric_date);
CREATE INDEX IF NOT EXISTS ix_payroll_performance_metrics_name ON payroll_performance_metrics (metric_name);

-- Batch processing logs
CREATE TABLE IF NOT EXISTS payroll_batch_processing_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES payroll_recalculation_batches(id) ON DELETE CASCADE,
    operation varchar(50) NOT NULL, -- 'CALCULATE', 'POST', 'PAY', 'IMPORT', 'EXPORT'
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    records_processed bigint NOT NULL DEFAULT 0,
    records_failed bigint NOT NULL DEFAULT 0,
    error_details jsonb,
    status varchar(30) NOT NULL DEFAULT 'completed'
);

CREATE INDEX IF NOT EXISTS ix_payroll_batch_log_batch ON payroll_batch_processing_log (batch_id);

-- System resource usage
CREATE TABLE IF NOT EXISTS payroll_system_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date date NOT NULL,
    cpu_usage_percent numeric(5,2) NOT NULL DEFAULT 0,
    memory_usage_percent numeric(5,2) NOT NULL DEFAULT 0,
    db_connections integer NOT NULL DEFAULT 0,
    active_sessions integer NOT NULL DEFAULT 0,
    queue_size integer NOT NULL DEFAULT 0,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_resources_date ON payroll_system_resources (metric_date);
