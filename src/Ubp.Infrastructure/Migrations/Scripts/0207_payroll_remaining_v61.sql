-- 0207 — متطلبات متبقية من V6.1:
--   1) Data Cutoff صريح لكل دورة (بند 2 و15.1) — عمود واحد إضافي فقط.
--   2) إعداد نطاق التراكم الضريبي لكل سنة ضريبية COMPANY/BRANCH + سياسة نقل الرصيد (بند 7.4، ب.3).
--   3) قواعد تحمّل الشركة لكل بند (بند 10.3) بحد أقصى ونسبة/مبلغ.
-- كلها إضافية ولا تغيّر أي جدول قائم ولا بياناته.

ALTER TABLE payroll_runs
    ADD COLUMN IF NOT EXISTS cutoff_at timestamptz;

CREATE TABLE IF NOT EXISTS payroll_tax_settings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL,
    tax_year_code       varchar(20) NOT NULL,
    scope_type          varchar(10) NOT NULL DEFAULT 'COMPANY',
    branch_carry_policy varchar(20) NOT NULL DEFAULT 'CARRY_FORWARD',
    effective_from      date NOT NULL,
    effective_to        date,
    status              varchar(20) NOT NULL DEFAULT 'draft',
    approved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at         timestamptz,
    version             integer NOT NULL DEFAULT 1,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_payroll_tax_settings_scope CHECK (scope_type IN ('COMPANY','BRANCH')),
    CONSTRAINT ck_payroll_tax_settings_carry CHECK (branch_carry_policy IN ('RESET','CARRY_FORWARD')),
    CONSTRAINT ck_payroll_tax_settings_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT ux_payroll_tax_settings_year UNIQUE (company_id, tax_year_code, effective_from)
);

CREATE INDEX IF NOT EXISTS ix_payroll_tax_settings_year
    ON payroll_tax_settings (company_id, tax_year_code, effective_from DESC);

CREATE TABLE IF NOT EXISTS payroll_gross_up_shoulders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid,
    payroll_item_id     uuid NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
    shoulder_type       varchar(12) NOT NULL DEFAULT 'FULL',
    shoulder_value      numeric(19,4),
    max_amount          numeric(19,4),
    is_active           boolean NOT NULL DEFAULT true,
    effective_from      date NOT NULL,
    effective_to        date,
    version             integer NOT NULL DEFAULT 1,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_gross_up_shoulder CHECK (shoulder_type IN ('FULL','PERCENT','AMOUNT')),
    CONSTRAINT ck_gross_up_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT ux_gross_up_shoulder UNIQUE (payroll_item_id, effective_from)
);

CREATE INDEX IF NOT EXISTS ix_gross_up_shoulders_item
    ON payroll_gross_up_shoulders (payroll_item_id, effective_from DESC);
