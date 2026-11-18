-- 0111 — دورة تنفيذ الخدمة بالكامل مسودة ثم تُرحَّل مع الشفت
-- ---------------------------------------------------------------------------
-- التنفيذ (الأصلي/العكسي/المعدّل) يُنشأ Draft ويُرحَّل مع الشفت، ويقبل التعديل
-- بعد الترحيل بإيصال عكسي + معدّل. يبقى الأصل المُرحَّل للأثر مع is_reversed.

ALTER TABLE booking_executions DROP CONSTRAINT IF EXISTS booking_executions_status_check;
ALTER TABLE booking_executions ADD CONSTRAINT ck_booking_executions_status
    CHECK (status IN ('draft', 'posted', 'cancelled', 'reversed'));

ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS execution_type varchar(10)
    NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE booking_executions DROP CONSTRAINT IF EXISTS ck_booking_executions_type;
ALTER TABLE booking_executions ADD CONSTRAINT ck_booking_executions_type
    CHECK (execution_type IN ('ORIGINAL', 'REVERSAL', 'ADJUSTED'));

ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS is_reversed boolean
    NOT NULL DEFAULT false;
ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS parent_execution_id uuid
    REFERENCES booking_executions(id) ON DELETE RESTRICT;
ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS shift_id uuid
    REFERENCES cashier_shifts(id) ON DELETE SET NULL;
ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE booking_executions ADD COLUMN IF NOT EXISTS posted_by uuid
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_booking_executions_shift
    ON booking_executions (shift_id, status);
CREATE INDEX IF NOT EXISTS ix_booking_executions_parent
    ON booking_executions (parent_execution_id);
CREATE INDEX IF NOT EXISTS ix_booking_executions_posted_by
    ON booking_executions (posted_by);

-- ربط التنفيذات القديمة بالشفت الذي حدثت فيه، حتى يعمل تقرير الشفت والتعديل.
UPDATE booking_executions e
SET shift_id = (SELECT s.id FROM cashier_shifts s
                WHERE s.branch_id = e.branch_id AND e.created_at >= s.opened_at
                  AND (s.closed_at IS NULL OR e.created_at <= s.closed_at)
                ORDER BY s.opened_at DESC LIMIT 1),
    posted_at = COALESCE(e.posted_at, e.created_at)
WHERE e.shift_id IS NULL;

-- قيم السطر المحفوظة وقت التنفيذ (لا تتأثر بتعديل بند الحجز لاحقًا).
ALTER TABLE booking_execution_lines ADD COLUMN IF NOT EXISTS unit_price numeric(18,4)
    NOT NULL DEFAULT 0;
ALTER TABLE booking_execution_lines ADD COLUMN IF NOT EXISTS net_amount numeric(18,2)
    NOT NULL DEFAULT 0;
ALTER TABLE booking_execution_lines ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2)
    NOT NULL DEFAULT 0;
ALTER TABLE booking_execution_lines ADD COLUMN IF NOT EXISTS total_amount numeric(18,2)
    NOT NULL DEFAULT 0;
ALTER TABLE booking_execution_lines ADD COLUMN IF NOT EXISTS warehouse_id uuid
    REFERENCES warehouses(id) ON DELETE RESTRICT;

UPDATE booking_execution_lines el
SET warehouse_id = bl.warehouse_id
FROM booking_lines bl
WHERE bl.id = el.booking_line_id AND el.warehouse_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_booking_execution_lines_warehouse
    ON booking_execution_lines (warehouse_id);

-- فهارس مفاتيح أجنبية مرتجعات المشتريات (0109) حتى يجتاز فحص QA.
CREATE INDEX IF NOT EXISTS ix_fk_purchase_returns_original
    ON purchase_returns (original_document_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_returns_treasury
    ON purchase_returns (treasury_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_returns_treasury_method
    ON purchase_returns (treasury_method_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_returns_voucher
    ON purchase_returns (voucher_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_returns_stock_document
    ON purchase_returns (stock_document_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_returns_journal
    ON purchase_returns (journal_entry_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_return_lines_original
    ON purchase_return_lines (original_line_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_return_lines_item
    ON purchase_return_lines (item_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_return_lines_unit
    ON purchase_return_lines (unit_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_return_lines_warehouse
    ON purchase_return_lines (warehouse_id);
CREATE INDEX IF NOT EXISTS ix_fk_purchase_return_lines_stock_document
    ON purchase_return_lines (stock_document_id);

UPDATE booking_execution_lines el
SET unit_price = COALESCE(bl.unit_price, 0),
    net_amount = ROUND(COALESCE(bl.net_amount, 0) * el.quantity /
                       NULLIF(bl.quantity, 0), 2),
    tax_amount = ROUND(COALESCE(bl.tax_amount, 0) * el.quantity /
                       NULLIF(bl.quantity, 0), 2),
    total_amount = ROUND(COALESCE(bl.total_amount, 0) * el.quantity /
                         NULLIF(bl.quantity, 0), 2)
FROM booking_lines bl
WHERE bl.id = el.booking_line_id AND el.total_amount = 0;

-- التنفيذ العكسي يحمل كميات وتكاليف سالبة.
ALTER TABLE booking_execution_lines
    DROP CONSTRAINT IF EXISTS booking_execution_lines_quantity_check;
ALTER TABLE booking_execution_lines ADD CONSTRAINT ck_booking_execution_lines_quantity
    CHECK (quantity <> 0);
ALTER TABLE booking_execution_lines
    DROP CONSTRAINT IF EXISTS booking_execution_lines_unit_cost_check;
ALTER TABLE booking_execution_lines
    DROP CONSTRAINT IF EXISTS booking_execution_lines_cost_total_check;
ALTER TABLE booking_execution_lines ADD CONSTRAINT ck_booking_execution_lines_cost_total
    CHECK ((quantity > 0 AND cost_total >= 0) OR (quantity < 0 AND cost_total <= 0));
ALTER TABLE booking_execution_lines
    DROP CONSTRAINT IF EXISTS booking_execution_lines_meter_units_check;
ALTER TABLE booking_execution_lines ADD CONSTRAINT ck_booking_execution_lines_meter_units
    CHECK (meter_units >= 0 OR quantity < 0);

-- السماح بإقفال الإيصال المُرحّل (is_reversed فقط) عند إنشاء عكسي/معدّل،
-- مع بقاء كل الحقول المالية والبيانات الأصلية غير قابلة للتغيير.
CREATE OR REPLACE FUNCTION fn_voucher_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'draft' THEN
            RAISE EXCEPTION 'POSTED_VOUCHER_IMMUTABLE' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status <> 'draft' THEN
        IF OLD.status IN ('posted', 'reversed') AND NOT OLD.is_reversed AND NEW.is_reversed
           AND NEW.status IN ('posted', 'reversed')
           AND NEW.total_amount = OLD.total_amount
           AND NEW.fee_total = OLD.fee_total
           AND NEW.treasury_id = OLD.treasury_id
           AND NEW.party_id IS NOT DISTINCT FROM OLD.party_id
           AND NEW.doc_no IS NOT DISTINCT FROM OLD.doc_no
           AND NEW.doc_date = OLD.doc_date
           AND NEW.voucher_type = OLD.voucher_type
           AND NEW.receipt_type = OLD.receipt_type THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'POSTED_VOUCHER_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
