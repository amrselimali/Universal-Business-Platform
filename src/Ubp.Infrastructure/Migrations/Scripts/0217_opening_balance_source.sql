-- 0217 — فصل مصدر الأرصدة الافتتاحية عن حجوزات/مواعيد العملاء
-- -----------------------------------------------------------------------------
-- الحجز هو «الالتزام»: التأكيد يحجز المتاح والتنفيذ يصرف المخزون ويثبت التكلفة.
-- والأرصدة الافتتاحية هي التزامات خدمات (تظهر في الخدمات المحجوزة وتحصيلاتها)،
-- وليست مواعيد عملاء. كانت تُسجَّل بمصدر manual فتتسرّب إلى شاشة «حجز موعد»
-- وطبعها. هذا السكربت يعطيها مصدرًا مستقلًا حتى يكون الفصل على مستوى البيانات
-- لا على مستوى الشاشة فقط.
-- ملاحظة: العمود varchar(10) ومستخدم في Views، لذا نستخدم كودًا قصيرًا 'opening'
-- بدل تغيير نوع العمود (تغيير النوع مرفوض مع الـ Views).

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_check;

UPDATE bookings
   SET source = 'opening'
 WHERE is_opening_balance
   AND source = 'manual';

ALTER TABLE bookings ADD CONSTRAINT bookings_source_check
    CHECK (source IN ('manual', 'pos', 'transfer', 'opening'));

COMMENT ON COLUMN bookings.source IS
    'manual = حجز/موعد عميل، pos = مبيعات نقطة البيع، transfer = تحويل خدمة، opening = رصيد افتتاحي لخدمات العميل.';
