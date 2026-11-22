-- Payroll phase 2: migration rollback support
-- Version V6.1 -- 21 November 2026

-- Rollback point definitions
CREATE TABLE IF NOT EXISTS payroll_rollback_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    checkpoint_snapshot_id uuid,
    checkpoint_date timestamptz NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_rollback_points_company ON payroll_rollback_points (company_id);

-- Rollback execution log
CREATE TABLE IF NOT EXISTS payroll_rollback_execution_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rollback_point_id uuid REFERENCES payroll_rollback_points(id) ON DELETE CASCADE,
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    rollback_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    error_message text,
    records_restored integer NOT NULL DEFAULT 0,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_rollback_log_point ON payroll_rollback_execution_log (rollback_point_id);

-- Automatic rollback triggers
CREATE TABLE IF NOT EXISTS payroll_automatic_rollback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    trigger_condition varchar(100) NOT NULL, -- 'FAILED_MIGRATION', 'DATA_INTEGRITY_VIOLATION', 'PERFORMANCE_DEGRADATION'
    is_active boolean NOT NULL DEFAULT true,
    trigger_config jsonb,
    last_triggered_at timestamptz,
    times_triggered integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_automatic_rollback_company ON payroll_automatic_rollback (company_id);

-- Rollback test results
CREATE TABLE IF NOT EXISTS payroll_rollback_test_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    test_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PASSED', 'FAILED'
    test_started_at timestamptz,
    test_completed_at timestamptz,
    data_integrity_verified boolean NOT NULL DEFAULT false,
    performance_impact_measured boolean NOT NULL DEFAULT false,
    tested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_rollback_tests_company ON payroll_rollback_test_results (company_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 194) ON CONFLICT DO NOTHING;