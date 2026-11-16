-- 0107 — نطاق الأصناف والخزائن: فرع محدد أو الشركة ككل
-- ---------------------------------------------------------------------------
-- الأصناف: branch_id = NULL يعني صنفًا مشتركًا على مستوى الشركة، وغير NULL يعني
-- صنفًا خاصًا بالفرع. الأرصدة تبقى لكل مخزن كما هي.
-- الخزائن: is_company_wide = true تعني خزينة تظهر وتُستخدم في كل الفروع، مع بقاء
-- branch_id كفرع مالك لتسجيل القيود المحاسبية والوردية (لأن القيود تحتاج فرعًا).

ALTER TABLE items ADD COLUMN IF NOT EXISTS branch_id uuid
    REFERENCES branches(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_items_branch
    ON items (branch_id, is_active);

COMMENT ON COLUMN items.branch_id IS
    'NULL = صنف على مستوى الشركة، أو الفرع الذي يخصه الصنف — 0107';

ALTER TABLE treasuries ADD COLUMN IF NOT EXISTS is_company_wide boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_treasuries_company_wide
    ON treasuries (is_company_wide, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS ux_treasuries_company_code
    ON treasuries (code) WHERE is_company_wide;

COMMENT ON COLUMN treasuries.is_company_wide IS
    'true = خزينة الشركة تظهر في كل الفروع؛ branch_id يبقى الفرع المالك للمحاسبة والوردية — 0107';
