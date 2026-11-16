-- 0098 — ملاحظات لكل سطر في الحجز (تسوية بحجز عروض متعددة)
ALTER TABLE booking_lines ADD COLUMN IF NOT EXISTS notes varchar(500);
