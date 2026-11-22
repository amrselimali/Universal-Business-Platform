-- Payroll phase 2: employee assignments (branch tracking)
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS employee_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    effective_from date NOT NULL,
    effective_to date,
    assignment_reason varchar(100),
    source_reference varchar(200),
    row_version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT chk_assignment_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT ux_employee_assignment_unique UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS ix_employee_assignments_employee ON employee_assignments (employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS ix_employee_assignments_branch ON employee_assignments (branch_id, effective_from);

-- Exclusion constraint to prevent overlapping assignments
-- (Will be added via migration 0200+ with pg_extension.btree_gist)

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 146) ON CONFLICT DO NOTHING;