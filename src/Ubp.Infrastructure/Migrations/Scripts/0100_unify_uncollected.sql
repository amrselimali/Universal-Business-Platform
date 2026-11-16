-- 0100 — توحيد منطق «غير المحصل» بين شاشة الخدمات غير المحصلة ونافذة التحصيل
-- ---------------------------------------------------------------------------
-- المصدر الوحيد:
--   المسدد = الدفعة المقدمة + دفعات القبض
--   غير المحصل لكل سطر = قيمة السطر − نصيبه من المسدد
--   متبقي الحجز = إجمالي الحجز − المسدد − قيمة الأسطر المسوّاة (settled_amount)
-- الأسطر المسوّاة لا تعود «غير محصلة» لأن قيمتها خُصمت من متبقي الحجز.

DROP VIEW IF EXISTS v_customer_booking_balances;
CREATE VIEW v_customer_booking_balances AS
SELECT b.id AS booking_id,
       b.branch_id AS branch_id,
       b.customer_id AS customer_id,
       b.doc_no AS booking_no,
       b.status AS status,
       b.booking_date AS booking_date,
       b.source AS source,
       b.total_amount AS total_amount,
       b.settled_amount AS settled_amount,
       (b.deposit_amount + COALESCE(p.paid_amount, 0)) AS paid_amount,
       GREATEST(b.total_amount - b.deposit_amount - COALESCE(p.paid_amount, 0)
                - b.settled_amount, 0) AS remaining_amount,
       (SELECT string_agg(DISTINCT i.name_ar, ' • ')
        FROM booking_lines l JOIN items i ON i.id = l.item_id
        WHERE l.booking_id = b.id) AS items,
       (SELECT string_agg(DISTINCT i.name_ar, ' • ')
        FROM booking_lines l JOIN items i ON i.id = l.item_id
        WHERE l.booking_id = b.id AND i.item_type = 'SERVICE') AS services
FROM bookings b
LEFT JOIN (
    SELECT booking_id, SUM(amount) AS paid_amount
    FROM booking_payments GROUP BY booking_id
) p ON p.booking_id = b.id
WHERE b.status NOT IN ('cancelled', 'reversed');

COMMENT ON VIEW v_customer_booking_balances IS
    'رصيد الحجز: المتبقي = الإجمالي − المقدمة − الدفعات − قيمة الأسطر المسوّاة — 0100.';
-- سطر «غير محصل» موحّد: أسطر الحجوزات غير المسوّاة (تنفيذ مباشر أو حجز مسبق).
DROP VIEW IF EXISTS v_customer_uncollected;
CREATE VIEW v_customer_uncollected AS
WITH paid_totals AS (
    SELECT b.id AS booking_id, b.total_amount,
           b.deposit_amount + COALESCE(p.paid_amount, 0) AS paid_total
    FROM bookings b
    LEFT JOIN (SELECT booking_id, SUM(amount) AS paid_amount
               FROM booking_payments GROUP BY booking_id) p ON p.booking_id = b.id
    WHERE b.status NOT IN ('cancelled', 'reversed')
)
SELECT r.booking_id, r.branch_id, r.customer_id, r.booking_no, r.booking_date,
       r.booking_line_id, r.item_id, r.item_code, r.item_name, r.booking_notes,
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

COMMENT ON VIEW v_customer_uncollected IS
    'غير المحصل لكل سطر غير مسوّى: قيمة السطر − نصيبه من (المقدمة + الدفعات) — 0100.';
