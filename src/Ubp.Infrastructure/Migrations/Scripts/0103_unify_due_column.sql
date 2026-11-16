-- 0103 — توحيد عمود «المستحق على العميل» مع فلتر «خدمات ما زالت مفتوحة»
-- ---------------------------------------------------------------------------
-- المشكلة: العرض v_customer_line_paid كان يستبعد الأسطر المسوّاة (settled_qty > 0)،
-- فيصبح الانضمام فارغًا وتُحسب قيمة الخدمة كاملة «مستحقة» في الشاشة، بينما الفلتر
-- لا يجد السطر ويستبعده — نتيجتان متناقضتان لنفس السطر.
-- الحل: يُدرَج السطر المسوّى في العرض بقيمة غير محصّلة = صفر (أُغلق بالتسوية)،
-- ويُحسب المستحق في الشاشة والفلتر من نفس الحقل.

DROP VIEW IF EXISTS v_customer_line_paid;
CREATE VIEW v_customer_line_paid AS
WITH paid_totals AS (
    SELECT b.id AS booking_id, b.total_amount,
           b.deposit_amount + COALESCE(p.paid_amount, 0) AS paid_total
    FROM bookings b
    LEFT JOIN (SELECT booking_id, SUM(amount) AS paid_amount
               FROM booking_payments GROUP BY booking_id) p ON p.booking_id = b.id
    WHERE b.status NOT IN ('cancelled', 'reversed')
)
SELECT r.booking_line_id, r.booking_id, r.branch_id, r.customer_id, r.booking_no,
       r.booking_date, r.item_id, r.item_code, r.item_name, r.booking_notes,
       r.booked_qty, r.consumed_qty, r.remaining_qty, r.unit_price, r.settled_qty,
       COALESCE(LEAST(r.booked_qty * r.unit_price,
             ROUND(pt.paid_total * (r.booked_qty * r.unit_price)
                   / NULLIF(pt.total_amount, 0), 2)), 0) AS paid_amount,
       CASE WHEN r.settled_qty > 0 THEN 0
            ELSE GREATEST(r.booked_qty * r.unit_price
                 - COALESCE(LEAST(r.booked_qty * r.unit_price,
                     ROUND(pt.paid_total * (r.booked_qty * r.unit_price)
                           / NULLIF(pt.total_amount, 0), 2)), 0), 0)
       END AS uncollected_value
FROM (SELECT b.id AS booking_id, b.branch_id, b.customer_id, b.doc_no AS booking_no,
             b.booking_date, l.id AS booking_line_id, l.item_id, i.code AS item_code,
             i.name_ar AS item_name, b.notes AS booking_notes,
             l.quantity AS booked_qty,
             (GREATEST(l.delivered_qty, l.invoiced_qty) + l.transferred_qty + l.settled_qty)
                 AS consumed_qty,
             l.reserved_qty AS remaining_qty, l.unit_price, l.settled_qty
      FROM bookings b
      JOIN booking_lines l ON l.booking_id = b.id
      JOIN items i ON i.id = l.item_id
      WHERE b.status NOT IN ('cancelled', 'reversed')) r
JOIN paid_totals pt ON pt.booking_id = r.booking_id;

COMMENT ON VIEW v_customer_line_paid IS
    'نصيب كل سطر من المدفوعات وغير المحصل؛ السطر المسوّى غير المحصل = صفر — 0103.';