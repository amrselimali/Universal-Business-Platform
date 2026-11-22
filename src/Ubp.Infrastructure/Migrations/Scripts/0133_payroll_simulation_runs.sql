-- Payroll phase 2: simulation runs and overrides
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_simulation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    run_id uuid REFERENCES payroll_runs(id) ON DELETE SET NULL,
    simulation_type varchar(30) NOT NULL, -- 'CURRENT', 'HISTORICAL', 'TEMPORARY'
    status varchar(20) NOT NULL DEFAULT 'pending',
    original_net numeric(19,4),
    simulated_net numeric(19,4),
    difference numeric(19,4),
    changes_applied jsonb,
    approved boolean NOT NULL DEFAULT false,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, employee_id, simulation_type)
);

CREATE INDEX IF NOT EXISTS ix_payroll_simulation_runs_company ON payroll_simulation_runs (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_simulation_runs_employee ON payroll_simulation_runs (employee_id);

CREATE TABLE IF NOT EXISTS payroll_simulation_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_run_id uuid NOT NULL REFERENCES payroll_simulation_runs(id) ON DELETE CASCADE,
    field_name varchar(100) NOT NULL,
    original_value text,
    new_value text,
    change_reason text,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_simulation_overrides_run ON payroll_simulation_overrides (simulation_run_id);

CREATE TABLE IF NOT EXISTS payroll_simulation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_run_id uuid NOT NULL REFERENCES payroll_simulation_runs(id) ON DELETE CASCADE,
    component varchar(50) NOT NULL, -- 'GROSS', 'DEDUCTIONS', 'TAX', 'INSURANCE', 'NET'
    amount numeric(19,4) NOT NULL,
    percentage numeric(9,6),
    source_reference varchar(200),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_payroll_simulation_results_run ON payroll_simulation_results (simulation_run_id);

