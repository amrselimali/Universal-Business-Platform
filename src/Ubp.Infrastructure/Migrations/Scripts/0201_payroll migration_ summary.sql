-- Payroll phase 2: migration summary
-- Version V6.1 -- 21 November 2026

-- Migration summary per company
CREATE TABLE IF NOT EXISTS payroll_migration_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_version integer NOT NULL,
    migration_start_date timestamptz,
    migration_completion_date timestamptz,
    total_scripts_executed integer NOT NULL DEFAULT 0,
    total_scripts_succeeded integer NOT NULL DEFAULT 0,
    total_scripts_failed integer NOT NULL DEFAULT 0,
    total_records_migrated integer NOT NULL DEFAULT 0,
    total_records_failed integer NOT NULL DEFAULT 0,
    data_integrity_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'FAILED'
    performance_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTABLE', 'BELOW_TARGET'
    security_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'FAILED'
    overall_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    notes text
);

ALTER TABLE payroll_migration_summary
    ADD COLUMN IF NOT EXISTS company_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_migration_summary') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_summary' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_summary_company ON payroll_migration_summary (company_id);
    END IF;
END$$;

-- Migration comparison between companies
CREATE TABLE IF NOT EXISTS payroll_migration_comparison_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_date timestamptz NOT NULL DEFAULT now(),
    comparison_type varchar(50) NOT NULL, -- 'RECORD_COUNT', 'PERFORMANCE', 'COST', 'COMPLIANCE'
    company_a_id uuid NOT NULL,
    company_b_id uuid NOT NULL,
    comparison_results jsonb,
    comparison_notes text
);

ALTER TABLE payroll_migration_comparison_summary
    ADD COLUMN IF NOT EXISTS company_a_id uuid;
ALTER TABLE payroll_migration_comparison_summary
    ADD COLUMN IF NOT EXISTS company_b_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_migration_comparison_summary') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_comparison_summary' AND column_name = 'company_a_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_comparison_a ON payroll_migration_comparison_summary (company_a_id);
    END IF;

    IF to_regclass('public.payroll_migration_comparison_summary') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_comparison_summary' AND column_name = 'company_b_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_migration_comparison_b ON payroll_migration_comparison_summary (company_b_id);
    END IF;
END$$;

-- Migration lessons learned
CREATE TABLE IF NOT EXISTS payroll_migration_lessons_learned (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    lesson_learned text NOT NULL,
    lesson_category varchar(50) NOT NULL, -- 'PLANNING', 'EXECUTION', 'TESTING', 'PERFORMANCE', 'SECURITY'
    discovered_at timestamptz NOT NULL DEFAULT now(),
    learned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    applied_in_future_migrations boolean NOT NULL DEFAULT false,
    applied_at timestamptz
);

ALTER TABLE payroll_migration_lessons_learned
    ADD COLUMN IF NOT EXISTS company_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_migration_lessons_learned') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_migration_lessons_learned' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_lessons_company ON payroll_migration_lessons_learned (company_id);
    END IF;
END$$;