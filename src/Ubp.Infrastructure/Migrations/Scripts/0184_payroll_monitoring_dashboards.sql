-- Payroll phase 2: monitoring dashboards configuration
-- Version V6.1 -- 21 November 2026

-- Dashboard configurations
CREATE TABLE IF NOT EXISTS payroll_dashboard_configurations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    dashboard_name varchar(100) NOT NULL,
    dashboard_type varchar(50) NOT NULL, -- 'EXECUTIVE', 'OPERATIONS', 'FINANCE', 'HR', 'AUDIT', 'CUSTOM'
    layout_config jsonb, -- JSON definition of widgets, panels, filters
    is_default boolean NOT NULL DEFAULT false,
    is_shared boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_dashboard_config_company ON payroll_dashboard_configurations (company_id);
CREATE INDEX IF NOT EXISTS ix_payroll_dashboard_config_type ON payroll_dashboard_configurations (dashboard_type);

-- Dashboard widget instances
CREATE TABLE IF NOT EXISTS payroll_dashboard_widgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id uuid REFERENCES payroll_dashboard_configurations(id) ON DELETE CASCADE,
    widget_name varchar(100) NOT NULL,
    widget_type varchar(50) NOT NULL, -- 'GRAPH', 'TABLE', 'METRIC', 'CHART', 'TEXT', 'KPI'
    widget_config jsonb, -- Widget-specific configuration
    column_position integer NOT NULL,
    row_position integer NOT NULL,
    width integer NOT NULL DEFAULT 6,
    height integer NOT NULL DEFAULT 4,
    is_visible boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_payroll_dashboard_widgets_dashboard ON payroll_dashboard_widgets (dashboard_id);

-- Dashboard execution logs
CREATE TABLE IF NOT EXISTS payroll_dashboard_execution_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id uuid REFERENCES payroll_dashboard_configurations(id) ON DELETE CASCADE,
    executed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    executed_at timestamptz NOT NULL DEFAULT now(),
    execution_time_ms integer,
    record_count integer,
    status varchar(30) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message text
);

CREATE INDEX IF NOT EXISTS ix_payroll_dashboard_log_dashboard ON payroll_dashboard_execution_log (dashboard_id);

-- Scheduled dashboard refreshes
CREATE TABLE IF NOT EXISTS payroll_dashboard_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id uuid REFERENCES payroll_dashboard_configurations(id) ON DELETE CASCADE,
    schedule_name varchar(100),
    cron_expression varchar(50), -- Cron expression for scheduling
    is_active boolean NOT NULL DEFAULT true,
    last_executed_at timestamptz,
    next_execution_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_dashboard_schedules_dashboard ON payroll_dashboard_schedules (dashboard_id);
