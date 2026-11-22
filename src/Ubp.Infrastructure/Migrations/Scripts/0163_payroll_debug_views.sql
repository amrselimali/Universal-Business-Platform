-- Payroll phase 2: debug and view definitions
-- Version V6.1 -- 21 November 2026

DO $$
DECLARE
    v_has_pr_rate boolean;
    v_rate_expr text;
    v_has_pgi_policy_id boolean;
    v_join_expr text;
    v_has_target_net boolean;
    v_has_achieved_net boolean;
    v_has_iterations boolean;
    v_has_convergence boolean;
    v_target_net_expr text;
    v_achieved_net_expr text;
    v_iterations_expr text;
    v_convergence_expr text;
BEGIN
    -- Debug view for run calculations
    IF to_regclass('public.payroll_runs') IS NOT NULL
       AND to_regclass('public.payroll_run_employees') IS NOT NULL
       AND to_regclass('public.payroll_run_lines') IS NOT NULL
       AND to_regclass('public.payroll_items') IS NOT NULL THEN
        EXECUTE format(
            'CREATE OR REPLACE VIEW payroll_run_calculation_debug AS ' ||
            'SELECT pr.id AS run_id, pr.company_id, pr.run_code, ' ||
            'pe.employee_id, pe.gross_amount, pe.deductions_amount, pe.net_amount, ' ||
            'rl.amount AS line_amount, rl.rate, rl.quantity, ' ||
            'pf.code AS item_code, pf.name_ar AS item_name, pf.category_code ' ||
            'FROM payroll_runs pr ' ||
            'JOIN payroll_run_employees pe ON pr.id = pe.run_id ' ||
            'JOIN payroll_run_lines rl ON pe.id = rl.run_employee_id ' ||
            'JOIN payroll_items pf ON rl.payroll_item_id = pf.id ' ||
            'WHERE pr.status = %L',
            'calculated'
        );
    END IF;

    -- Debug view for tax calculations
    IF to_regclass('public.payroll_tax_balances') IS NOT NULL
       AND to_regclass('public.payroll_tax_brackets') IS NOT NULL THEN
        EXECUTE
            'CREATE OR REPLACE VIEW payroll_tax_calculation_debug AS ' ||
            'SELECT pt.id AS balance_id, pt.employee_id, ' ||
            'pt.taxable_income_ytd, pt.tax_due_ytd, pt.tax_withheld_ytd, pt.credit_balance, ' ||
            'pbt.rate, pbt.upper_limit, ' ||
            'CASE WHEN pt.taxable_income_ytd > pbt.upper_limit THEN pt.taxable_income_ytd * pbt.rate ELSE 0 END AS calculated_tax ' ||
            'FROM payroll_tax_balances pt ' ||
            'JOIN payroll_tax_brackets pbt ON pt.tax_due_ytd > 0';
    END IF;

    -- Debug view for insurance calculations
    IF to_regclass('public.payroll_insurance_balances') IS NOT NULL
       AND to_regclass('public.payroll_insurance_policies') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'payroll_insurance_policies'
              AND column_name = 'rate'
        ) INTO v_has_pr_rate;

        v_rate_expr := CASE WHEN v_has_pr_rate THEN 'pr.rate' ELSE '0::numeric' END;

        EXECUTE
            'CREATE OR REPLACE VIEW payroll_insurance_calculation_debug AS ' ||
            'SELECT pi.id AS balance_id, pi.employee_id, pi.basis, ' ||
            'pi.employee_contribution, pi.employer_contribution, pi.total_contribution, ' ||
            'pr.code AS policy_code, ' || v_rate_expr || ' AS employee_rate, ' || v_rate_expr || ' AS employer_rate ' ||
            'FROM payroll_insurance_balances pi ' ||
            'JOIN payroll_insurance_policies pr ON pi.policy_id = pr.id';
    END IF;

    -- Debug view for gross-up calculations
    IF to_regclass('public.payroll_gross_up_runs') IS NOT NULL
       AND to_regclass('public.payroll_gross_up_iterations') IS NOT NULL
       AND to_regclass('public.payroll_gross_up_item_rules') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'payroll_gross_up_iterations'
              AND column_name = 'policy_id'
        ) INTO v_has_pgi_policy_id;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_gross_up_iterations' AND column_name = 'target_net'
        ) INTO v_has_target_net;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_gross_up_iterations' AND column_name = 'achieved_net'
        ) INTO v_has_achieved_net;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_gross_up_iterations' AND column_name = 'iterations'
        ) INTO v_has_iterations;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_gross_up_iterations' AND column_name = 'convergence'
        ) INTO v_has_convergence;

        v_join_expr := CASE
            WHEN v_has_pgi_policy_id THEN 'LEFT JOIN payroll_gross_up_item_rules pgri ON pgi.policy_id = pgri.id'
            ELSE 'LEFT JOIN payroll_gross_up_item_rules pgri ON true'
        END;

        v_target_net_expr := CASE WHEN v_has_target_net THEN 'pgi.target_net' ELSE '0::numeric' END;
        v_achieved_net_expr := CASE WHEN v_has_achieved_net THEN 'pgi.achieved_net' ELSE '0::numeric' END;
        v_iterations_expr := CASE WHEN v_has_iterations THEN 'pgi.iterations' ELSE '0::integer' END;
        v_convergence_expr := CASE WHEN v_has_convergence THEN 'pgi.convergence' ELSE 'false::boolean' END;

        EXECUTE
            'CREATE OR REPLACE VIEW payroll_gross_up_debug AS ' ||
            'SELECT pgr.id AS run_id, ' ||
            v_target_net_expr || ' AS target_net, ' ||
            v_achieved_net_expr || ' AS achieved_net, ' ||
            v_iterations_expr || ' AS iterations, ' ||
            v_convergence_expr || ' AS convergence, ' ||
            'pgri.item_code, pgri.bearing_type, pgri.percentage, pgri.maximum_amount ' ||
            'FROM payroll_gross_up_runs pgr ' ||
            'JOIN payroll_gross_up_iterations pgi ON pgr.id = pgi.run_id ' ||
            v_join_expr;
    END IF;
END
$$;