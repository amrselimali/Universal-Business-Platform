-- 0211 — إصلاح سلسلة الترحيل على قاعدة جديدة:
--   0109 يعدّل purchase_returns/purchase_return_lines دون أن يوجد أي سكربت ينشئهما،
--   فتفشل السلسلة من الصفر بينما تعمل على قاعدة سبق إنشاؤها يدوياً.
--   هذا السكربت ينشئ الجدولين فقط إن كانا غير موجودين، بنفس أعمدة قاعدة التطوير،
--   ولا يغيّر شيئاً على قاعدة قائمة (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS purchase_returns (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version             integer NOT NULL DEFAULT 1,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_at          timestamptz,
    updated_by          uuid,
    branch_id           uuid NOT NULL,
    doc_no              varchar(50),
    doc_date            date NOT NULL,
    supplier_id         uuid NOT NULL,
    original_document_id uuid,
    return_method       varchar(20) NOT NULL DEFAULT 'SUPPLIER',
    treasury_id         uuid,
    treasury_method_id  uuid,
    total_amount        numeric(19,4) NOT NULL DEFAULT 0,
    status              varchar(20) NOT NULL DEFAULT 'DRAFT',
    notes               varchar(500),
    stock_document_id   uuid,
    voucher_id          uuid,
    journal_entry_id    uuid,
    posted_at           timestamptz,
    posted_by           uuid,
    source_type         varchar(30) NOT NULL DEFAULT 'INVOICE',
    operating_expense_id uuid
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id               uuid NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    line_no                 integer NOT NULL,
    original_line_id        uuid,
    item_id                 uuid NOT NULL,
    unit_id                 uuid NOT NULL,
    warehouse_id            uuid NOT NULL,
    quantity                numeric(19,4) NOT NULL,
    unit_price              numeric(19,4) NOT NULL,
    amount                  numeric(19,4) NOT NULL,
    stock_document_id       uuid,
    operating_expense_line_id uuid
);

CREATE INDEX IF NOT EXISTS ix_purchase_returns_doc_date
    ON purchase_returns (branch_id, doc_date DESC);

CREATE INDEX IF NOT EXISTS ix_purchase_return_lines_return
    ON purchase_return_lines (return_id, line_no);
