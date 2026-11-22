-- Payroll phase 2: performance monitoring functions
-- Version V6.1 -- 21 November 2026

-- Function to get employee payroll summary
CREATE OR REPLACE FUNCTION payroll_get_employee_summary(
    p_employee_id uuid
)
RETURNS TABLE (
    employee_id uuid,
    gross_salary numeric(19,4),
    insurable_salary numeric(19,4),
    total_tax numeric(19,4),
    total_insurance numeric(19,4),
    net_salary numeric(19,4),
    latest_run_code varchar(50),
    latest_run_date date
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS employee_id,
        pe.gross_salary,
        pe.insurable_salary,
        -- Total tax from latest approved run
        (
            SELECT SUM(rl.amount)
            FROM payroll_run_lines rl
            JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id
            JOIN payroll_runs pr ON pre.run_id = pr.id
            WHERE pre.employee_id = p_employee_id
            AND pr.status = 'approved'
            AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_taxable = true)
        ) AS total_tax,
        -- Total insurance from latest approved run
        (
            SELECT SUM(rl.amount)
            FROM payroll_run_lines rl
            JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id
            JOIN payroll_runs pr ON pre.run_id = pr.id
            WHERE pre.employee_id = p_employee_id
            AND pr.status = 'approved'
            AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_insurable = true)
        ) AS total_insurance,
        -- Net from latest approved run
        (
            SELECT SUM(rl.amount)
            FROM payroll_run_lines rl
            JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id
            JOIN payroll_runs pr ON pre.run_id = pr.id
            WHERE pre.employee_id = p_employee_id
            AND pr.status = 'approved'
        ) AS net_salary,
        -- Latest approved run code
        (
            SELECT run_code
            FROM payroll_runs pr
            WHERE EXISTS (SELECT 1 FROM payroll_run_employees pre2 WHERE pre2.run_id = pr.id AND pre2.employee_id = p_employee_id)
            AND pr.status = 'approved'
            ORDER BY pr.created_at DESC
            LIMIT 1
        ) AS latest_run_code,
        -- Latest run date
        (
            SELECT pr.created_at
            FROM payroll_runs pr
            WHERE EXISTS (SELECT 1 FROM payroll_run_employees pre2 WHERE pre2.run_id = pr.id AND pre2.employee_id = p_employee_id)
            AND pr.status = 'approved'
            ORDER BY pr.created_at DESC
            LIMIT 1
        ) AS latest_run_date
    FROM employees e
    JOIN payroll_employee_profiles pe ON e.id = pe.employee_id
    WHERE e.id = p_employee_id;
END;
$$;

-- Function to get run totals
CREATE OR REPLACE FUNCTION payroll_get_run_totals(
    p_run_id uuid
)
RETURNS TABLE (
    run_id uuid,
    employee_count integer,
    total_gross numeric(19,4),
    total_deductions numeric(19,4),
    total_net numeric(19,4),
    average_gross numeric(19,4)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.id AS run_id,
        COUNT(pe.id) AS employee_count,
        SUM(pe.gross_amount) AS total_gross,
        SUM(pe.deductions_amount) AS total_deductions,
        SUM(pe.net_amount) AS total_net,
        AVG(pe.gross_amount) AS average_gross
    FROM payroll_runs pr
    JOIN payroll_run_employees pe ON pr.id = pe.run_id
    WHERE pr.id = p_run_id
    GROUP BY pr.id;
END;
$$;
