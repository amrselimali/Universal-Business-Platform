-- Payroll phase 2: query optimization hints
-- Version V6.1 -- 21 November 2026

-- Optimized query for employee payroll summary
CREATE OR REPLACE VIEW payroll_employee_summary AS
SELECT
    e.id AS employee_id,
    e.name_ar,
    e.name_en,
    pe.gross_salary,
    pe.insurable_salary,
    (
        SELECT SUM(rl.amount)
        FROM payroll_run_lines rl
        JOIN payroll_runs pr ON rl.run_employee_id IN (
            SELECT id FROM payroll_run_employees WHERE run_id = pr.id
        )
        WHERE rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_taxable = true)
        AND pr.id = (SELECT MAX(id) FROM payroll_runs WHERE company_id = e.company_id)
    ) AS total_tax,
    (
        SELECT SUM(rl.amount)
        FROM payroll_run_lines rl
        JOIN payroll_runs pr ON rl.run_employee_id IN (
            SELECT id FROM payroll_run_employees WHERE run_id = pr.id
        )
        WHERE rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_insurable = true)
        AND pr.id = (SELECT MAX(id) FROM payroll_runs WHERE company_id = e.company_id)
    ) AS total_insurance,
    (
        SELECT SUM(rl.amount)
        FROM payroll_run_lines rl
        JOIN payroll_runs pr ON rl.run_employee_id IN (
            SELECT id FROM payroll_run_employees WHERE run_id = pr.id
        )
        WHERE rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE affects_net_salary = true)
        AND pr.status = 'approved'
        AND pr.id = (SELECT MAX(id) FROM payroll_runs WHERE company_id = e.company_id)
    ) AS net_salary
FROM employees e
JOIN employees pe ON e.id = pe.employee_id;

-- Optimized query for run totals
CREATE OR REPLACE VIEW payroll_run_totals AS
SELECT
    pr.id AS run_id,
    pr.company_id,
    pr.run_code,
    pr.status,
    COUNT(pe.id) AS employee_count,
    SUM(pe.gross_amount) AS total_gross,
    SUM(pe.deductions_amount) AS total_deductions,
    SUM(pe.net_amount) AS total_net,
    AVG(pe.gross_amount) AS average_gross,
    MIN(pe.gross_amount) AS minimum_gross,
    MAX(pe.gross_amount) AS maximum_gross
FROM payroll_runs pr
JOIN payroll_run_employees pe ON pr.id = pe.run_id
GROUP BY pr.id, pr.company_id, pr.run_code, pr.status;

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 168) ON CONFLICT DO NOTHING;