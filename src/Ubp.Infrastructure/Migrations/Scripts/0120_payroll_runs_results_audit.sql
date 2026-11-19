CREATE TABLE IF NOT EXISTS payroll_runs (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status varchar(30) NOT NULL DEFAULT 'draft',
	salary_from date NOT NULL, salary_to date NOT NULL, variables_from date NOT NULL, variables_to date NOT NULL,
	expected_payment_date date, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
	created_by uuid REFERENCES users(id) ON DELETE SET NULL,
	CHECK (salary_to >= salary_from AND variables_to >= variables_from)
);
CREATE TABLE IF NOT EXISTS payroll_run_issues (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
	severity varchar(20) NOT NULL, code varchar(100) NOT NULL, message text NOT NULL,
	is_overridden boolean NOT NULL DEFAULT false, override_reason text, overridden_by uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_run_approvals (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
	action varchar(30) NOT NULL, user_id uuid REFERENCES users(id) ON DELETE SET NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_results (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
	employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, currency_code varchar(20) NOT NULL,
	gross_amount numeric(19,4) NOT NULL DEFAULT 0, deductions_amount numeric(19,4) NOT NULL DEFAULT 0,
	net_amount numeric(19,4) NOT NULL DEFAULT 0, calculation_version varchar(100) NOT NULL,
	UNIQUE (payroll_run_id, employee_id)
);
CREATE TABLE IF NOT EXISTS payroll_result_details (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_result_id uuid NOT NULL REFERENCES payroll_results(id) ON DELETE CASCADE,
	payroll_item_id uuid REFERENCES payroll_items(id) ON DELETE RESTRICT, item_code varchar(50) NOT NULL,
	amount numeric(19,4) NOT NULL, source_reference varchar(200), formula_reference varchar(100)
);
