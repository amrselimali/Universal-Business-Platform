-- Payroll phase 2: data migration log
-- Version V6.1 -- 21 November 2026

-- Migration log entries
CREATE TABLE IF NOT EXISTS payroll_migration_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    source_system varchar(100),
    target_system varchar(100),
    source_record_count integer NOT NULL DEFAULT 0,
    target_record_count integer NOT NULL DEFAULT 0,
    migration_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    error_message text,
    records_failed integer NOT NULL DEFAULT 0,
    success_rate numeric(5,2) DEFAULT 100.00,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE payroll_migration_log
    ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE payroll_migration_log
    ADD COLUMN IF NOT EXISTS migration_status varchar(30) DEFAULT 'PENDING';

DO $$
BEGIN
    IF to_regclass('public.payroll_migration_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_log' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_log_company ON payroll_migration_log (company_id);
    END IF;

    IF to_regclass('public.payroll_migration_log') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_log' AND column_name = 'migration_status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_log_status ON payroll_migration_log (migration_status);
    END IF;
END$$;

-- Migration comparison reports
CREATE TABLE IF NOT EXISTS payroll_migration_comparison (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_log_id uuid REFERENCES payroll_migration_log(id) ON DELETE CASCADE,
    company_id uuid NOT NULL,
    comparison_type varchar(50) NOT NULL, -- 'RECORD_COUNT', 'FIELD_MATCH', 'DATA_CONSISTENCY', 'PERFORMANCE'
    comparison_result jsonb,
    comparison_date timestamptz NOT NULL DEFAULT now(),
    compared_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE payroll_migration_comparison
    ADD COLUMN IF NOT EXISTS migration_log_id uuid;
ALTER TABLE payroll_migration_comparison
    ADD COLUMN IF NOT EXISTS company_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_migration_comparison') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_comparison' AND column_name = 'migration_log_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_comparison_log ON payroll_migration_comparison (migration_log_id);
    END IF;

    IF to_regclass('public.payroll_migration_comparison') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_comparison' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_comparison_company ON payroll_migration_comparison (company_id);
    END IF;
END$$;

-- Migration best practices
CREATE TABLE IF NOT EXISTS payroll_migration_best_practices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    practice_name varchar(100) NOT NULL,
    practice_description text NOT NULL,
    is_applied boolean NOT NULL DEFAULT false,
    applied_at timestamptz,
    applied_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text
);

ALTER TABLE payroll_migration_best_practices
    ADD COLUMN IF NOT EXISTS company_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_migration_best_practices') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_best_practices' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_best_practices_company ON payroll_migration_best_practices (company_id);
    END IF;
END$$;