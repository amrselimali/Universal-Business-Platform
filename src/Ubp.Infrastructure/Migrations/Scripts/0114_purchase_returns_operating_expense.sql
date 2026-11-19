-- 0114 — ربط مرتجعات المشتريات بمصروفات التشغيل وسطورها
-- ---------------------------------------------------------------------------

ALTER TABLE purchase_returns
    ALTER COLUMN original_document_id DROP NOT NULL;

ALTER TABLE purchase_returns
    ADD COLUMN IF NOT EXISTS source_type varchar(30) NOT NULL DEFAULT 'INVOICE',
    ADD COLUMN IF NOT EXISTS operating_expense_id uuid
        REFERENCES operating_expenses(id) ON DELETE RESTRICT;

ALTER TABLE purchase_returns
    DROP CONSTRAINT IF EXISTS ck_purchase_return_source;

ALTER TABLE purchase_returns
    ADD CONSTRAINT ck_purchase_return_source
        CHECK (
            (source_type = 'INVOICE' AND original_document_id IS NOT NULL)
            OR
            (source_type = 'OPERATING_EXPENSE' AND operating_expense_id IS NOT NULL)
        );

CREATE INDEX IF NOT EXISTS ix_purchase_returns_expense
    ON purchase_returns (operating_expense_id, doc_date DESC);

ALTER TABLE purchase_return_lines
    ALTER COLUMN original_line_id DROP NOT NULL;

ALTER TABLE purchase_return_lines
    ADD COLUMN IF NOT EXISTS operating_expense_line_id uuid
 













       REFERENCES operating_expense_lines(id) ON DELETE RESTRICT;

ALTER TABLE purchase_return_lines
    DROP CONSTRAINT IF EXISTS ck_purchase_return_line_source;

ALTER TABLE purchase_return_lines
    ADD CONSTRAINT ck_purchase_return_line_source
        CHECK (
            original_line_id IS NOT NULL
            OR operating_expense_line_id IS NOT NULL
        );

CREATE INDEX IF NOT EXISTS ix_purchase_return_lines_expense_line












    ON purchase_return_lines (operating_expense_line_id);