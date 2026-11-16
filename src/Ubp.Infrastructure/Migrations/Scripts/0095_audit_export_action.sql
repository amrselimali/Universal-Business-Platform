-- 0095 — السماح بإجراء EXPORT في سجل المراجعة (تصدير جداول/قاعدة البيانات من شاشة الإدارة)
-- ---------------------------------------------------------------------------------------
-- القيد الأصلي في 0005 كان يسمح بأفعال محددة فقط. تصدير البيانات عملية مراجعة مسجَّلة،
-- فنضيف EXPORT دون أي تغيير في البنية أو البيانات القائمة.

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN
    ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FAILED',
     'PERMISSION_CHANGE','PASSWORD_RESET','MIGRATION','EXPORT'));
