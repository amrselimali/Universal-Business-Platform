-- 0096 — تسوية حساب العميل للخدمات المحجوزة
-- ------------------------------------------------
-- تسوية خدمة = استهلاك الكمية المتبقية (settled_qty) + إيصال تسوية + قيد محاسبي
-- مسودة لا يُرحَّل إلا مع اعتماد/ترحيل الشفت، مع إظهار تاريخ الحجز في كارتة الخدمات.

ALTER TABLE booking_lines
    ADD COLUMN IF NOT EXISTS settled_qty numeric(18,4) NOT NULL DEFAULT 0
        CHECK (settled_qty >= 0);

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS settled_amount numeric(18,2) NOT NULL DEFAULT 0
        CHECK (settled_amount >= 0);

ALTER TABLE reservation_adjustments
    DROP CONSTRAINT IF EXISTS reservation_adjustments_kind_check;
ALTER TABLE reservation_adjustments
    ADD CONSTRAINT reservation_adjustments_kind_check
        CHECK (kind IN ('TO_ADVANCE', 'RELEASE', 'EXTEND', 'SETTLEMENT'));

CREATE TABLE IF NOT EXISTS customer_account_settlements (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    customer_id        uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    treasury_id        uuid REFERENCES treasuries(id) ON DELETE RESTRICT,
    voucher_id         uuid UNIQUE REFERENCES vouchers(id) ON DELETE RESTRICT,
    new_booking_id     uuid REFERENCES bookings(id) ON DELETE RESTRICT,
    journal_entry_id   uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
    doc_date           date NOT NULL,
    status             varchar(10) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'posted')),
    settlement_type    varchar(20) NOT NULL DEFAULT 'refund'
                       CHECK (settlement_type IN ('refund', 'new_booking')),
    total_refund       numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_refund >= 0),
    total_settled_qty  numeric(18,4) NOT NULL DEFAULT 0 CHECK (total_settled_qty >= 0),
    notes              varchar(500),
    created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    posted_at          timestamptz,
    posted_by          uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_customer_account_settlements_customer
    ON customer_account_settlements (branch_id, customer_id, doc_date DESC);
CREATE INDEX IF NOT EXISTS ix_customer_account_settlements_voucher
    ON customer_account_settlements (voucher_id);
CREATE INDEX IF NOT EXISTS ix_customer_account_settlements_new_booking
    ON customer_account_settlements (new_booking_id);

CREATE TABLE IF NOT EXISTS customer_account_settlement_lines (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id       uuid NOT NULL REFERENCES customer_account_settlements(id) ON DELETE CASCADE,
    line_no             integer NOT NULL CHECK (line_no > 0),
    booking_id          uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    booking_line_id     uuid NOT NULL REFERENCES booking_lines(id) ON DELETE RESTRICT,
    item_id             uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    booking_date        date NOT NULL,
    booked_qty          numeric(18,4) NOT NULL,
    consumed_qty        numeric(18,4) NOT NULL,
    settled_qty         numeric(18,4) NOT NULL CHECK (settled_qty >= 0),
    booked_unit_price   numeric(18,4) NOT NULL,
    external_unit_price numeric(18,4) NOT NULL CHECK (external_unit_price >= 0),
    paid_amount         numeric(18,2) NOT NULL DEFAULT 0,
    refund_amount       numeric(18,2) NOT NULL,
    revenue_adjustment  numeric(18,2) NOT NULL DEFAULT 0,
    note                varchar(500),
    UNIQUE (settlement_id, booking_line_id)
);

CREATE INDEX IF NOT EXISTS ix_customer_account_settlement_lines_settlement
    ON customer_account_settlement_lines (settlement_id);

DROP VIEW IF EXISTS v_customer_reservations;
CREATE VIEW v_customer_reservations AS
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
       GREATEST(l.quantity - l.cancelled_qty, 0)::numeric AS reserved_qty,
       (GREATEST(l.delivered_qty, l.invoiced_qty) + l.transferred_qty + l.settled_qty)
                               AS consumed_qty,
       l.settled_qty           AS settled_qty,
       l.reserved_qty::numeric AS remaining_qty,
       l.unit_price            AS unit_price,
       (l.reserved_qty * l.unit_price)::numeric AS remaining_value
FROM bookings b
JOIN booking_lines l ON l.booking_id = b.id
JOIN customers c ON c.id = b.customer_id
JOIN items i ON i.id = l.item_id
JOIN warehouses w ON w.id = l.warehouse_id
WHERE b.status NOT IN ('cancelled', 'reversed');

COMMENT ON VIEW v_customer_reservations IS
    'كارتة كميات العميل: تاريخ الحجز والمحجوز/المستهلك (شامل التنفيذ والتحويل والتسوية)/المتبقي — 0096.';

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
