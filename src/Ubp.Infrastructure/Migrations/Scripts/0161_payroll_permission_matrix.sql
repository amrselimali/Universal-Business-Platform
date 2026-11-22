-- Payroll phase 2: permission matrix
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_permission_matrix (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code varchar(50) NOT NULL,
    resource_type varchar(50) NOT NULL, -- 'RUN', 'EMPLOYEE', 'ITEM', 'POLICY', 'SETTLEMENT', 'REPORT'
    action_type varchar(30) NOT NULL, -- 'CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'POST', 'PAY', 'EXPORT'
    is_allowed boolean NOT NULL DEFAULT true,
    requires_approval boolean NOT NULL DEFAULT false,
    category varchar(50) NOT NULL DEFAULT 'PAYROLL',
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_permission_matrix_role ON payroll_permission_matrix (role_code, resource_type, action_type);
CREATE INDEX IF NOT EXISTS ix_payroll_permission_matrix_resource ON payroll_permission_matrix (resource_type, action_type);
