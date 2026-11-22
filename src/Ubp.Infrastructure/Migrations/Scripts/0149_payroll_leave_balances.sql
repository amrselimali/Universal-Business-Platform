-- Payroll phase 2: leave balances
-- Version V6.1 -- 21 November 2026

CREATE TABLE IF NOT EXISTS leave_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type_code varchar(50) NOT NULL,
    balance_date date NOT NULL,
    opening_balance numeric(10,2) NOT NULL DEFAULT 0,
    used_balance numeric(10,2) NOT NULL DEFAULT 0,
    remaining_balance numeric(10,2) NOT NULL DEFAULT 0,
    carry_over_allowed boolean NOT NULL DEFAULT false,
    carry_over_limit numeric(10,2),
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    CONSTRAINT ux_leave_balance_unique UNIQUE (employee_id, leave_type_code, balance_date)
);

CREATE INDEX IF NOT EXISTS ix_leave_balances_employee ON leave_balances (employee_id);
CREATE INDEX IF NOT EXISTS ix_leave_balances_type ON leave_balances (leave_type_code);

-- Leave transaction history
CREATE TABLE IF NOT EXISTS leave_transaction_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id uuid NOT NULL REFERENCES leave_balances(id) ON DELETE CASCADE,
    transaction_date date NOT NULL,
    transaction_type varchar(30) NOT NULL, -- 'USED', 'CARRIED_OVER', '_RESET', 'ADJUSTMENT'
    quantity numeric(10,2) NOT NULL,
    reference_type varchar(50), -- 'RUN', 'SETTLEMENT', 'MANUAL'
    reference_id uuid,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_leave_history_balance ON leave_transaction_history (balance_id);
CREATE INDEX IF NOT EXISTS ix_leave_history_date ON leave_transaction_history (transaction_date);
