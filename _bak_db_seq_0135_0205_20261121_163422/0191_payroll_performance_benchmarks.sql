-- Payroll phase 2: performance benchmarks
-- Version V6.1 -- 21 November 2026

-- Benchmark results storage
CREATE TABLE IF NOT EXISTS payroll_performance_benchmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    benchmark_name varchar(100) NOT NULL,
    benchmark_description text,
    test_scenario varchar(50) NOT NULL, -- 'PAY-001' to 'PAY-056'
    tested_at timestamptz NOT NULL DEFAULT now(),
    tested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timing metrics
    cpu_time_ms integer NOT NULL DEFAULT 0,
    memory_usage_mb integer NOT NULL DEFAULT 0,
    execution_time_ms integer NOT NULL DEFAULT 0,
    
    -- Volume metrics
    employee_count integer NOT NULL DEFAULT 0,
    run_count integer NOT NULL DEFAULT 0,
    record_count integer NOT NULL DEFAULT 0,
    
    -- Results
    status varchar(30) NOT NULL DEFAULT 'PASSED', -- 'PASSED', 'FAILED', 'SKIPPED'
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_benchmarks_company ON payroll_performance_benchmarks (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_benchmarks_scenario ON payroll_performance_benchmarks (test_scenario);

-- Benchmark comparisons
CREATE TABLE IF NOT EXISTS payroll_benchmark_comparisons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    benchmark_id_1 uuid REFERENCES payroll_performance_benchmarks(id) ON DELETE CASCADE,
    benchmark_id_2 uuid REFERENCES payroll_performance_benchmarks(id) ON DELETE CASCADE,
    compared_at timestamptz NOT NULL DEFAULT now(),
    compared_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    -- Comparison metrics
    cpu_time_ratio numeric(9,4),
    memory_ratio numeric(9,4),
    execution_time_ratio numeric(9,4),
    performance_difference_percent numeric(9,2),
    
    -- Winner
    winner varchar(50), -- 'BENCHMARK_1', 'BENCHMARK_2', 'TIE'
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_benchmarks_comparison_1 ON payroll_benchmark_comparisons (benchmark_id_1);
CREATE INDEX IF NOT EXISTS ix_payroll_benchmarks_comparison_2 ON payroll_benchmark_comparisons (benchmark_id_2);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 190) ON CONFLICT DO NOTHING;