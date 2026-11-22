-- Payroll phase 2: debug and view definitions
-- Version V6.1 -- 21 November 2026

-- Debug view for run calculations
CREATE VIEW IF NOT EXISTS payroll_run_calculation_debug AS
SELECT
    pr.id AS run_id,
    pr.company_id,
    pr.run_code,
    pe.employee_id,
    pe.gross_amount,
    pe.deductions_amount,
    pe.net_amount,
    rl.item_code,
    rl.amount AS line_amount,
    rl.rate,
    rl.quantity,
    pf.name_ar AS item_name,
    pf.category_code
FROM payroll_runs pr
JOIN payroll_run_employees pe ON pr.id = pe.run_id
JOIN payroll_run_lines rl ON pe.id = rl.run_employee_id
JOIN payroll_items pf ON rl.payroll_item_id = pf.id
WHERE pr.status = 'calculated';

-- Debug view for tax calculations
CREATE VIEW IF NOT EXISTS payroll_tax_calculation_debug AS
SELECT
    pt.id AS balance_id,
    pt.employee_id,
    pt.taxable_income_ytd,
    pt.tax_due_ytd,
    pt.tax_withheld_ytd,
    pt.credit_balance,
    pbt.rate,
    pbt.upper_limit,
    CASE WHEN pt.taxable_income_ytd > pbt.upper_limit THEN pt.taxable_income_ytd * pbt.rate
         ELSE 0 END AS calculated_tax
FROM payroll_tax_balances pt
JOIN payroll_tax_brackets pbt ON pt.tax_due_ytd > 0;

-- Debug view for insurance calculations
CREATE VIEW IF NOT EXISTS payroll_insurance_calculation_debug AS
SELECT
    pi.id AS balance_id,
    pi.employee_id,
    pi.basis,
    pi.employee_contribution,
    pi.employer_contribution,
    pi.total_contribution,
    pr.code AS policy_code,
    pr.rate AS employee_rate,
    pr.rate AS employer_rate
FROM payroll_insurance_balances pi
JOIN payroll_insurance_policies pr ON pi.policy_id = pr.id;

-- Debug view for gross-up calculations
CREATE VIEW IF NOT EXISTS payroll_gross_up_debug AS
SELECT
    pgr.id AS run_id,
    pgt.target_net,
    pgt.achieved_net,
    pgt.iterations,
    pgt.convergence,
    pgi.item_code,
    pgi.bearing_type,
    pgi.percentage,
    pgi.maximum_amount
FROM payroll_gross_up_runs pgr
JOIN payroll_gross_up_iterations pgi ON pgr.id = pgi.run_id
JOIN payroll_gross_up_item_rules pgri ON pgi.policy_id = pgri.id
JOIN payroll_items pgi ON pgri.item_code = pgi.code;

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 163) ON CONFLICT DO NOTHING;