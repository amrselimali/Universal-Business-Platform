-- Payroll phase 2: gross-up tables
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_gross_up_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    solver_code varchar(20) NOT NULL DEFAULT 'bisection',
    tolerance numeric(19,8) NOT NULL DEFAULT 0.0001,
    max_iterations integer NOT NULL DEFAULT 100,
    is_approved boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS payroll_gross_up_item_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL REFERENCES payroll_gross_up_policies(id) ON DELETE RESTRICT,
    item_code varchar(50) NOT NULL,
    bearing_type varchar(20) NOT NULL, -- 'FULL', 'PERCENTAGE', 'PARTIAL', 'LIMIT'
    percentage numeric(9,6),
    maximum_amount numeric(19,4),
    condition_expression text,
    version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS ix_payroll_gross_up_item_rules_policy ON payroll_gross_up_item_rules (policy_id);

CREATE TABLE IF NOT EXISTS payroll_gross_up_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    target_net numeric(19,4),
    achieved_net numeric(19,4),
    solver_type varchar(20) NOT NULL,
    iterations integer NOT NULL DEFAULT 0,
    convergence boolean NOT NULL DEFAULT false,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_gross_up_iterations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES payroll_gross_up_runs(id) ON DELETE CASCADE,
    iteration_no integer NOT NULL,
    gross_amount numeric(19,4) NOT NULL,
    net_amount numeric(19,4) NOT NULL,
    difference numeric(19,4) NOT NULL,
    converged boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_gross_up_iterations_no_pos CHECK (iteration_no > 0)
);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 128)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;