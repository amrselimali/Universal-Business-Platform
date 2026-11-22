-- Payroll phase 2: formulas, policies and overrides
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_formulas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    expression text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) NOT NULL,
    scope_type varchar(40) NOT NULL,
    scope_id uuid,
    priority integer NOT NULL DEFAULT 0,
    effective_from date NOT NULL,
    effective_to date,
    effect_type varchar(30) NOT NULL,
    value_expression text,
    is_approved boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_policies_resolution ON payroll_policies
    (code, scope_type, scope_id, priority DESC, effective_from DESC);

CREATE TABLE IF NOT EXISTS payroll_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL REFERENCES payroll_policies(id) ON DELETE RESTRICT,
    employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    reason text NOT NULL,
    value_expression text,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_overrides_employee ON payroll_overrides (employee_id);

CREATE TABLE IF NOT EXISTS payroll_variables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) NOT NULL UNIQUE,
    name_ar varchar(200),
    name_en varchar(200),
    variable_type varchar(30) NOT NULL,
    description text,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_variable_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variable_id uuid NOT NULL REFERENCES payroll_variables(id) ON DELETE RESTRICT,
    employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    value_numeric numeric(19,4),
    value_text text,
    effective_from date NOT NULL,
    effective_to date,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_payroll_variable_values_effective_dates
        CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS ix_payroll_variables_effective ON payroll_variable_values (variable_id, effective_from DESC);

DO $$
BEGIN
    IF to_regclass('public.db_sequence') IS NOT NULL THEN
        INSERT INTO public.db_sequence (sequence_name, current_value)
        VALUES ('payroll_migration_seq', 123)
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;