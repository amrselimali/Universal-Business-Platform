-- Payroll phase 2: employee contracts extension
-- Version V6.1 -- 21 November 2026

-- Extend existing employee_contracts with additional fields
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS work_permit_number varchar(50);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS nationality_code varchar(20);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS tax_treatment_code varchar(50);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS insurance_status_code varchar(50);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS non_working_wives integer NOT NULL DEFAULT 0 CHECK (non_working_wives >= 0);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS dependents integer NOT NULL DEFAULT 0 CHECK (dependents >= 0);

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS ix_employee_contracts_nationality ON employee_contracts (nationality_code);
CREATE INDEX IF NOT EXISTS ix_employee_contracts_insurance ON employee_contracts (insurance_status_code);

-- Update version


