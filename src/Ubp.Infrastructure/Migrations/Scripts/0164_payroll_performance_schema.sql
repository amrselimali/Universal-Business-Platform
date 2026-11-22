-- Payroll phase 2: performance schema and monitoring
-- Version V6.1 -- 21 November 2026

-- Server statistics
CREATE TABLE IF NOT EXISTS payroll_server_statistics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    statistic_date date NOT NULL,
    total_runs_created integer NOT NULL DEFAULT 0,
    total_employees_calculated integer NOT NULL DEFAULT 0,
    total_deductions_processed integer NOT NULL DEFAULT 0,
    total_payments_made integer NOT NULL DEFAULT 0,
    total_settlements_finalized integer NOT NULL DEFAULT 0,
    average_processing_time_ms integer NOT NULL DEFAULT 0,
    maximum_concurrent_users integer NOT NULL DEFAULT 0,
    peak_memory_usage_mb integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_server_statistics
    ADD COLUMN IF NOT EXISTS statistic_date date;

CREATE INDEX IF NOT EXISTS ix_payroll_server_stats_date ON payroll_server_statistics (statistic_date);

-- Query performance tracking
CREATE TABLE IF NOT EXISTS payroll_query_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    query_hash varchar(64),
    query_text text,
    execution_time_ms integer NOT NULL,
    execution_count bigint NOT NULL DEFAULT 0,
    average_execution_time_ms integer NOT NULL DEFAULT 0,
    last_executed_at timestamptz,
    cached boolean NOT NULL DEFAULT false,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_query_performance
    ADD COLUMN IF NOT EXISTS query_hash varchar(64);
ALTER TABLE payroll_query_performance
    ADD COLUMN IF NOT EXISTS last_executed_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_payroll_query_hash ON payroll_query_performance (query_hash);
CREATE INDEX IF NOT EXISTS ix_payroll_query_last_executed ON payroll_query_performance (last_executed_at);

-- Connection pool statistics
CREATE TABLE IF NOT EXISTS payroll_connection_pool (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    total_connections integer NOT NULL DEFAULT 0,
    active_connections integer NOT NULL DEFAULT 0,
    idle_connections integer NOT NULL DEFAULT 0,
    maximum_connections integer NOT NULL DEFAULT 20,
    waiting_connections integer NOT NULL DEFAULT 0,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Slow query log
CREATE TABLE IF NOT EXISTS payroll_slow_query_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    query_text text NOT NULL,
    execution_time_ms integer NOT NULL,
    execution_date timestamptz NOT NULL DEFAULT now(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    module varchar(50) NOT NULL DEFAULT 'PAYROLL'
);

ALTER TABLE payroll_slow_query_log
    ADD COLUMN IF NOT EXISTS execution_date timestamptz;

CREATE INDEX IF NOT EXISTS ix_payroll_slow_query_date ON payroll_slow_query_log (execution_date);