-- Payroll phase 2: deployment and rollout
-- Version V6.1 -- 21 November 2026

-- Deployment status tracking
CREATE TABLE IF NOT EXISTS payroll_deployment_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    deployment_phase varchar(50) NOT NULL, -- 'DATABASE_MIGRATION', 'APPLICATION_DEPLOY', 'UI_DEPLOY', 'TESTING', 'PRODUCTION_LAUNCH'
    status varchar(30) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    rolled_back boolean NOT NULL DEFAULT false,
    rollback_reason text,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_deployment_company ON payroll_deployment_status (company_id);

-- Deployment steps
CREATE TABLE IF NOT EXISTS payroll_deployment_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id uuid REFERENCES payroll_deployment_status(id) ON DELETE CASCADE,
    step_name varchar(100) NOT NULL,
    step_order integer NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    script_name varchar(100)
);

CREATE INDEX IF NOT EXISTS ix_payroll_deployment_steps_deployment ON payroll_deployment_steps (deployment_id);

-- Rollback points
CREATE TABLE IF NOT EXISTS payroll_rollback_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    checkpoint_date timestamptz NOT NULL,
    snapshot_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_rollback_points_company ON payroll_rollback_points (company_id);

-- Production launch checklist
CREATE TABLE IF NOT EXISTS payroll_production_launch_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    checklist_item varchar(200) NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    tested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    tested_at timestamptz,
    performance_metrics jsonb
);

CREATE INDEX IF NOT EXISTS ix_payroll_production_launch_company ON payroll_production_launch_checklist (company_id);
