-- 0101 — إعادة تسمية عرض حساب المسدد إلى اسم محايد
-- بعد إلغاء شاشة «الخدمات غير المحصلة» بقي العرض مستخدمًا لحساب نصيب كل سطر
-- من المدفوعات (نافذة التحصيل، شاشة التسوية، وتفاصيل السداد). نُبقيه باسم واضح.

DROP VIEW IF EXISTS v_customer_line_paid;
CREATE VIEW v_customer_line_paid AS
WITH paid_totals AS (
    SELECT b.id AS booking_id, b.total_amount,
           GREATEST(b.deposit_amount + COALESCE(p.paid_amount, 0)
                    - COALESCE(s.settled_paid, 0), 0) AS paid_total
    FROM bookings b
    LEFT JOIN (SELECT booking_id, SUM(amount) AS paid_amount
               FROM booking_payments GROUP BY booking_id) p ON p.booking_id = b.id
    LEFT JOIN (SELECT booking_id, SUM(paid_amount) AS settled_paid
               FROM customer_account_settlement_lines GROUP BY booking_id) s
           ON s.booking_id = b.id
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
        -- الأسطر المسوّاة سابقًا لم تعد مستحقة، وقيمتها خُصمت من متبقي الحجز.
        AND l.settled_qty = 0) r
JOIN paid_totals pt ON pt.booking_id = r.booking_id;

COMMENT ON VIEW v_customer_line_paid IS
    'نصيب كل سطر خدمة من المدفوعات (مقدمة + إيصالات − مسوّى) وغير المحصل — 0101.';

DROP VIEW IF EXISTS v_customer_uncollected;