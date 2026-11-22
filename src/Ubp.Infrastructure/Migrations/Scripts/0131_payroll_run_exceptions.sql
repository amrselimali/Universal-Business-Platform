-- Payroll phase 2: run exceptions and issues
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_run_issues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    issue_type varchar(30) NOT NULL,
    severity varchar(20) NOT NULL DEFAULT 'warning',
    description text NOT NULL,
    affected_item varchar(100),
    affected_amount numeric(19,4),
    resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_run_issues
    ADD COLUMN IF NOT EXISTS run_id uuid,
    ADD COLUMN IF NOT EXISTS employee_id uuid,
    ADD COLUMN IF NOT EXISTS resolved_by uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_run_issues_run'
       ) THEN
        ALTER TABLE public.payroll_run_issues
            ADD CONSTRAINT fk_payroll_run_issues_run
            FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
    END IF;

    IF to_regclass('public.employees') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_run_issues_employee'
       ) THEN
        ALTER TABLE public.payroll_run_issues
            ADD CONSTRAINT fk_payroll_run_issues_employee
            FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;
    END IF;

    IF to_regclass('public.users') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_run_issues_resolved_by'
       ) THEN
        ALTER TABLE public.payroll_run_issues
            ADD CONSTRAINT fk_payroll_run_issues_resolved_by
            FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_run_issues_run ON payroll_run_issues (run_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_issues_employee ON payroll_run_issues (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_issues_severity ON payroll_run_issues (severity);

CREATE TABLE IF NOT EXISTS payroll_run_exception_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    description text,
    is_blocking boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 131)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;