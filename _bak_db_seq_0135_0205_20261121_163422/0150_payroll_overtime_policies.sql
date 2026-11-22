-- Payroll phase 2: overtime policies
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_overtime_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    calculation_type varchar(30) NOT NULL, -- 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUOTA'
    base_hours numeric(10,2) NOT NULL DEFAULT 0, -- ساعات الأساس قبل الإضافي
    overtime_rate numeric(9,6) NOT NULL DEFAULT 1.5, -- معدل الضرب (1.5 للعطلات العادية)
    maximum_hours numeric(10,2), -- الحد الأقصى لساعات الإضافي في الفترة
    maximum_amount numeric(19,4), -- الحد الأقصى للمبلغ
    applicable_days varchar(100), -- 'WEEKDAYS', 'WEEKENDS', 'ALL_DAYS'
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_overtime_policies_company ON payroll_overtime_policies (company_id);

-- Overtime calculation log
CREATE TABLE IF NOT EXISTS payroll_overtime_calculations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_employee_id uuid NOT NULL REFERENCES payroll_run_employees(id) ON DELETE CASCADE,
    policy_id uuid NOT NULL REFERENCES payroll_overtime_policies(id) ON DELETE RESTRICT,
    work_date date NOT NULL,
    regular_hours numeric(10,2) NOT NULL DEFAULT 0,
    overtime_hours numeric(10,2) NOT NULL DEFAULT 0,
    overtime_rate numeric(9,6) NOT NULL DEFAULT 1.5,
    overtime_amount numeric(19,4) NOT NULL DEFAULT 0,
    calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_overtime_employee ON payroll_overtime_calculations (run_employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_overtime_policy ON payroll_overtime_calculations (policy_id);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 149) ON CONFLICT DO NOTHING;