-- 0218 — سعر الوحدة في نقطة البيع: عرض بمنزلتين وقبول حتى 9 منازل
-- -----------------------------------------------------------------------------
-- كان سعر الوحدة في booking_lines / booking_execution_lines بدقة 4 منازل، فتضيع
-- المنازل الزائدة عند الحفظ حتى لو قُبلت في الإدخال. نوسّع الدقة إلى 9 منازل
-- (الإجماليات تبقى مقرّبة لمنزلتين كما هي)، مع إعادة إنشاء الـ Views التابعة
-- لأن تغيير نوع العمود مرفوض ما دامت تعتمد عليه.

DROP VIEW IF EXISTS v_customer_line_paid;
DROP VIEW IF EXISTS v_customer_reservations;

ALTER TABLE booking_lines
    ALTER COLUMN unit_price TYPE numeric(18,9) USING unit_price::numeric(18,9);

ALTER TABLE booking_execution_lines
    ALTER COLUMN unit_price TYPE numeric(18,9) USING unit_price::numeric(18,9);

-- إعادة إنشاء v_customer_reservations (آخر تعريف: 0106)
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

-- إعادة إنشاء v_customer_line_paid (آخر تعريف: 0103)
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
