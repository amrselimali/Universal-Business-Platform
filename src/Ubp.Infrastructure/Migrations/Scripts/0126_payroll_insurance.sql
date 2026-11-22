-- Payroll phase 2: insurance tables
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_insurance_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    effective_from date NOT NULL,
    effective_to date,
    minimum_basis numeric(19,4),
    maximum_basis numeric(19,4),
    employee_rate numeric(9,6) NOT NULL DEFAULT 0,
    employer_rate numeric(9,6) NOT NULL DEFAULT 0,
    version integer NOT NULL DEFAULT 1,
    is_approved boolean NOT NULL DEFAULT false,
    UNIQUE (code, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_insurance_brackets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL REFERENCES payroll_insurance_policies(id) ON DELETE RESTRICT,
    upper_limit numeric(19,4),
    lower_limit numeric(19,4),
    rate numeric(9,6),
    side varchar(10) NOT NULL, -- 'EMPLOYEE' or 'EMPLOYER'
    version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payroll_insurance_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    policy_id uuid NOT NULL REFERENCES payroll_insurance_policies(id) ON DELETE RESTRICT,
    scope_type varchar(10) NOT NULL,
    branch_id uuid,
    basis numeric(19,4) NOT NULL,
    employee_contribution numeric(19,4) NOT NULL,
    employer_contribution numeric(19,4) NOT NULL,
    total_contribution numeric(19,4) NOT NULL,
    cumulative_from date,
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_payroll_insurance_balances_employee ON payroll_insurance_balances (employee_id);

CREATE TABLE IF NOT EXISTS payroll_insurance_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    balance_id uuid NOT NULL REFERENCES payroll_insurance_balances(id) ON DELETE RESTRICT,
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    transaction_type varchar(24) NOT NULL,
    amount numeric(19,4) NOT NULL,
    side varchar(10) NOT NULL, -- 'EMPLOYEE' or 'EMPLOYER'
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_insurance_transactions_run ON payroll_insurance_transactions (run_id);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 126)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;