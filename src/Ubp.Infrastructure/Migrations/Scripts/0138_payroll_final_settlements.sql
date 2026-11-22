-- Payroll phase 2: final settlements
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_final_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    termination_date date NOT NULL,
    settlement_date date NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'draft',
    settlement_type varchar(30) NOT NULL, -- 'FINAL', 'RESIGNATION', 'RETIREMENT', 'END_OF_SERVICE'
    
-- نهاية الخدمة
    total_entitlements numeric(19,4) NOT NULL DEFAULT 0, -- المستحقات الإجمالية
    total_deductions numeric(19,4) NOT NULL DEFAULT 0, -- الخصومات الإجمالية
    net_settlement numeric(19,4) NOT NULL DEFAULT 0, -- الصافي
    
    gratuity_amount numeric(19,4), -- مكافأة نهاية الخدمة
    leave_payment numeric(19,4), -- بدل الإجازات
    salary_for_notice_period numeric(19,4), -- راتبnotice period
    unpaid_dues numeric(19,4), -- متأخرات
    other_benefits numeric(19,4), -- مزايا أخرى
    other_deductions numeric(19,4), -- خصومات أخرى
    
    tax_settlement_amount numeric(19,4), -- الضريبة المحسوبة
    insurance_settlement_amount numeric(19,4), -- التأمين المحسوب
    
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    approval_note text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_employee ON payroll_final_settlements (employee_id);
CREATE INDEX IF NOT EXISTS ix_payroll_final_settlements_status ON payroll_final_settlements (status);

-- Final settlement lines: detailed breakdown
CREATE TABLE IF NOT EXISTS payroll_final_settlement_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id uuid NOT NULL REFERENCES payroll_final_settlements(id) ON DELETE CASCADE,
    line_type varchar(30) NOT NULL, -- 'EARNING', 'DEDUCTION', 'TAX', 'INSURANCE', 'GRATUITY', 'LEAVE', 'NOTICE_PAY'
    description varchar(200) NOT NULL,
    amount numeric(19,4) NOT NULL,
    calculation_basis varchar(100),
    source_reference uuid,
    sequence_no integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_payroll_final_lines_settlement ON payroll_final_settlement_lines (settlement_id);
CREATE INDEX IF NOT EXISTS ix_payroll_final_lines_type ON payroll_final_settlement_lines (line_type);
