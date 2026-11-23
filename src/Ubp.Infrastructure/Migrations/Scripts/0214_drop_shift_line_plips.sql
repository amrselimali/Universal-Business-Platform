-- 0214 — إلغاء جدول «عدد البلصات» الإضافي (0212):
--   عدد البلصات هو فعليًا وحدات عدّاد الأصل الثابت (booking_execution_lines.meter_units)
--   ويُرحَّل إلى asset_meter_readings/fixed_assets، فلا حاجة لجدول مستقل.

DROP TABLE IF EXISTS shift_line_plips;
