-- Payroll phase 2: tax tables and brackets
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_tax_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    cumulative boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    is_approved boolean NOT NULL DEFAULT false,
    UNIQUE (code, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_tax_brackets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL REFERENCES payroll_tax_policies(id) ON DELETE RESTRICT,
    upper_limit numeric(19,4) NOT NULL CHECK (upper_limit > 0),
    rate numeric(9,6) NOT NULL CHECK (rate >= 0 AND rate <= 1),
    bracket_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_tax_exemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    exemption_type varchar(30) NOT NULL,
    amount numeric(19,4),
    percentage numeric(9,6),
    condition_expression text,
    effective_from date NOT NULL,
    effective_to date,
    version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS ix_payroll_tax_exemptions_active ON payroll_tax_exemptions (is_active);

CREATE TABLE IF NOT EXISTS payroll_tax_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    tax_period_id uuid NOT NULL,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    scope_type varchar(10) NOT NULL,
    branch_id uuid NULL,
    taxable_income_ytd numeric(19,4) NOT NULL DEFAULT 0,
    tax_due_ytd numeric(19,4) NOT NULL DEFAULT 0,
    tax_withheld_ytd numeric(19,4) NOT NULL DEFAULT 0,
    credit_balance numeric(19,4) NOT NULL DEFAULT 0,
    last_run_id uuid,
    row_version integer NOT NULL DEFAULT 1,
    CONSTRAINT chk_tax_balance_scope CHECK (scope_type IN ('COMPANY','BRANCH'))
);

DO $$
BEGIN
    IF to_regclass('public.payroll_tax_periods') IS NOT NULL THEN
        ALTER TABLE public.payroll_tax_balances
            ADD CONSTRAINT fk_payroll_tax_balances_tax_period
            FOREIGN KEY (tax_period_id) REFERENCES public.payroll_tax_periods(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payroll_tax_balances_employee ON payroll_tax_balances (employee_id);

CREATE TABLE IF NOT EXISTS payroll_tax_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    tax_balance_id uuid NOT NULL REFERENCES payroll_tax_balances(id) ON DELETE RESTRICT,
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    branch_id uuid NULL,
    transaction_type varchar(24) NOT NULL,
    amount numeric(19,4) NOT NULL,
    tax_year_code varchar(20),
    source_reference uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_tax_transactions_run ON payroll_tax_transactions (run_id);

CREATE TABLE IF NOT EXISTS payroll_tax_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_balance_id uuid NOT NULL REFERENCES payroll_tax_balances(id) ON DELETE RESTRICT,
    run_id uuid REFERENCES payroll_runs(id) ON DELETE SET NULL,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    adjustment_type varchar(24) NOT NULL,
    amount numeric(19,4) NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 125)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;