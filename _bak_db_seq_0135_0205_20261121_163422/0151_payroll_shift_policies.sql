-- Payroll phase 2: shift policies
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_shift_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    policy_type varchar(30) NOT NULL, -- 'STANDARD', 'NIGHT', 'ROTATING', 'FLEXIBLE', 'CUSTOM'
    starts_at time NOT NULL,
    ends_at time,
    break_duration integer NOT NULL DEFAULT 60, -- دقائق
    overtime_after_hours numeric(5,2) NOT NULL DEFAULT 8, -- ساعات بعدها يصبح الإضافي
    night_shift_premium numeric(9,6) DEFAULT 0.2, -- علاوة الليل 20%
    weekend_multiplier numeric(9,6) DEFAULT 1.5, -- مضاعف العطلات 1.5
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_shift_policies_company ON payroll_shift_policies (company_id);

-- Shift assignments
CREATE TABLE IF NOT EXISTS employee_shift_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    shift_policy_id uuid REFERENCES payroll_shift_policies(id) ON DELETE SET NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS ix_employee_shifts_employee ON employee_shift_assignments (employee_id, effective_from);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 151) ON CONFLICT DO NOTHING;