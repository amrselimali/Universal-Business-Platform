-- 0099 — أسطر فرق تسوية الحجز الجديد مع الخزينة
CREATE TABLE IF NOT EXISTS customer_account_settlement_cash_lines (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id uuid NOT NULL REFERENCES customer_account_settlements(id) ON DELETE CASCADE,
    line_no       integer NOT NULL CHECK (line_no > 0),
    treasury_id   uuid NOT NULL REFERENCES treasuries(id) ON DELETE RESTRICT,
    amount        numeric(18,2) NOT NULL CHECK (amount >= 0),
    direction     varchar(10) NOT NULL CHECK (direction IN ('collect', 'refund')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (settlement_id, line_no)
);

CREATE INDEX IF NOT EXISTS ix_customer_account_settlement_cash_lines
    ON customer_account_settlement_cash_lines (settlement_id);
