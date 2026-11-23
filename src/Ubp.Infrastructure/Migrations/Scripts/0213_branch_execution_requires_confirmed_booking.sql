-- 0213 — إعداد فرع: هل تنفيذ الخدمة المحجوزة يشترط حجزاً مؤكداً للعميل مع الموظف في نفس اليوم؟
--   الافتراضي false (سلوك قائم: يُقبل التنفيذ بلا شرط إضافي).

ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS require_confirmed_booking_for_execution boolean NOT NULL DEFAULT false;
