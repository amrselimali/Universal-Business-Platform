-- 0216 — تمييز حجوزات «الأرصدة الافتتاحية» للعميل
-- -----------------------------------------------------------------------------
-- الأرصدة الافتتاحية تُحفظ كحجوزات خدمة مؤكدة (حجز لكل بند). كان التمييز يتم
-- بمطابقة ملاحظة الحجز فقط، وهو عرضة للالتباس مع أي حجز يدوي بنفس الملاحظة.
-- العمود is_opening_balance يخصّص هذا النوع ليصبح تعديله المباشر من شاشة العملاء
-- (بصلاحية مستقلة) آمنًا ولا يمس الحجوزات العادية.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_opening_balance boolean NOT NULL DEFAULT false;

-- Backfill للحجوزات القديمة المنشأة من شاشة إضافة العميل.
UPDATE bookings
   SET is_opening_balance = true
 WHERE is_opening_balance = false
   AND source = 'manual'
   AND notes = 'رصيد افتتاحي للخدمات';

CREATE INDEX IF NOT EXISTS ix_bookings_opening_balance
    ON bookings (customer_id, booking_date)
    WHERE is_opening_balance;

COMMENT ON COLUMN bookings.is_opening_balance IS
    'حجز ناتج عن رصيد افتتاحي لخدمات العميل: يُعدَّل مباشرة قبل أي تنفيذ/تحصيل/تسوية وبلا أثر محاسبي.';
