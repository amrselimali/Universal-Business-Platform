-- 0113 — فصل عمولة العميل عن عمولة مزود الخدمة في الإيصالات
-- ---------------------------------------------------------------------------
-- fee_total = عمولة التحصيل المحملة على العميل (تظهر في الإيصال وتُضاف للخزينة
--             وتُسجل كمصروف سالب في الشفت عند المراجعة).
-- provider_fee_total = عمولة مزود الخدمة (لا تظهر في الإيصال وتُخصم من الخزينة
--                      وتُسجل كمصروف موجب في الشفت عند المراجعة).

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS provider_fee_total numeric(18,2)
    NOT NULL DEFAULT 0;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS ck_vouchers_provider_fee_total;
ALTER TABLE vouchers ADD CONSTRAINT ck_vouchers_provider_fee_total
    CHECK (provider_fee_total >= 0 OR receipt_type = 'REVERSAL');

COMMENT ON COLUMN vouchers.fee_total IS
    'عمولة التحصيل المحملة على العميل: تظهر في الإيصال وتُضاف لرصيد الخزينة.';
COMMENT ON COLUMN vouchers.provider_fee_total IS
    'عمولة مزود الخدمة: لا تظهر في الإيصال وتُخصم من رصيد الخزينة.';
