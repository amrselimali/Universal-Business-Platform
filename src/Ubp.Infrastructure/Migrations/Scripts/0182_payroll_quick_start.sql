-- Payroll phase 2: quick start guides
-- Version V6.1 -- 21 November 2026

-- Quick start: Setting up payroll for a new company
CREATE TABLE IF NOT EXISTS payroll_quick_start_guides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    guide_name varchar(100) NOT NULL,
    guide_type varchar(50) NOT NULL, -- 'INITIAL_SETUP', 'MIGRATION', 'CONFIGURATION', 'TRAINING'
    step_order integer NOT NULL,
    step_description text NOT NULL,
    related_script varchar(100),
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_quickstart_company ON payroll_quick_start_guides (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_quickstart_type ON payroll_quick_start_guides (guide_type);

-- Sample data scripts
CREATE TABLE IF NOT EXISTS payroll_sample_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    data_set_name varchar(100) NOT NULL,
    data_set_type varchar(50) NOT NULL, -- 'SAMPLE', 'TEST', 'DEMO', 'TRAINING'
    record_count integer NOT NULL DEFAULT 0,
    includes_test_employees boolean NOT NULL DEFAULT false,
    includes_test_runs boolean NOT NULL DEFAULT false,
    includes_test_policies boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_sampledata_company ON payroll_sample_data (company_id);

-- Implementation checklist
CREATE TABLE IF NOT EXISTS payroll_implementation_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    checklist_item varchar(200) NOT NULL,
    category varchar(50) NOT NULL, -- 'DATABASE', 'APPLICATION', 'UI', 'TESTING', 'DEPLOYMENT'
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    verified_at timestamptz,
    notes text
);

CREATE INDEX IF NOT EXISTS ix_payroll_checklist_company ON payroll_implementation_checklist (company_id);
