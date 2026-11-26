-- 0219 — تسوية حساب الخزينة (الحساب الوسيط) كسجل مستقل مرتبط بالشفت
-- كل تسوية: مدين الخزينة / دائن الوسيط (موجب) أو العكس (سالب)، بقيد مُرحَّل فورًا،
-- وتُربط بالشفت المفتوح وقت التسوية لتظهر في تقريره وحركة النقد و«المتوقع».
CREATE TABLE IF NOT EXISTS treasury_clearing_settlements (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    treasury_id         uuid NOT NULL REFERENCES treasuries(id) ON DELETE RESTRICT,
    clearing_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount              numeric(18,2) NOT NULL CHECK (amount <> 0),
    doc_date            date NOT NULL,
    reference           varchar(100),
    journal_entry_id    uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
    shift_id            uuid REFERENCES cashier_shifts(id) ON DELETE SET NULL,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_treasury_clearing_settlements_shift
    ON treasury_clearing_settlements (shift_id);
CREATE INDEX IF NOT EXISTS ix_treasury_clearing_settlements_branch
    ON treasury_clearing_settlements (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_treasury_clearing_settlements_treasury
    ON treasury_clearing_settlements (treasury_id, created_at DESC);

-- نوع مصدر مستقل لقيود التسوية حتى لا يتعارض قيد الفرق/العكس مع القيد الأصلي
-- في الفهرس الفريد ux_journal_entries_source (source_type, source_id).
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS ck_journal_entries_source_type;
ALTER TABLE journal_entries ADD CONSTRAINT ck_journal_entries_source_type
    CHECK (source_type IN ('manual', 'stock_document', 'stocktake', 'opening', 'invoice',
                           'voucher', 'cash_shift', 'delivery', 'execution',
                           'operating_expense', 'cash_handover', 'service_transfer',
                           'employee_advance', 'review_adjustment', 'clearing_settlement'));

-- ربط التسويات القديمة (قيد «تسوية حساب وسيط» بلا سند) بالشفت المفتوح وقت إنشائها إن وُجد.
INSERT INTO treasury_clearing_settlements
    (id, branch_id, treasury_id, clearing_account_id, amount, doc_date, reference,
     journal_entry_id, shift_id, created_by, created_at)
SELECT gen_random_uuid(),
       e.branch_id,
       tx.account_id,
       cx.account_id,
       (COALESCE(tl.debit, 0) - COALESCE(tl.credit, 0)),
       e.entry_date, NULL, e.id,
       (SELECT s.id FROM cashier_shifts s
        WHERE s.branch_id = e.branch_id AND e.created_at >= s.opened_at
          AND (s.closed_at IS NULL OR e.created_at <= s.closed_at)
        ORDER BY s.opened_at DESC LIMIT 1),
       e.created_by, e.created_at
FROM journal_entries e
JOIN LATERAL (
    SELECT l.account_id,
           SUM(l.debit) AS debit, SUM(l.credit) AS credit
    FROM journal_entry_lines l
    JOIN treasuries t ON t.account_id = l.account_id
    WHERE l.entry_id = e.id
    GROUP BY l.account_id LIMIT 1
) tl ON true
JOIN treasuries tx ON tx.account_id = tl.account_id
JOIN LATERAL (
    SELECT l.account_id FROM journal_entry_lines l
    WHERE l.entry_id = e.id AND l.account_id <> tl.account_id
    LIMIT 1
) cx ON true
WHERE e.description LIKE 'تسوية حساب وسيط%'
  AND e.source_type = 'voucher' AND e.source_id IS NULL
  AND (COALESCE(tl.debit, 0) - COALESCE(tl.credit, 0)) <> 0
  AND NOT EXISTS (SELECT 1 FROM treasury_clearing_settlements x
                  WHERE x.journal_entry_id = e.id);

-- وسم القيود القديمة بالنوع الجديد وربطها بسجل التسوية (لتمييزها في التقارير).
UPDATE journal_entries e
SET source_type = 'clearing_settlement', source_id = cs.id
FROM treasury_clearing_settlements cs
WHERE cs.journal_entry_id = e.id
  AND e.source_type = 'voucher' AND e.source_id IS NULL
  AND e.status <> 'cancelled';
