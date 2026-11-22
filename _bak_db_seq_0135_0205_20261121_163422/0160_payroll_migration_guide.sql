-- Payroll phase 2: migration guide and documentation
-- Version V6.1 -- 21 November 2026

-- Migration version tracking
CREATE TABLE IF NOT EXISTS payroll_migration_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_no integer NOT NULL,
    description text NOT NULL,
    released_date date NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    notes text
);

INSERT INTO payroll_migration_version (version_no, description, released_date, is_completed) VALUES (6.1, 'Unified Payroll Module V6.1', '2026-11-21', true);

-- Migration step tracking
CREATE TABLE IF NOT EXISTS payroll_migration_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_version_id uuid REFERENCES payroll_migration_version(id) ON DELETE CASCADE,
    step_no integer NOT NULL,
    step_name varchar(100) NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    script_name varchar(100),
    errors text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Pre-migration checklist
CREATE TABLE IF NOT EXISTS payroll_migration_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    checklist_item varchar(200) NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    verified_at timestamptz,
    notes text
);

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 160) ON CONFLICT DO NOTHING;