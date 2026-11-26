-- 0220 — تأجيل ترحيل قيود الشفت حتى اعتماد المراجعة
-- كل قيد يُنشأ أثناء وجود شفت مفتوح للفرع يبقى «مسودة» مرتبطًا بالشفت (shift_id)،
-- ثم تُرحَّل كل قيود الشفت المسودة مرة واحدة عند «اعتماد المراجعة».
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES cashier_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_journal_entries_shift
    ON journal_entries (shift_id, status);

COMMENT ON COLUMN journal_entries.shift_id IS
    'الشفت الذي سُجّل فيه القيد؛ القيود المسودة المرتبطة بالشفت تُرحَّل عند اعتماد المراجعة — 0220';
