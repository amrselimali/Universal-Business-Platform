-- Payroll phase 2: quality assurance
-- Version V6.1 -- 21 November 2026

-- QA test cases
CREATE TABLE IF NOT EXISTS payroll_qa_test_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    test_case_id varchar(50) NOT NULL, -- 'PAY-001' to 'PAY-056'
    test_case_name varchar(200) NOT NULL,
    test_description text,
    test_category varchar(50) NOT NULL, -- 'CALCULATION', 'VALIDATION', 'PERFORMANCE', 'SECURITY', 'DATA_INTEGRITY'
    test_priority varchar(30) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    test_data jsonb, -- JSON with test data parameters
    expected_result jsonb, -- JSON with expected outcomes
    test_status varchar(30) DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED'
    executed_at timestamptz,
    execution_time_ms integer,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE payroll_qa_test_cases
    ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE payroll_qa_test_cases
    ADD COLUMN IF NOT EXISTS test_category varchar(50);
ALTER TABLE payroll_qa_test_cases
    ADD COLUMN IF NOT EXISTS test_status varchar(30) DEFAULT 'PENDING';

DO $$
BEGIN
    IF to_regclass('public.payroll_qa_test_cases') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_qa_test_cases' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_qa_tests_company ON payroll_qa_test_cases (company_id);
    END IF;

    IF to_regclass('public.payroll_qa_test_cases') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_qa_test_cases' AND column_name = 'test_category') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_qa_tests_category ON payroll_qa_test_cases (test_category);
    END IF;

    IF to_regclass('public.payroll_qa_test_cases') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_qa_test_cases' AND column_name = 'test_status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_qa_tests_status ON payroll_qa_test_cases (test_status);
    END IF;
END$$;

-- QA test runs
CREATE TABLE IF NOT EXISTS payroll_qa_test_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    test_run_name varchar(100) NOT NULL,
    test_run_date timestamptz NOT NULL DEFAULT now(),
    test_scenarios_covered integer NOT NULL DEFAULT 0,
    total_test_cases integer NOT NULL DEFAULT 0,
    passed_cases integer NOT NULL DEFAULT 0,
    failed_cases integer NOT NULL DEFAULT 0,
    skipped_cases integer NOT NULL DEFAULT 0,
    overall_status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'PASSED', 'FAILED'
    average_execution_time_ms integer,
    total_execution_time_ms integer,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE payroll_qa_test_runs
    ADD COLUMN IF NOT EXISTS company_id uuid;

DO $$
BEGIN
    IF to_regclass('public.payroll_qa_test_runs') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_qa_test_runs' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_qa_runs_company ON payroll_qa_test_runs (company_id);
    END IF;
END$$;

-- QA defect tracking
CREATE TABLE IF NOT EXISTS payroll_qa_defects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    defect_id varchar(50),
    related_test_case_id uuid REFERENCES payroll_qa_test_cases(id) ON DELETE SET NULL,
    defect_description text NOT NULL,
    defect_severity varchar(30) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    defect_status varchar(30) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'
    discovered_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text
);

ALTER TABLE payroll_qa_defects
    ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE payroll_qa_defects
    ADD COLUMN IF NOT EXISTS defect_status varchar(30) DEFAULT 'OPEN';

DO $$
BEGIN
    IF to_regclass('public.payroll_qa_defects') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_qa_defects' AND column_name = 'company_id') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_qa_defects_company ON payroll_qa_defects (company_id);
    END IF;

    IF to_regclass('public.payroll_qa_defects') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_qa_defects' AND column_name = 'defect_status') THEN
        CREATE INDEX IF NOT EXISTS ix_payroll_qa_defects_status ON payroll_qa_defects (defect_status);
    END IF;
END$$;