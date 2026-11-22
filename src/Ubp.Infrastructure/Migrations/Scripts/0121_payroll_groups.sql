-- Payroll phase 2: payroll groups and item categories
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

ALTER TABLE payroll_groups
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS ix_payroll_groups_active ON payroll_groups (is_active);

CREATE TABLE IF NOT EXISTS payroll_item_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name_ar varchar(200) NOT NULL,
    name_en varchar(200),
    is_variable boolean NOT NULL DEFAULT false,
    affects_net_salary boolean NOT NULL DEFAULT true,
    is_taxable boolean NOT NULL DEFAULT false,
    is_insurable boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

ALTER TABLE payroll_item_categories
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS ix_payroll_item_categories_active ON payroll_item_categories (is_active);

