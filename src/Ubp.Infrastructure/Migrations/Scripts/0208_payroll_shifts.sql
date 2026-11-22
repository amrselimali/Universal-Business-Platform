-- 0208 — الورديات وقواعدها (بند 11.2): تعريف وردية + إسناد مؤرخ + نتيجتها اليومية.
-- الوردية الليلية الممتدة بين يومين تُحسب ليوم واحد (crosses_midnight) بلا تكرار.
CREATE TABLE IF NOT EXISTS attendance_shifts (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid,
    branch_id               uuid REFERENCES branches(id) ON DELETE SET NULL,
    code                    varchar(40) NOT NULL,
    name_ar                 varchar(200) NOT NULL,
    start_time              time NOT NULL,
    end_time                time NOT NULL,
    crosses_midnight        boolean NOT NULL DEFAULT false,
    break_minutes           integer NOT NULL DEFAULT 0,
    grace_minutes           integer NOT NULL DEFAULT 0,
    overtime_after_minutes  integer NOT NULL DEFAULT 0,
    is_active               boolean NOT NULL DEFAULT true,
    version                 integer NOT NULL DEFAULT 1,
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_shift_minutes CHECK (break_minutes >= 0 AND grace_minutes >= 0
                                        AND overtime_after_minutes >= 0),
    CONSTRAINT ux_attendance_shift_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS attendance_shift_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    shift_id        uuid NOT NULL REFERENCES attendance_shifts(id) ON DELETE RESTRICT,
    effective_from  date NOT NULL,
    effective_to    date,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_shift_assignment_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT ux_shift_assignment UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS ix_shift_assignments_employee
    ON attendance_shift_assignments (employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS ix_shift_assignments_shift
    ON attendance_shift_assignments (shift_id);
