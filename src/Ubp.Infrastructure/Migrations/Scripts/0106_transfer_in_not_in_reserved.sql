-- 0106 — الكمية المحوَّلة «واردًا» لا تُحتسب في «المحجوز»، بل في «المستهلك» فقط
-- ---------------------------------------------------------------------------
-- عند تحويل خدمة إلى عميل آخر تُنشأ له حجز جديد بكمية = الكمية المحوَّلة مع
-- transferred_qty سالب. احتساب الكمية في «المحجوز» و«المستهلك» معًا كان يظهرها مرتين:
--   محجوز 5، مستهلك -5، متبقي 5.
-- المطلوب: المحوَّل واردًا يظهر في «المستهلك» فقط، والمحجوز يمثل حجز العميل الأصلي:
--   محجوز 0، مستهلك -5، متبقي 5.
-- المحوَّل صادرًا (transferred_qty موجب) لا يغيّر «المحجوز» أيضاً بل يظهر في «المستهلك».

DROP VIEW IF EXISTS v_customer_reservations;
CREATE VIEW v_customer_reservations AS
WITH base AS (
    SELECT b.id                    AS booking_id,
           b.branch_id             AS branch_id,
           b.customer_id           AS customer_id,
           c.name_ar               AS customer_name,
           b.status                AS booking_status,
           b.doc_no                AS booking_no,
           b.booking_date          AS booking_date,
           b.notes                 AS booking_notes,
           b.deposit_amount        AS deposit_amount,
           b.expires_at            AS expires_at,
           l.id                    AS booking_line_id,
           l.item_id               AS item_id,
           i.code                  AS item_code,
           i.name_ar               AS item_name,
           l.warehouse_id          AS warehouse_id,
           w.name_ar               AS warehouse_name,
           l.quantity              AS booked_qty,
           GREATEST(l.quantity - l.cancelled_qty + LEAST(l.transferred_qty, 0), 0)::numeric
                                   AS reserved_qty,
           (GREATEST(l.delivered_qty, l.invoiced_qty) + l.transferred_qty + l.settled_qty)
                                   AS consumed_qty,
           l.settled_qty           AS settled_qty,
           l.unit_price            AS unit_price
    FROM bookings b
    JOIN booking_lines l ON l.booking_id = b.id
    JOIN customers c ON c.id = b.customer_id
    JOIN items i ON i.id = l.item_id
    JOIN warehouses w ON w.id = l.warehouse_id
    WHERE b.status NOT IN ('cancelled', 'reversed')
)
SELECT booking_id, branch_id, customer_id, customer_name, booking_status, booking_no,
       booking_date, booking_notes, deposit_amount, expires_at, booking_line_id, item_id,
       item_code, item_name, warehouse_id, warehouse_name, booked_qty, reserved_qty,
       consumed_qty, settled_qty,
       GREATEST(reserved_qty - consumed_qty, 0)::numeric AS remaining_qty,
       unit_price,
       (GREATEST(reserved_qty - consumed_qty, 0) * unit_price)::numeric AS remaining_value
FROM base;

COMMENT ON VIEW v_customer_reservations IS
    'كارتة كميات العميل: المحجوز (بلا محوَّل وارد) / المستهلك (يشمل التحويل والتسوية) / المتبقي — 0106.';
