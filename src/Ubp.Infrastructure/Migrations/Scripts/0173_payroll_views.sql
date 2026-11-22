-- Payroll phase 2: essential views for UI integration
-- Version V6.1 -- 21 November 2026

DO $$
DECLARE
    v_has_national_id boolean;
    v_has_work_permit boolean;
    v_has_tax_treatment boolean;
    v_has_ins_status boolean;
    v_has_nationality boolean;
    v_has_wives boolean;
    v_has_dependents boolean;
    v_has_is_variable boolean;
    v_has_net_amount boolean;
BEGIN
    -- 1) View: Employee payroll summary with all components
    IF to_regclass('public.employees') IS NOT NULL
       AND to_regclass('public.payroll_employee_profiles') IS NOT NULL
       AND to_regclass('public.payroll_run_lines') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_items') IS NOT NULL THEN

        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'national_id') INTO v_has_national_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_employee_profiles' AND column_name = 'work_permit_status') INTO v_has_work_permit;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_employee_profiles' AND column_name = 'tax_treatment_code') INTO v_has_tax_treatment;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_employee_profiles' AND column_name = 'insurance_status_code') INTO v_has_ins_status;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_employee_profiles' AND column_name = 'nationality_code') INTO v_has_nationality;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_employee_profiles' AND column_name = 'non_working_wives') INTO v_has_wives;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_employee_profiles' AND column_name = 'dependents') INTO v_has_dependents;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_items' AND column_name = 'is_variable') INTO v_has_is_variable;

        EXECUTE
            'CREATE OR REPLACE VIEW payroll_employee_full_summary AS ' ||
            'SELECT ' ||
            'e.id AS employee_id, ' ||
            'e.name_ar, ' ||
            'e.name_en, ' ||
            CASE WHEN v_has_national_id THEN 'e.national_id' ELSE 'NULL::varchar' END || ' AS national_id, ' ||
            'pe.gross_salary, ' ||
            'pe.insurable_salary, ' ||
            CASE WHEN v_has_work_permit THEN 'pe.work_permit_status' ELSE 'NULL::varchar' END || ' AS work_permit_status, ' ||
            CASE WHEN v_has_tax_treatment THEN 'pe.tax_treatment_code' ELSE 'NULL::varchar' END || ' AS tax_treatment_code, ' ||
            CASE WHEN v_has_ins_status THEN 'pe.insurance_status_code' ELSE 'NULL::varchar' END || ' AS insurance_status_code, ' ||
            CASE WHEN v_has_nationality THEN 'pe.nationality_code' ELSE 'NULL::varchar' END || ' AS nationality_code, ' ||
            CASE WHEN v_has_wives THEN 'pe.non_working_wives' ELSE '0::integer' END || ' AS non_working_wives, ' ||
            CASE WHEN v_has_dependents THEN 'pe.dependents' ELSE '0::integer' END || ' AS dependents, ' ||
            '(SELECT COALESCE(SUM(rl.amount), 0) FROM payroll_run_lines rl ' ||
            ' JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id ' ||
            ' JOIN payroll_runs pr ON pre.run_id = pr.id ' ||
            ' WHERE pre.employee_id = e.id AND pr.status = ''approved''' ||
            CASE WHEN v_has_is_variable THEN ' AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_variable = true)' ELSE '' END ||
            ') AS total_variable_earnings, ' ||
            '(SELECT COALESCE(SUM(rl.amount), 0) FROM payroll_run_lines rl ' ||
            ' JOIN payroll_run_employees pre2 ON rl.run_employee_id = pre2.id ' ||
            ' JOIN payroll_runs pr2 ON pre2.run_id = pr2.id ' ||
            ' WHERE pre2.employee_id = e.id AND pr2.status = ''approved'' ' ||
            ' AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_taxable = true OR is_insurable = true)) AS total_deductions, ' ||
            '(SELECT COALESCE(SUM(rl.amount), 0) FROM payroll_run_lines rl ' ||
            ' JOIN payroll_run_employees pre3 ON rl.run_employee_id = pre3.id ' ||
            ' JOIN payroll_runs pr3 ON pre3.run_id = pr3.id ' ||
            ' WHERE pre3.employee_id = e.id AND pr3.status = ''approved'') AS latest_net_salary, ' ||
            '(SELECT run_code FROM payroll_runs pr4 ' ||
            ' WHERE pr4.company_id = e.company_id ' ||
            ' AND EXISTS (SELECT 1 FROM payroll_run_employees pre4 WHERE pre4.run_id = pr4.id AND pre4.employee_id = e.id) ' ||
            ' AND pr4.status = ''approved'' ORDER BY pr4.created_at DESC LIMIT 1) AS latest_approved_run, ' ||
            CASE WHEN to_regclass('public.leave_requests') IS NOT NULL THEN
                '(SELECT COALESCE(SUM(days), 0) FROM leave_requests lr WHERE lr.employee_id = e.id AND lr.status = ''approved'' AND lr.from_date >= DATE_TRUNC(''year'', CURRENT_DATE))'
            ELSE '0::numeric' END || ' AS leaves_taken_this_year, ' ||
            CASE WHEN to_regclass('public.employee_loans') IS NOT NULL AND to_regclass('public.employee_loan_installments') IS NOT NULL THEN
                '(SELECT COALESCE(SUM(ili.outstanding_balance), 0) FROM employee_loans el JOIN employee_loan_installments ili ON el.id = ili.loan_id WHERE el.employee_id = e.id AND el.status = ''active'')'
            ELSE '0::numeric' END || ' AS outstanding_loans ' ||
            'FROM employees e ' ||
            'JOIN payroll_employee_profiles pe ON e.id = pe.employee_id';
    END IF;

    -- 2) View: Department / cost center payroll summary
    IF to_regclass('public.cost_centers') IS NOT NULL
       AND to_regclass('public.employees') IS NOT NULL
       AND to_regclass('public.payroll_employee_profiles') IS NOT NULL
       AND to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'cost_center_id') THEN

        EXECUTE
            'CREATE OR REPLACE VIEW payroll_department_summary AS ' ||
            'SELECT ' ||
            'c.name_ar AS cost_center_name, ' ||
            'c.name_en AS cost_center_name_en, ' ||
            'e.name_ar AS department_head, ' ||
            'e.name_en AS department_head_en, ' ||
            'COUNT(DISTINCT e2.id) AS employee_count, ' ||
            'COALESCE(SUM(pe.gross_salary), 0) AS total_gross_salary, ' ||
            'COALESCE(AVG(pe.gross_salary), 0) AS average_gross_salary, ' ||
            '(SELECT COUNT(*) FROM payroll_runs pr JOIN payroll_run_employees pre ON pr.id = pre.run_id ' ||
            ' WHERE pre.company_id = c.company_id AND pr.status = ''approved'') AS approved_runs_count ' ||
            'FROM cost_centers c ' ||
            'LEFT JOIN employees e ON c.id = e.cost_center_id AND e.is_active = true ' ||
            'LEFT JOIN employees e2 ON c.company_id = e2.company_id AND e2.is_active = true ' ||
            'LEFT JOIN payroll_employee_profiles pe ON e2.id = pe.employee_id ' ||
            'GROUP BY c.id, c.company_id, c.name_ar, c.name_en, e.name_ar, e.name_en';
    END IF;

    -- 3) View: Company payroll overview
    IF to_regclass('public.companies') IS NOT NULL
       AND to_regclass('public.employees') IS NOT NULL
       AND to_regclass('public.payroll_employee_profiles') IS NOT NULL
       AND to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL THEN

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'net_amount'
        ) INTO v_has_net_amount;

        EXECUTE
            'CREATE OR REPLACE VIEW payroll_company_overview AS ' ||
            'SELECT ' ||
            'c.id AS company_id, ' ||
            'c.name_ar AS company_name_ar, ' ||
            'c.name_en AS company_name_en, ' ||
            'COUNT(DISTINCT e.id) AS total_employees, ' ||
            'COUNT(DISTINCT CASE WHEN e.is_active THEN e.id ELSE NULL END) AS active_employees, ' ||
            'COUNT(DISTINCT CASE WHEN NOT e.is_active THEN e.id ELSE NULL END) AS inactive_employees, ' ||
            'COALESCE(SUM(pe.gross_salary), 0) AS total_monthly_gross, ' ||
            'COALESCE(AVG(pe.gross_salary), 0) AS average_monthly_gross, ' ||
            '(SELECT COUNT(*) FROM payroll_runs pr WHERE pr.company_id = c.id) AS total_runs, ' ||
            '(SELECT COUNT(*) FROM payroll_runs pr WHERE pr.company_id = c.id AND pr.status = ''approved'') AS approved_runs, ' ||
            CASE WHEN v_has_net_amount THEN
                '(SELECT COALESCE(SUM(pre.net_amount), 0) FROM payroll_run_employees pre JOIN payroll_runs pr ON pre.run_id = pr.id WHERE pr.company_id = c.id AND pr.status = ''approved'')'
            ELSE '0::numeric' END || ' AS total_monthly_net ' ||
            'FROM companies c ' ||
            'JOIN employees e ON c.id = e.company_id ' ||
            'JOIN payroll_employee_profiles pe ON e.id = pe.employee_id ' ||
            'GROUP BY c.id, c.name_ar, c.name_en';
    END IF;
END
$$;