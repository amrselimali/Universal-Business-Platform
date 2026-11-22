-- Payroll phase 2: employee deductions management
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_deduction_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    deduction_type varchar(30) NOT NULL, -- 'STATUTORY', ' VOLUNTARY', 'COMPANY_POLICY', 'COURT_ORDER'
    applies_to varchar(30) NOT NULL, -- 'ALL_EMPLOYEES', 'SPECIFIC_ROLES', 'SPECIFIC_EMPLOYEES'
    priority integer NOT NULL DEFAULT 0,
    is_percentage boolean NOT NULL DEFAULT false,
    percentage numeric(9,6) DEFAULT 0,
    minimum_amount numeric(19,4),
    maximum_amount numeric(19,4),
    applies_to_earnings varchar(100), -- 'GROSS', 'NET', 'BASE_SALARY', 'ALLOWANCES'
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_deduction_policies_company ON payroll_deduction_policies (company_id);

-- Employee-specific deduction overrides
CREATE TABLE IF NOT EXISTS employee_deduction_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    deduction_policy_id uuid NOT NULL REFERENCES payroll_deduction_policies(id) ON DELETE RESTRICT,
    custom_percentage numeric(9,6),
    custom_amount numeric(19,4),
    is_active boolean NOT NULL DEFAULT true,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS ix_employee_deduction_overrides_employee ON employee_deduction_overrides (employee_id);
CREATE INDEX IF NOT EXISTS ix_employee_deduction_overrides_policy ON employee_deduction_overrides (deduction_policy_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 152) ON CONFLICT DO NOTHING;