-- 0215 — إيصال الدفعة المقدمة (شفت دكتور خارجي) كنوع إيصال مستقل:
-- يظهر في شاشة إيصالات تحصيل POS ويُعرض/يُطبع كإيصال قبض عادي، مع تمييزه عن التسويات.
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_receipt_type_check;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS ck_vouchers_receipt_type;
ALTER TABLE vouchers ADD CONSTRAINT ck_vouchers_receipt_type
    CHECK (receipt_type IN ('ORIGINAL', 'REVERSAL', 'ADJUSTED', 'ADVANCE'));
