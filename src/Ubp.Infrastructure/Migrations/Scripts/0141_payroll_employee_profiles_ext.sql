-- Payroll phase 2: employee profiles extension
-- Version V6.1 -- 21 November 2026

-- Extend existing payroll_employee_profiles with additional fields
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS nationality_code varchar(20);
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS insurance_number varchar(50);
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS tax_treatment_code varchar(50);
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS work_permit_status varchar(30);
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS service_end_date date;
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS working_hours_per_month integer CHECK (working_hours_per_month IS NULL OR working_hours_per_month >= 0);
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS time_management_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE payroll_employee_profiles ADD COLUMN IF NOT EXISTS salary_suspended boolean NOT NULL DEFAULT false;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS ix_payroll_employee_nationality ON payroll_employee_profiles (nationality_code);
CREATE INDEX IF NOT EXISTS ix_payroll_employee_insurance ON payroll_employee_profiles (insurance_number);

-- Update version


