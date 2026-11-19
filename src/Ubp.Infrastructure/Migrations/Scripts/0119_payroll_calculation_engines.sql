CREATE TABLE IF NOT EXISTS payroll_tax_policies (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(50) NOT NULL, effective_from date NOT NULL,
	effective_to date, cumulative boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
	is_approved boolean NOT NULL DEFAULT false, UNIQUE (code, effective_from)
);
CREATE TABLE IF NOT EXISTS payroll_tax_brackets (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), policy_id uuid NOT NULL REFERENCES payroll_tax_policies(id) ON DELETE RESTRICT,
	upper_limit numeric(19,4) NOT NULL CHECK (upper_limit > 0), rate numeric(9,6) NOT NULL CHECK (rate >= 0 AND rate <= 1),
	bracket_order integer NOT NULL
);
CREATE TABLE IF NOT EXISTS payroll_insurance_policies (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(50) NOT NULL, effective_from date NOT NULL,
	effective_to date, minimum_basis numeric(19,4), maximum_basis numeric(19,4),
	employee_rate numeric(9,6) NOT NULL DEFAULT 0, employer_rate numeric(9,6) NOT NULL DEFAULT 0,
	version integer NOT NULL DEFAULT 1, is_approved boolean NOT NULL DEFAULT false,
	UNIQUE (code, effective_from)
);
CREATE TABLE IF NOT EXISTS payroll_health_insurance_rules (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(50) NOT NULL, effective_from date NOT NULL,
	effective_to date, basis_expression text NOT NULL, employee_rate numeric(9,6) NOT NULL DEFAULT 0,
	employer_rate numeric(9,6) NOT NULL DEFAULT 0, version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS payroll_gross_up_policies (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(50) NOT NULL UNIQUE,
	solver_code varchar(20) NOT NULL DEFAULT 'bisection', tolerance numeric(19,8) NOT NULL DEFAULT 0.0001,
	max_iterations integer NOT NULL DEFAULT 100, is_approved boolean NOT NULL DEFAULT false
);
