-- 0108 — تسجيل إجازة الموظف داخل شاشة المواعيد
-- ---------------------------------------------------------------------------
-- الإجازة سطر في appointments بلا موعد محدد: يغطي يومًا كاملًا ويظهر «إجازة + الملاحظة»
-- في شاشة مواعيد الموظفين، ويُحتسب عند التحقق من إغلاق الشفت.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_leave boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN appointments.is_leave IS
    'true = إجازة يوم كامل وليست موعدًا محددًا (0108).';
