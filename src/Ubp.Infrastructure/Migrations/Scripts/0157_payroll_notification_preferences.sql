-- Payroll phase 2: notification preferences
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS payroll_notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    notification_type varchar(50) NOT NULL, -- 'RUN_READY', 'RUN_APPROVAL_REQUIRED', 'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'TAX_NOTICE', 'INSURANCE_NOTICE', 'SETTLEMENT_READY', 'OVERDUE_DEDUCTION'
    is_enabled boolean NOT NULL DEFAULT true,
    medium varchar(30) NOT NULL, -- 'EMAIL', 'SMS', 'PUSH', 'IN_APP', 'PRINT'
    is_default boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_payroll_notifications_employee ON payroll_notification_preferences (employee_id);

-- Notification sending log
CREATE TABLE IF NOT EXISTS payroll_notification_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preference_id uuid NOT NULL REFERENCES payroll_notification_preferences(id) ON DELETE CASCADE,
    recipient varchar(200) NOT NULL,
    medium varchar(30) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED', 'BOUNCED'
    sent_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payroll_notif_log_preference ON payroll_notification_log (preference_id);
