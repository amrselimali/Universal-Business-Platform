-- Payroll phase 1: employee payroll profile, effective-dated contracts and allocation settings.
CREATE TABLE IF NOT EXISTS payroll_employee_profiles (
	employee_id uuid PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT,
	status varchar(20) NOT NULL DEFAULT 'draft',
	national_id varchar(50),
	passport_number varchar(50),
	insurance_number varchar(50),
	tax_treatment_code varchar(50),
	insurance_status_code varchar(50),
	nationality_code varchar(20),
	work_permit_status varchar(30),
	service_end_date date,
	working_hours_per_month integer CHECK (working_hours_per_month IS NULL OR working_hours_per_month >= 0),
	time_management_enabled boolean NOT NULL DEFAULT false,
	salary_suspended boolean NOT NULL DEFAULT false,
	non_working_wives integer NOT NULL DEFAULT 0 CHECK (non_working_wives >= 0),
	dependents integer NOT NULL DEFAULT 0 CHECK (dependents >= 0),
	version integer NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz,
	CONSTRAINT ck_payroll_employee_status CHECK (status IN ('draft','incomplete','approved','suspended','terminated'))
);

CREATE TABLE IF NOT EXISTS company_employee_field_settings (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	company_id uuid,
	field_code varchar(100) NOT NULL,
	is_visible boolean NOT NULL DEFAULT true,
	is_required boolean NOT NULL DEFAULT false,
	effective_from date NOT NULL,
	effective_to date,
	version integer NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT ck_employee_field_visibility CHECK (is_visible OR NOT is_required),
	CONSTRAINT ck_employee_field_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
	CONSTRAINT ux_employee_field_setting UNIQUE (company_id, field_code, effective_from)
);

CREATE TABLE IF NOT EXISTS employee_contracts (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
	effective_from date NOT NULL,
	effective_to date,
	currency_code varchar(20) NOT NULL,
	gross_salary numeric(19,4) NOT NULL CHECK (gross_salary >= 0),
	insurable_salary numeric(19,4) CHECK (insurable_salary IS NULL OR insurable_salary >= 0),
	is_approved boolean NOT NULL DEFAULT false,
	version integer NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now(),
	created_by uuid REFERENCES users(id) ON DELETE SET NULL,
	CONSTRAINT ck_employee_contract_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS ix_employee_contracts_effective ON employee_contracts (employee_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS employee_cost_centers (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
	branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
	cost_center_id uuid NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
	allocation_percent numeric(7,4) NOT NULL CHECK (allocation_percent > 0 AND allocation_percent <= 100),
	effective_from date NOT NULL,
	effective_to date,
	CONSTRAINT ck_employee_cost_center_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS ix_employee_cost_centers_effective ON employee_cost_centers (employee_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS employee_payment_settings (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
	payment_method_code varchar(30) NOT NULL,
	amount numeric(19,4) CHECK (amount IS NULL OR amount >= 0),
	percentage numeric(7,4) CHECK (percentage IS NULL OR (percentage > 0 AND percentage <= 100)),
	account_reference varchar(200),
	effective_from date NOT NULL,
	effective_to date,
	CONSTRAINT ck_employee_payment_value CHECK (amount IS NOT NULL OR percentage IS NOT NULL),
	CONSTRAINT ck_employee_payment_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS ix_employee_payment_settings_effective ON employee_payment_settings (employee_id, effective_from DESC);
