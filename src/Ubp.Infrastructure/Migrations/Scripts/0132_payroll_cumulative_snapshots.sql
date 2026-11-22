-- Payroll phase 2: cumulative snapshots and reconciliation
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_cumulative_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    tax_period_id uuid NOT NULL,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    scope_type varchar(10) NOT NULL,
    branch_id uuid,
    taxable_income_ytd numeric(19,4) NOT NULL DEFAULT 0,
    tax_due_ytd numeric(19,4) NOT NULL DEFAULT 0,
    tax_withheld_ytd numeric(19,4) NOT NULL DEFAULT 0,
    credit_balance numeric(19,4) NOT NULL DEFAULT 0,
    last_run_id uuid,
    row_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT chk_cumulative_scope CHECK (scope_type IN ('COMPANY','BRANCH'))
);

ALTER TABLE payroll_cumulative_snapshots
    ADD COLUMN IF NOT EXISTS company_id uuid,
    ADD COLUMN IF NOT EXISTS employee_id uuid;

CREATE INDEX IF NOT EXISTS ix_payroll_cumulative_snapshots_employee ON payroll_cumulative_snapshots (employee_id);

CREATE TABLE IF NOT EXISTS payroll_cumulative_snapshot_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid NOT NULL REFERENCES payroll_cumulative_snapshots(id) ON DELETE CASCADE,
    detail_type varchar(30) NOT NULL, -- 'INCOME', 'DEDUCTION', 'TAX', 'INSURANCE'
    source_reference varchar(200),
    amount numeric(19,4) NOT NULL,
    occurred_at timestamptz,
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_payroll_cumulative_details_snapshot ON payroll_cumulative_snapshot_details (snapshot_id);

-- Reconciliation between periods
CREATE TABLE IF NOT EXISTS payroll_period_reconciliation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    from_period_id uuid NOT NULL,
    to_period_id uuid NOT NULL,
    reconciliation_type varchar(30) NOT NULL, -- 'VARIANCE', 'ADJUSTMENT', 'RECALCULATION'
    total_variance numeric(19,4),
    employee_affected_count integer NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'pending',
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolution_note text
);

ALTER TABLE payroll_period_reconciliation
    ADD COLUMN IF NOT EXISTS company_id uuid,
    ADD COLUMN IF NOT EXISTS from_period_id uuid,
    ADD COLUMN IF NOT EXISTS to_period_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_periods') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_period_reconciliation_from_period'
        ) THEN
            ALTER TABLE public.payroll_period_reconciliation
                ADD CONSTRAINT fk_payroll_period_reconciliation_from_period
                FOREIGN KEY (from_period_id) REFERENCES public.payroll_periods(id) ON DELETE RESTRICT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_period_reconciliation_to_period'
        ) THEN
            ALTER TABLE public.payroll_period_reconciliation
                ADD CONSTRAINT fk_payroll_period_reconciliation_to_period
                FOREIGN KEY (to_period_id) REFERENCES public.payroll_periods(id) ON DELETE RESTRICT;
        END IF;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_period_reconciliation_company ON payroll_period_reconciliation (company_id);

-- Migration batches for historical data
CREATE TABLE IF NOT EXISTS payroll_migration_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    source_system varchar(80) NOT NULL,
    source_entity varchar(120) NOT NULL,
    mapping_version varchar(40) NOT NULL,
    batch_status varchar(20) NOT NULL DEFAULT 'pending',
    source_count bigint NOT NULL DEFAULT 0,
    imported_count bigint NOT NULL DEFAULT 0,
    rejected_count bigint NOT NULL DEFAULT 0,
    checksum varchar(128),
    started_at timestamptz,
    completed_at timestamptz,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_migration_batches
    ADD COLUMN IF NOT EXISTS company_id uuid,
    ADD COLUMN IF NOT EXISTS batch_status varchar(20) NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS ix_payroll_migration_batches_status ON payroll_migration_batches (batch_status);

-- Migration row results
CREATE TABLE IF NOT EXISTS payroll_migration_row_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES payroll_migration_batches(id) ON DELETE CASCADE,
    source_primary_key varchar(200) NOT NULL,
    target_id uuid,
    row_status varchar(20) NOT NULL,
    error_code varchar(50),
    error_detail text,
    source_hash varchar(128),
    imported_at timestamptz,
    CONSTRAINT chk_migration_row_status
        CHECK (row_status IN ('imported', 'rejected', 'skipped', 'conflict'))
);

CREATE INDEX IF NOT EXISTS ix_payroll_migration_results_batch ON payroll_migration_row_results (batch_id);
CREATE INDEX IF NOT EXISTS ix_payroll_migration_results_key ON payroll_migration_row_results (source_primary_key);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 132)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;