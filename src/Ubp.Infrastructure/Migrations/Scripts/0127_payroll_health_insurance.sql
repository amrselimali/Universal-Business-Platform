-- Payroll phase 2: health insurance tables
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_health_insurance_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    effective_from date NOT NULL,
    effective_to date,
    basis_expression text NOT NULL,
    employee_rate numeric(9,6) NOT NULL DEFAULT 0,
    employer_rate numeric(9,6) NOT NULL DEFAULT 0,
    version integer NOT NULL DEFAULT 1,
    is_approved boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS payroll_health_insurance_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    rule_id uuid NOT NULL REFERENCES payroll_health_insurance_rules(id) ON DELETE RESTRICT,
    basis numeric(19,4) NOT NULL,
    employee_contribution numeric(19,4) NOT NULL,
    employer_contribution numeric(19,4) NOT NULL,
    total_contribution numeric(19,4) NOT NULL,
    insured_members integer NOT NULL DEFAULT 0,
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_balances_employee ON payroll_health_insurance_balances (employee_id);

CREATE TABLE IF NOT EXISTS payroll_health_insurance_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id uuid NOT NULL REFERENCES payroll_health_insurance_balances(id) ON DELETE RESTRICT,
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    transaction_type varchar(24) NOT NULL,
    amount numeric(19,4) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_health_insurance_transactions_run ON payroll_health_insurance_transactions (run_id);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 127)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;