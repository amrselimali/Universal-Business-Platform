-- Payroll phase 2: version control
-- Version V6.1 -- 21 November 2026

-- Migration version control
CREATE TABLE IF NOT EXISTS payroll_migration_version_control (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    migration_script varchar(100) NOT NULL,
    version_before integer NOT NULL,
    version_after integer NOT NULL,
    change_summary text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    rollback_script varchar(100)
);

CREATE INDEX IF NOT EXISTS ix_payroll_migration_version_company ON payroll_migration_version_control (company_id);

-- Change impact analysis
CREATE TABLE IF NOT EXISTS payroll_change_impact_analysis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    changed_entity varchar(100) NOT NULL, -- 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION'
    changed_object varchar(100) NOT NULL,
    impact_analysis jsonb NOT NULL, -- JSON describing impacted objects, dependencies, risks
    analysis_date timestamptz NOT NULL DEFAULT now(),
    analyzed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_payroll_change_impact_company ON payroll_change_impact_analysis (company_id);

-- Deployment history
CREATE TABLE IF NOT EXISTS payroll_deployment_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    deployment_id uuid REFERENCES payroll_deployment_status(id) ON DELETE SET NULL,
    deployment_type varchar(50) NOT NULL, -- 'DATABASE_MIGRATION', 'APPLICATION_DEPLOY', 'UI_DEPLOY'
    deployment_status varchar(30) NOT NULL DEFAULT 'COMPLETED', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    deployed_at timestamptz NOT NULL DEFAULT now(),
    rolled_back boolean NOT NULL DEFAULT false,
    rollback_date timestamptz,
    rollback_reason text,
    performance_metrics jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_deployment_history_company ON payroll_deployment_history (company_id);
