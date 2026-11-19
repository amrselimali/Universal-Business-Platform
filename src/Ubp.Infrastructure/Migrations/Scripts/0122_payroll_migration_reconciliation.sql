CREATE TABLE IF NOT EXISTS payroll_migration_batches (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_system varchar(100) NOT NULL, as_of_date date NOT NULL,
	status varchar(20) NOT NULL DEFAULT 'draft', imported_rows integer NOT NULL DEFAULT 0,
	matched_rows integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_recalculation_batches (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid REFERENCES payroll_runs(id) ON DELETE RESTRICT,
	as_of_timestamp timestamptz NOT NULL, calculation_version varchar(100) NOT NULL,
	status varchar(20) NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_period_reconciliation (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
	employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT, previous_net numeric(19,4) NOT NULL DEFAULT 0,
	current_net numeric(19,4) NOT NULL DEFAULT 0, explanation text, created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (payroll_run_id, employee_id)
);
