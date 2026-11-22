-- Payroll phase 2: essential views for UI integration
-- Version V6.1 -- 21 November 2026

-- View: Employee payroll summary with all components
CREATE OR REPLACE VIEW payroll_employee_full_summary AS
SELECT
    e.id AS employee_id,
    e.name_ar,
    e.name_en,
    e.national_id,
    pe.gross_salary,
    pe.insurable_salary,
    pe.work_permit_status,
    pe.tax_treatment_code,
    pe.insurance_status_code,
    pe.nationality_code,
    pe.non_working_wives,
    pe.dependents,
    -- Total earnings from latest run
    (
        SELECT SUM(rl.amount)
        FROM payroll_run_lines rl
        JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id
        JOIN payroll_runs pr ON pre.run_id = pr.id
        WHERE pre.employee_id = e.id
        AND pr.status = 'approved'
        AND rl.payroll_item_id IN (
            SELECT id FROM payroll_items WHERE is_variable = true
        )
    ) AS total_variable_earnings,
    -- Total deductions from latest run
    (
        SELECT SUM(rl.amount)
        FROM payroll_run_lines rl
        JOIN payroll_run_employees pre2 ON rl.run_employee_id = pre2.id
        JOIN payroll_runs pr2 ON pre2.run_id = pr2.id
        WHERE pre2.employee_id = e.id
        AND pr2.status = 'approved'
        AND rl.payroll_item_id IN (
            SELECT id FROM payroll_items WHERE is_taxable = true OR is_insurable = true
        )
    ) AS total_deductions,
    -- Net from latest approved run
    (
        SELECT SUM(rl.amount)
        FROM payroll_run_lines rl
        JOIN payroll_run_employees pre3 ON rl.run_employee_id = pre3.id
        JOIN payroll_runs pr3 ON pre3.run_id = pr3.id
        WHERE pre3.employee_id = e.id
        AND pr3.status = 'approved'
    ) AS latest_net_salary,
    -- Latest run info
    (
        SELECT run_code
        FROM payroll_runs pr4
        WHERE pr4.company_id = e.company_id
        AND EXISTS (SELECT 1 FROM payroll_run_employees pre4 WHERE pre4.run_id = pr4.id AND pre4.employee_id = e.id)
        AND pr4.status = 'approved'
        ORDER BY pr4.created_at DESC
        LIMIT 1
    ) AS latest_approved_run,
    -- Total leaves taken this year
    (
        SELECT SUM(days)
        FROM leave_requests lr
        WHERE lr.employee_id = e.id
        AND lr.status = 'approved'
        AND lr.from_date >= DATE_TRUNC('year', CURRENT_DATE)
    ) AS leaves_taken_this_year,
    -- Outstanding loans
    (
        SELECT COALESCE(SUM(ili.outstanding_balance), 0)
        FROM employee_loans el
        JOIN employee_loan_installments ili ON el.id = ili.loan_id
        WHERE el.employee_id = e.id
        AND el.status = 'active'
    ) AS outstanding_loans
FROM employees e
JOIN payroll_employee_profiles pe ON e.id = pe.employee_id;

-- View: Department/ cost center payroll summary
CREATE OR REPLACE VIEW payroll_department_summary AS
SELECT
    c.name_ar AS cost_center_name,
    c.name_en AS cost_center_name_en,
    e.name_ar AS department_head,
    e.name_en AS department_head_en,
    COUNT(DISTINCT e2.id) AS employee_count,
    SUM(pe.gross_salary) AS total_gross_salary,
    AVG(pe.gross_salary) AS average_gross_salary,
    -- Latest run stats
    (
        SELECT COUNT(*)
        FROM payroll_runs pr
        JOIN payroll_run_employees pre ON pr.id = pre.run_id
        WHERE pre.company_id = c.company_id
        AND pr.status = 'approved'
    ) AS approved_runs_count
FROM cost_centers c
LEFT JOIN employees e ON c.id = e.cost_center_id AND e.is_active = true
LEFT JOIN employees e2 ON c.company_id = e2.company_id AND e2.is_active = true
LEFT JOIN payroll_employee_profiles pe ON e2.id = pe.employee_id
GROUP BY c.id, c.name_ar, c.name_en, e.name_ar, e.name_en;

-- View: Company payroll overview
CREATE OR REPLACE VIEW payroll_company_overview AS
SELECT
    c.company_id,
    c.name_ar AS company_name_ar,
    c.name_en AS company_name_en,
    COUNT(DISTINCT e.id) AS total_employees,
    COUNT(DISTINCT CASE WHEN e.is_active THEN e.id ELSE NULL END) AS active_employees,
    COUNT(DISTINCT CASE WHEN NOT e.is_active THEN e.id ELSE NULL END) AS inactive_employees,
    SUM(pe.gross_salary) AS total_monthly_gross,
    AVG(pe.gross_salary) AS average_monthly_gross,
    -- Run statistics
    (
        SELECT COUNT(*)
        FROM payroll_runs pr
        WHERE pr.company_id = c.company_id
    ) AS total_runs,
    (
        SELECT COUNT(*)
        FROM payroll_runs pr
        WHERE pr.company_id = c.company_id
        AND pr.status = 'approved'
    ) AS approved_runs,
    (
        SELECT SUM(pe.net_amount)
        FROM payroll_run_employees pre
        JOIN payroll_runs pr ON pre.run_id = pr.id
        WHERE pr.company_id = c.company_id
        AND pr.status = 'approved'
    ) AS total_monthly_net
FROM companies c
JOIN employees e ON c.id = e.company_id
JOIN payroll_employee_profiles pe ON e.id = pe.employee_id
GROUP BY c.id, c.name_ar, c.name_en;

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 173) ON CONFLICT DO NOTHING;