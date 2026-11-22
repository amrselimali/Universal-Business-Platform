-- Payroll phase 2: run lines (detailed calculation results)
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_run_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_employee_id uuid NOT NULL,
    payroll_item_id uuid NOT NULL,
    item_version_id uuid,
    line_type varchar(24) NOT NULL,
    source_key varchar(160),
    source_snapshot_detail_id uuid,
    quantity numeric(19,6) NOT NULL DEFAULT 1,
    rate numeric(19,6) NOT NULL DEFAULT 1,
    amount numeric(19,4) NOT NULL,
    currency_code char(3) NOT NULL DEFAULT 'EGP',
    taxable_amount numeric(19,4) NOT NULL DEFAULT 0,
    insurable_amount numeric(19,4) NOT NULL DEFAULT 0,
    cost_amount numeric(19,4) NOT NULL DEFAULT 0,
    calculation_trace_id uuid,
    line_sequence integer NOT NULL DEFAULT 0,
    UNIQUE (run_employee_id, payroll_item_id, source_key, line_sequence)
);

DO $$
BEGIN
    IF to_regclass('public.payroll_run_employees') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_run_lines_run_employee'
       ) THEN
        ALTER TABLE public.payroll_run_lines
            ADD CONSTRAINT fk_payroll_run_lines_run_employee
            FOREIGN KEY (run_employee_id) REFERENCES public.payroll_run_employees(id) ON DELETE CASCADE;
    END IF;

    IF to_regclass('public.payroll_items') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_run_lines_payroll_item'
       ) THEN
        ALTER TABLE public.payroll_run_lines
            ADD CONSTRAINT fk_payroll_run_lines_payroll_item
            FOREIGN KEY (payroll_item_id) REFERENCES public.payroll_items(id) ON DELETE RESTRICT;
    END IF;

    IF to_regclass('public.payroll_item_versions') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_run_lines_item_version'
       ) THEN
        ALTER TABLE public.payroll_run_lines
            ADD CONSTRAINT fk_payroll_run_lines_item_version
            FOREIGN KEY (item_version_id) REFERENCES public.payroll_item_versions(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_employee ON payroll_run_lines (run_employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_item ON payroll_run_lines (payroll_item_id);
CREATE INDEX IF NOT EXISTS ix_payroll_run_lines_trace ON payroll_run_lines (calculation_trace_id);

-- Replace old payroll_results with run_lines
-- (According to V6.1: payroll_run_lines replaces payroll_results, payroll_result_details, payroll_result_sources)

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 130)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;