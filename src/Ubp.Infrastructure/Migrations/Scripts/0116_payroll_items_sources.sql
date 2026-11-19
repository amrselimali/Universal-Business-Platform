CREATE TABLE IF NOT EXISTS payroll_items (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	code varchar(50) NOT NULL UNIQUE,
	name_ar varchar(200) NOT NULL,
	name_en varchar(200),
	category_code varchar(50) NOT NULL,
	is_variable boolean NOT NULL DEFAULT false,
	affects_net_salary boolean NOT NULL DEFAULT true,
	is_taxable boolean NOT NULL DEFAULT false,
	is_insurable boolean NOT NULL DEFAULT false,
	employer_borne boolean NOT NULL DEFAULT false,
	allow_negative boolean NOT NULL DEFAULT false,
	is_active boolean NOT NULL DEFAULT true,
	version integer NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_item_versions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	payroll_item_id uuid NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
	effective_from date NOT NULL,
	effective_to date,
	calculation_type varchar(30) NOT NULL DEFAULT 'manual',
	formula_code varchar(100),
	minimum_value numeric(19,4),
	maximum_value numeric(19,4),
	rounding_mode varchar(20) NOT NULL DEFAULT 'none',
	version integer NOT NULL DEFAULT 1,
	is_approved boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT ck_payroll_item_version_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
	CONSTRAINT ck_payroll_item_version_limits CHECK (maximum_value IS NULL OR minimum_value IS NULL OR maximum_value >= minimum_value),
	CONSTRAINT ux_payroll_item_effective UNIQUE (payroll_item_id, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_data_sources (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	code varchar(50) NOT NULL UNIQUE,
	name_ar varchar(200) NOT NULL,
	provider_code varchar(100) NOT NULL,
	aggregation_code varchar(30) NOT NULL DEFAULT 'sum',
	include_cancelled boolean NOT NULL DEFAULT false,
	is_active boolean NOT NULL DEFAULT true,
	version integer NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_source_snapshots (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	data_source_id uuid NOT NULL REFERENCES payroll_data_sources(id) ON DELETE RESTRICT,
	cutoff_at timestamptz NOT NULL,
	period_from date NOT NULL,
	period_to date NOT NULL,
	source_reference varchar(200),
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT ck_payroll_snapshot_dates CHECK (period_to >= period_from)
);

CREATE TABLE IF NOT EXISTS payroll_source_allocations (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	source_snapshot_id uuid NOT NULL REFERENCES payroll_source_snapshots(id) ON DELETE RESTRICT,
	employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
	allocation_method varchar(30) NOT NULL,
	source_value numeric(19,4) NOT NULL,
	allocated_value numeric(19,4) NOT NULL,
	allocation_percent numeric(7,4),
	rule_version varchar(100),
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT ck_payroll_allocation_method CHECK (allocation_method IN ('direct','percentage','fixed','equal','formula','ignore'))
);
CREATE INDEX IF NOT EXISTS ix_payroll_source_allocations_employee ON payroll_source_allocations (employee_id, created_at DESC);
