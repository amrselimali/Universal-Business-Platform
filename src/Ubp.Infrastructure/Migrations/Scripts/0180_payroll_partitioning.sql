-- Payroll phase 2: table partitioning strategy
-- Version V6.1 -- 21 November 2026

CREATE SCHEMA IF NOT EXISTS payroll;

-- Partition payroll_runs by company and date range
SELECT 'SELECT ''Partition payroll_runs by company_id and created_at'' AS comment;';

-- Partition payroll_run_employees by run_id
SELECT 'SELECT ''Partition payroll_run_employees by run_id'' AS comment;';

-- Partition payroll_run_lines by run_id
SELECT 'SELECT ''Partition payroll_run_lines by run_id'' AS comment;';

-- Partition payroll_tax_balances by company and period
SELECT 'SELECT ''Partition payroll_tax_balances by company_id and tax_period'' AS comment;';

-- Partition payroll_insurance_balances by company
SELECT 'SELECT ''Partition payroll_insurance_balances by company_id'' AS comment;';

-- Partition payroll_audit_log by date
SELECT 'SELECT ''Partition payroll_audit_log by changed_at'' AS comment;';

-- Suggested partitioning strategy
CREATE OR REPLACE FUNCTION payroll.suggest_partition_strategy()
RETURNS TABLE (
    table_name varchar(100),
    partition_key varchar(50),
    partition_description text
)
LANGUAGE sql
AS $$
SELECT
    'payroll_runs'::varchar(100) AS table_name,
    'company_id, created_at'::varchar(50) AS partition_key,
    'Range partitioning by company_id, then monthly ranges on created_at'::text AS partition_description
UNION ALL
SELECT
    'payroll_run_employees'::varchar(100),
    'run_id'::varchar(50),
    'List partitioning by run_id'::text
UNION ALL
SELECT
    'payroll_run_lines'::varchar(100),
    'run_id'::varchar(50),
    'List partitioning by run_id'::text
UNION ALL
SELECT
    'payroll_tax_balances'::varchar(100),
    'company_id, tax_period_id'::varchar(50),
    'Range partitioning by company_id, then by tax period'::text
UNION ALL
SELECT
    'payroll_insurance_balances'::varchar(100),
    'company_id'::varchar(50),
    'List partitioning by company_id'::text
UNION ALL
SELECT
    'payroll_audit_log'::varchar(100),
    'changed_at'::varchar(50),
    'Range partitioning by changed_at (monthly)'::text;
$$;