-- 0110 — تعديل إيصالات POS قبل إقفال الشفت (إيصال عكسي + إيصال معدّل)
-- ---------------------------------------------------------------------------
-- الإيصال الأصلي يبقى ضمن نفس الشفت ويُقفل عن التعديل، ويُنشأ إيصال عكسي
-- بقيم سالبة وإيصال معدّل بالقيم الجديدة، والثلاثة Draft حتى ترحيل الشفت.

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS receipt_type varchar(10) NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_reversed boolean NOT NULL DEFAULT false;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS parent_receipt_id uuid REFERENCES vouchers(id) ON DELETE RESTRICT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES cashier_shifts(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;
ALTER TABLE vouchers ADD CONSTRAINT ck_vouchers_status
    CHECK (status IN ('draft', 'posted', 'cancelled', 'reversed'));
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_receipt_type_check;
ALTER TABLE vouchers ADD CONSTRAINT ck_vouchers_receipt_type
    CHECK (receipt_type IN ('ORIGINAL', 'REVERSAL', 'ADJUSTED'));
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_total_amount_check;
ALTER TABLE vouchers ADD CONSTRAINT ck_vouchers_total_amount CHECK (total_amount <> 0 OR receipt_type = 'ORIGINAL');
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_fee_total_check;
ALTER TABLE vouchers ADD CONSTRAINT ck_vouchers_fee_total CHECK (fee_total >= 0 OR receipt_type = 'REVERSAL');
ALTER TABLE voucher_lines DROP CONSTRAINT IF EXISTS voucher_lines_amount_check;
ALTER TABLE voucher_lines ADD CONSTRAINT ck_voucher_lines_amount CHECK (amount <> 0);
ALTER TABLE voucher_lines DROP CONSTRAINT IF EXISTS voucher_lines_fee_amount_check;
ALTER TABLE voucher_lines ADD CONSTRAINT ck_voucher_lines_fee_amount
    CHECK (fee_amount >= 0 OR amount < 0);

-- ربط الإيصالات القديمة بالشفت المطابق بالفرع والوقت حتى تعمل قواعد التعديل بأثر رجعي.
UPDATE vouchers v
SET shift_id = (SELECT s.id FROM cashier_shifts s
                WHERE s.branch_id = v.branch_id AND v.created_at >= s.opened_at
                  AND (s.closed_at IS NULL OR v.created_at <= s.closed_at)
                ORDER BY s.opened_at DESC LIMIT 1)
WHERE v.voucher_type = 'receipt' AND v.shift_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_vouchers_shift ON vouchers (shift_id, status);
CREATE INDEX IF NOT EXISTS ix_vouchers_parent ON vouchers (parent_receipt_id);
