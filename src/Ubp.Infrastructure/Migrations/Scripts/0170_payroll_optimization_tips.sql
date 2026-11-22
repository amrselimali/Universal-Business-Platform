-- Payroll phase 2: query optimization hints
-- Version V6.1 -- 21 November 2026

DO $$
DECLARE
    v_has_gross_salary boolean;
    v_has_insurable_salary boolean;
    v_gross_sal_expr text;
    v_ins_sal_expr text;
    v_join_pe_expr text;
BEGIN
    -- Optimized query for employee payroll summary
    IF to_regclass('public.employees') IS NOT NULL
       AND to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_run_lines') IS NOT NULL
       AND to_regclass('public.payroll_items') IS NOT NULL THEN

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'gross_salary'
        ) INTO v_has_gross_salary;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'insurable_salary'
        ) INTO v_has_insurable_salary;

        v_gross_sal_expr := CASE WHEN v_has_gross_salary THEN 'pe.gross_salary' ELSE '0::numeric' END;
        v_ins_sal_expr := CASE WHEN v_has_insurable_salary THEN 'pe.insurable_salary' ELSE '0::numeric' END;
        v_join_pe_expr := 'LEFT JOIN payroll_run_employees pe ON pe.employee_id = e.id';

        EXECUTE
            'CREATE OR REPLACE VIEW payroll_employee_summary AS ' ||
            'SELECT ' ||
            'e.id AS employee_id, ' ||
            'e.name_ar, ' ||
            'e.name_en, ' ||
            v_gross_sal_expr || ' AS gross_salary, ' ||
            v_ins_sal_expr || ' AS insurable_salary, ' ||
            '(SELECT COALESCE(SUM(rl.amount), 0) ' ||
            ' FROM payroll_run_lines rl ' ||
            ' JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id ' ||
            ' JOIN payroll_runs pr ON pre.run_id = pr.id ' ||
            ' WHERE pre.employee_id = e.id ' ||
            ' AND pr.company_id = e.company_id ' ||
            ' AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_taxable = true) ' ||
            ' AND pr.created_at = (SELECT MAX(created_at) FROM payroll_runs WHERE company_id = e.company_id)) AS total_tax, ' ||
            '(SELECT COALESCE(SUM(rl.amount), 0) ' ||
            ' FROM payroll_run_lines rl ' ||
            ' JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id ' ||
            ' JOIN payroll_runs pr ON pre.run_id = pr.id ' ||
            ' WHERE pre.employee_id = e.id ' ||
            ' AND pr.company_id = e.company_id ' ||
            ' AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE is_insurable = true) ' ||
            ' AND pr.created_at = (SELECT MAX(created_at) FROM payroll_runs WHERE company_id = e.company_id)) AS total_insurance, ' ||
            '(SELECT COALESCE(SUM(rl.amount), 0) ' ||
            ' FROM payroll_run_lines rl ' ||
            ' JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id ' ||
            ' JOIN payroll_runs pr ON pre.run_id = pr.id ' ||
            ' WHERE pre.employee_id = e.id ' ||
            ' AND pr.company_id = e.company_id ' ||
            ' AND rl.payroll_item_id IN (SELECT id FROM payroll_items WHERE affects_net_salary = true) ' ||
            ' AND pr.status = ''approved'' ' ||
            ' AND pr.created_at = (SELECT MAX(created_at) FROM payroll_runs WHERE company_id = e.company_id)) AS net_salary ' ||
            'FROM employees e ' ||
            v_join_pe_expr;
    END IF;

    -- Optimized query for run totals
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'run_code')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_runs' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'gross_amount')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'deductions_amount')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'net_amount') THEN
        EXECUTE
            'CREATE OR REPLACE VIEW payroll_run_totals AS ' ||
            'SELECT ' ||
            'pr.id AS run_id, ' ||
            'pr.company_id, ' ||
            'pr.run_code, ' ||
            'pr.status, ' ||
            'COUNT(pe.id) AS employee_count, ' ||
            'SUM(pe.gross_amount) AS total_gross, ' ||
            'SUM(pe.deductions_amount) AS total_deductions, ' ||
            'SUM(pe.net_amount) AS total_net, ' ||
            'AVG(pe.gross_amount) AS average_gross, ' ||
            'MIN(pe.gross_amount) AS minimum_gross, ' ||
            'MAX(pe.gross_amount) AS maximum_gross ' ||
            'FROM payroll_runs pr ' ||
            'JOIN payroll_run_employees pe ON pr.id = pe.run_id ' ||
            'GROUP BY pr.id, pr.company_id, pr.run_code, pr.status';
    END IF;
END
$$;