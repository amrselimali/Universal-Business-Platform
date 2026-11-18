-- 0112 — شفت دكتور خارجي: ربط العميل، دفعات مقدمة، وتسوية آلية عند الإقفال
-- ---------------------------------------------------------------------------
-- 1) العميل يمكن ربطه بدكتور خارجي (is_external_doctor).
-- 2) الشفت نوعان: عادي / دكتور خارجي مع عميل مربوط إلزامي للثاني.
-- 3) تسوية آلية عند الإقفال: إيرادات العميل − تحصيلاته، مع تحميل الجزء غير
--    المسدد على حساب الدكتور الخارجي أو خزينة (كليًا/جزئيًا).
-- 4) سند التسوية يُعلَّم is_shift_settlement حتى لا يدخل في حساب التسوية نفسه.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_external_doctor boolean
    NOT NULL DEFAULT false;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_external_doctor boolean
    NOT NULL DEFAULT false;
COMMENT ON COLUMN customers.is_external_doctor IS
    'عميل مربوط بدكتور خارجي: يظهر في شفت الدكتور الخارجي ويقبل دفعة مقدمة.';

ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS shift_type varchar(20)
    NOT NULL DEFAULT 'normal';
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS external_doctor_customer_id uuid
    REFERENCES customers(id) ON DELETE RESTRICT;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS settlement_voucher_id uuid
    REFERENCES vouchers(id) ON DELETE SET NULL;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS settlement_amount numeric(18,2)
    NOT NULL DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS settlement_treasury_amount numeric(18,2)
    NOT NULL DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS settlement_mode varchar(12);

ALTER TABLE cashier_shifts DROP CONSTRAINT IF EXISTS ck_shift_type;
ALTER TABLE cashier_shifts ADD CONSTRAINT ck_shift_type
    CHECK (shift_type IN ('normal', 'external_doctor'));
ALTER TABLE cashier_shifts DROP CONSTRAINT IF EXISTS ck_shift_external_doctor;
ALTER TABLE cashier_shifts ADD CONSTRAINT ck_shift_external_doctor
    CHECK (shift_type <> 'external_doctor' OR external_doctor_customer_id IS NOT NULL);
ALTER TABLE cashier_shifts DROP CONSTRAINT IF EXISTS ck_shift_settlement_mode;
ALTER TABLE cashier_shifts ADD CONSTRAINT ck_shift_settlement_mode
    CHECK (settlement_mode IS NULL OR settlement_mode IN ('doctor', 'treasury', 'mixed'));

CREATE INDEX IF NOT EXISTS ix_shifts_external_doctor
    ON cashier_shifts (external_doctor_customer_id);
CREATE INDEX IF NOT EXISTS ix_shifts_settlement_voucher
    ON cashier_shifts (settlement_voucher_id);

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_shift_settlement boolean
    NOT NULL DEFAULT false;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS settlement_treasury_amount numeric(18,2)
    NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS ix_vouchers_shift_settlement
    ON vouchers (is_shift_settlement, created_at);

INSERT INTO posting_default_types (key, module, party_type, is_required, sort_order,
    label_ar, label_en)
VALUES ('external_doctor', 'treasury', 'C', false, 460,
        'حساب الدكتور الخارجي', 'External doctor account')
ON CONFLICT (key) DO NOTHING;
