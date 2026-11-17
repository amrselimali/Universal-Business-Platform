-- 0109 — مرتجعات مشتريات من شاشة مصروفات التشغيل
-- ---------------------------------------------------------------------------
-- مستند مسودة لمرتجع شراء مرتبط بفاتورة شراء أصلية. طريقة الارتجاع:
--   SUPPLIER = خصم من حساب المورد، CASH = استرداد نقدي من خزينة.
-- يُرحَّل مع ترحيل الشفت، ويظهر في مصروفات الشفت بقيمة سالبة.

CREATE TABLE IF NOT EXISTS purchase_returns (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version            integer      NOT NULL DEFAULT 1,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at         timestamptz,
    updated_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    branch_id          uuid         NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    doc_no             varchar(30),
    doc_date           date         NOT NULL,
    supplier_id        uuid         NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    original_document_id uuid      NOT NULL REFERENCES commercial_documents(id) ON DELETE RESTRICT,
    return_method      varchar(10)  NOT NULL DEFAULT 'SUPPLIER'
                       CHECK (return_method IN ('SUPPLIER', 'CASH')),
    treasury_id        uuid REFERENCES treasuries(id) ON DELETE RESTRICT,
    treasury_method_id uuid REFERENCES treasury_methods(id) ON DELETE RESTRICT,
    total_amount       numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status             varchar(10)  NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT', 'POSTED')),
    notes              varchar(500),
    stock_document_id  uuid REFERENCES stock_documents(id) ON DELETE SET NULL,
    voucher_id         uuid REFERENCES vouchers(id) ON DELETE SET NULL,
    journal_entry_id   uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
    posted_at          timestamptz,
    posted_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_purchase_return_cash
        CHECK (return_method <> 'CASH' OR treasury_id IS NOT NULL)
);

ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS voucher_id uuid
    REFERENCES vouchers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_purchase_returns_no
    ON purchase_returns (branch_id, doc_no) WHERE doc_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_purchase_returns_branch_date
    ON purchase_returns (branch_id, doc_date DESC);
CREATE INDEX IF NOT EXISTS ix_purchase_returns_supplier
    ON purchase_returns (supplier_id, doc_date DESC);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id         uuid NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    line_no           integer NOT NULL CHECK (line_no > 0),
    original_line_id  uuid NOT NULL REFERENCES commercial_document_lines(id) ON DELETE RESTRICT,
    item_id           uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    unit_id           uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    warehouse_id      uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity          numeric(18,4) NOT NULL CHECK (quantity > 0),
    unit_price        numeric(18,4) NOT NULL CHECK (unit_price >= 0),
    amount            numeric(18,2) NOT NULL CHECK (amount >= 0),
    stock_document_id uuid REFERENCES stock_documents(id) ON DELETE SET NULL,
    CONSTRAINT ux_purchase_return_lines UNIQUE (return_id, line_no)
);

CREATE INDEX IF NOT EXISTS ix_purchase_return_lines_return
    ON purchase_return_lines (return_id, line_no);

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS ck_journal_entries_source_type;
ALTER TABLE journal_entries ADD CONSTRAINT ck_journal_entries_source_type
    CHECK (source_type IN ('manual', 'stock_document', 'stocktake', 'opening', 'invoice',
                           'voucher', 'cash_shift', 'delivery', 'execution',
                           'operating_expense', 'cash_handover', 'service_transfer',
                           'employee_advance', 'review_adjustment', 'purchase_return'));
