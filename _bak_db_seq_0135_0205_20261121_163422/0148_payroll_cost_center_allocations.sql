-- Payroll phase 2: cost center allocations
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_cost_center_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_cost_allocation_id uuid NOT NULL REFERENCES payroll_branch_cost_allocations(id) ON DELETE CASCADE,
    cost_center_id uuid NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
    allocation_ratio numeric(12,8) NOT NULL CHECK (allocation_ratio >= 0 AND allocation_ratio <= 1),
    allocated_amount numeric(19,4) NOT NULL DEFAULT 0,
    UNIQUE (branch_cost_allocation_id, cost_center_id)
);

CREATE INDEX IF NOT EXISTS ix_payroll_cost_center_allocations_center ON payroll_cost_center_allocations (cost_center_id);

-- Verify that cost centers belong to the correct branch
-- (This would be enforced via triggers or application logic)

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 148) ON CONFLICT DO NOTHING;