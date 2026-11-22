-- Payroll phase 2: query optimization patterns
-- Version V6.1 -- 21 November 2026

DO $$
DECLARE
    v_has_pre_gross boolean;
    v_has_pre_deductions boolean;
    v_has_pre_net boolean;
BEGIN
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_run_lines') IS NOT NULL
       AND to_regclass('public.payroll_items') IS NOT NULL THEN

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'gross_amount'
        ) INTO v_has_pre_gross;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'deductions_amount'
        ) INTO v_has_pre_deductions;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_run_employees' AND column_name = 'net_amount'
        ) INTO v_has_pre_net;

        PERFORM 1;
        IF v_has_pre_gross AND v_has_pre_deductions AND v_has_pre_net THEN
            PERFORM 1;
        END IF;
    END IF;
END
$$;

-- Reference query patterns (kept as comments so raw migration execution never hits ':' syntax errors):
-- Pattern 1: Get employee's latest payroll run
-- SELECT pr.*
-- FROM payroll_runs pr
-- JOIN payroll_run_employees pre ON pre.run_id = pr.id
-- WHERE pre.employee_id = :employee_id
-- ORDER BY pr.created_at DESC
-- LIMIT 1;

-- Pattern 2: Get employee's earnings from a specific run
-- SELECT rl.amount, it.name_ar, it.name_en
-- FROM payroll_run_lines rl
-- JOIN payroll_items it ON rl.payroll_item_id = it.id
-- WHERE rl.run_employee_id IN (
--     SELECT id FROM payroll_run_employees WHERE run_id = :run_id AND employee_id = :employee_id
-- )
-- AND rl.payroll_item_id = :item_id;

-- Pattern 3: Get run totals efficiently
-- SELECT pr.run_code,
--        COUNT(pe.id) AS employee_count,
--        SUM(pe.gross_amount) AS total_gross,
--        SUM(pe.deductions_amount) AS total_deductions,
--        SUM(pe.net_amount) AS total_net
-- FROM payroll_runs pr
-- JOIN payroll_run_employees pe ON pr.id = pe.run_id
-- WHERE pr.status = 'approved'
-- GROUP BY pr.id, pr.run_code;

-- Pattern 4: Get employee's full history across runs
-- SELECT rl.*, pr.run_code, pr.status, pr.created_at
-- FROM payroll_run_lines rl
-- JOIN payroll_run_employees pre ON rl.run_employee_id = pre.id
-- JOIN payroll_runs pr ON pre.run_id = pr.id
-- WHERE pre.employee_id = :employee_id
-- ORDER BY pr.created_at DESC;

-- Pattern 5: Get company's payroll summary for a period
-- SELECT pr.run_code,
--        COUNT(DISTINCT pre.employee_id) AS employee_count,
--        SUM(pre.gross_amount) AS total_gross,
--        SUM(pre.net_amount) AS total_net
-- FROM payroll_runs pr
-- JOIN payroll_run_employees pre ON pr.id = pre.run_id
-- WHERE pr.company_id = :company_id
-- AND pr.created_at >= :start_date
-- AND pr.created_at <= :end_date
-- GROUP BY pr.id, pr.run_code;