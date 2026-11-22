-- 0210 — Adjustment Run مستقل (بند 12.3):
--   نوع الدورة REGULAR/ADJUSTMENT + ربط بدورة المصدر عند التصحيح.
--   دورات التسوية لا تُعيد حساب الراتب الأساسي ولا الأرصدة القانونية، وتُرحَّل كقيد تسوية مستقل.
-- إضافي فقط، والقيمة الافتراضية REGULAR تحفظ سلوك الدورات القائمة.

ALTER TABLE payroll_runs
    ADD COLUMN IF NOT EXISTS run_type varchar(20) NOT NULL DEFAULT 'REGULAR';

ALTER TABLE payroll_runs
    ADD COLUMN IF NOT EXISTS source_run_id uuid REFERENCES payroll_runs(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_runs_type') THEN
        ALTER TABLE payroll_runs
            ADD CONSTRAINT ck_payroll_runs_type CHECK (run_type IN ('REGULAR', 'ADJUSTMENT'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_payroll_runs_type
    ON payroll_runs (run_type, salary_from DESC);
