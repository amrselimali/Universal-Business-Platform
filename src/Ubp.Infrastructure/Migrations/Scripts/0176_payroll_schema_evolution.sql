-- Payroll phase 2: schema evolution and versioning
-- Version V6.1 -- 21 November 2026

-- Schema version tracking
CREATE TABLE IF NOT EXISTS payroll_schema_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_no integer NOT NULL UNIQUE,
    description text NOT NULL,
    released_date date NOT NULL,
    is_current boolean NOT NULL DEFAULT false,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz,
    notes text
);

-- Schema change log
CREATE TABLE IF NOT EXISTS payroll_schema_change_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_version integer,
    to_version integer NOT NULL,
    change_description text NOT NULL,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    impact_assessment text,
    rollback_plan text
);

-- Deprecated tables tracking
CREATE TABLE IF NOT EXISTS payroll_deprecated_tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name varchar(100) NOT NULL,
    original_version integer NOT NULL,
    deprecated_version integer NOT NULL,
    deprecation_date date NOT NULL,
    reason text,
    is_removed boolean NOT NULL DEFAULT false,
    removed_at timestamptz
);

-- Migration rollback tracking
CREATE TABLE IF NOT EXISTS payroll_migration_rollback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_script varchar(100) NOT NULL,
    rolled_back boolean NOT NULL DEFAULT false,
    rolled_back_at timestamptz,
    rollback_reason text,
    rolled_back_by uuid REFERENCES users(id) ON DELETE SET NULL
);
