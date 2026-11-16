-- 0102 — تصحيح توزيع المسدد على سطور الخدمة
-- -----------------------------------------------------------------
-- كان المسدد الكلي يُخفَّض بمقدار «المسدد المستهلك في تسويات سابقة» قبل توزيعه على
-- السطور، فيظهر مسدد أقل من الواقع (مثال: إيصالات 120 وسداد سابق 111.11 ← مسدد 8.89)
-- ويظهر مبلغ مستحق على العميل رغم أن الإيصالات غطّت قيمة الخدمة.
-- التصحيح: المسدد الكلي = المقدمة + الإيصالات فقط، ويُوزَّع على السطور بقيمة كل سطر.
-- الأسطر المسوّاة تُستبعد أصلًا من العرض وقيمتها مخصومة من متبقي الحجز (settled_amount).

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
       r.booked_qty, r.consumed_qty, r.remaining_qty, r.unit_price,
       COALESCE(LEAST(r.booked_qty * r.unit_price,
             ROUND(pt.paid_total * (r.booked_qty * r.unit_price)
                   / NULLIF(pt.total_amount, 0), 2)), 0) AS paid_amount,
       GREATEST(r.booked_qty * r.unit_price
                - COALESCE(LEAST(r.booked_qty * r.unit_price,
                    ROUND(pt.paid_total * (r.booked_qty * r.unit_price)
                          / NULLIF(pt.total_amount, 0), 2)), 0), 0) AS uncollected_value
FROM (SELECT b.id AS booking_id, b.branch_id, b.customer_id, b.doc_no AS booking_no,
             b.booking_date, l.id AS booking_line_id, l.item_id, i.code AS item_code,
             i.name_ar AS item_name, b.notes AS booking_notes,
             l.quantity AS booked_qty,
             (GREATEST(l.delivered_qty, l.invoiced_qty) + l.transferred_qty + l.settled_qty)
                 AS consumed_qty,
             l.reserved_qty AS remaining_qty, l.unit_price
      FROM bookings b
      JOIN booking_lines l ON l.booking_id = b.id
      JOIN items i ON i.id = l.item_id
      WHERE b.status NOT IN ('cancelled', 'reversed')
        AND l.settled_qty = 0) r
JOIN paid_totals pt ON pt.booking_id = r.booking_id;

COMMENT ON VIEW v_customer_line_paid IS
    'نصيب كل سطر خدمة من (المقدمة + الإيصالات) بنسبة قيمة السطر — 0102.';