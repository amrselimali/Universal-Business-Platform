-- 0206 — سجل تنفيذ المرتبات لكل موظف داخل الدورة (payroll_run_employees)
-- قرار تصميم لمنع التضارب:
--   1) هذا الجدول لا يحتوي أي مبالغ. المبالغ تبقى في payroll_results فقط (مصدر واحد للحقيقة).
--   2) وظيفته: حالة التنفيذ + عدد المحاولات + كود الخطأ + إصدار المحرك + أيام العمل،
--      أي أنه سجل استئناف/Idempotency يمنع تكرار النتائج عند إعادة الحساب.
--   3) لا يوجد FK عكسي من payroll_results إليه حتى لا يصبح للسجل مالكين.

CREATE TABLE IF NOT EXISTS payroll_run_employees (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id         uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    run_segment         integer NOT NULL DEFAULT 1,
    branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
    calculation_status  varchar(20) NOT NULL DEFAULT 'pending',
    attempts            integer NOT NULL DEFAULT 0,
    error_code          varchar(80),
    engine_version      varchar(40),
    work_days           numeric(12,4),
    calculated_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz,
    CONSTRAINT ux_payroll_run_employee UNIQUE (run_id, employee_id, run_segment),
    CONSTRAINT ck_payroll_run_employee_status CHECK
        (calculation_status IN ('pending','calculating','calculated','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_status
    ON payroll_run_employees (run_id, calculation_status);
CREATE INDEX IF NOT EXISTS ix_payroll_run_employees_employee
    ON payroll_run_employees (employee_id, run_id);

-- إلحاق مفتاح الربط المقصود في payroll_journal_links (كان في 0134 لجسم جدول لم يُنفَّذ)
-- بشكل محمي: لا يلمس بيانات قائمة ولا يُنشئ تكراراً.
DO $$
BEGIN
    IF to_regclass('public.payroll_journal_links') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'payroll_journal_links'
              AND column_name = 'run_employee_id') THEN
            ALTER TABLE public.payroll_journal_links ADD COLUMN run_employee_id uuid;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_journal_links_run_employee') THEN
            ALTER TABLE public.payroll_journal_links
                ADD CONSTRAINT fk_payroll_journal_links_run_employee
                FOREIGN KEY (run_employee_id)
                REFERENCES public.payroll_run_employees(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;
