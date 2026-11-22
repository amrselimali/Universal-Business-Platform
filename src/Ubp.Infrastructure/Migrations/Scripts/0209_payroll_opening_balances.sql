-- 0209 — الأرصدة الافتتاحية للمرتبات (بند 7.4 وملحق ب.3):
--   أرصدة بداية السنة لكل موظف: أساس/ضريبة محتجزة، وعاء وحصص التأمينات الاجتماعية والصحية.
--   تُضاف مرة واحدة إلى الأساس التراكمي للسنة، ولا تُخزَّن في جداول الحركات لتفادي التكرار.
-- جدول إضافي فقط، ولا يغيّر أي جدول قائم.

CREATE TABLE IF NOT EXISTS payroll_opening_balances (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         uuid NOT NULL,
    employee_id        uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    tax_year_code      varchar(20) NOT NULL,
    tax_base           numeric(19,4) NOT NULL DEFAULT 0,
    tax_withheld       numeric(19,4) NOT NULL DEFAULT 0,
    insurance_base     numeric(19,4) NOT NULL DEFAULT 0,
    insurance_employee numeric(19,4) NOT NULL DEFAULT 0,
    insurance_employer numeric(19,4) NOT NULL DEFAULT 0,
    health_base        numeric(19,4) NOT NULL DEFAULT 0,
    health_employee    numeric(19,4) NOT NULL DEFAULT 0,
    health_employer    numeric(19,4) NOT NULL DEFAULT 0,
    notes              text,
    created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_payroll_opening_amounts CHECK (
        tax_base >= 0 AND tax_withheld >= 0 AND
        insurance_base >= 0 AND insurance_employee >= 0 AND insurance_employer >= 0 AND
        health_base >= 0 AND health_employee >= 0 AND health_employer >= 0),
    CONSTRAINT ux_payroll_opening_employee_year UNIQUE (employee_id, tax_year_code)
);

CREATE INDEX IF NOT EXISTS ix_payroll_opening_balances_year
    ON payroll_opening_balances (company_id, tax_year_code);
