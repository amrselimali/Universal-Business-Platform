-- Payroll phase 2: advanced constraints
-- Version V6.1 -- 21 November 2026

-- Check constraint for run status transitions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_run_status') THEN
        ALTER TABLE payroll_runs ADD CONSTRAINT ck_payroll_run_status CHECK (status IN ('draft', 'calculated', 'approved', 'posted', 'paid', 'closed'));
    END IF;
END$$;

-- Check constraint for run types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_run_type') THEN
        ALTER TABLE payroll_runs ADD CONSTRAINT ck_payroll_run_type CHECK (run_type IN ('monthly', 'biweekly', 'weekly', 'custom'));
    END IF;
END$$;

-- Check constraint for allocation methods
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_allocation_method_v2') THEN
        ALTER TABLE payroll_source_allocations ADD CONSTRAINT ck_payroll_allocation_method_v2 CHECK (allocation_method IN ('direct','percentage','fixed','equal','formula','ignore'));
    END IF;
END$$;

-- Check constraint for insurance sides
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_insurance_side') THEN
        ALTER TABLE payroll_insurance_transactions ADD CONSTRAINT ck_payroll_insurance_side CHECK (side IN ('EMPLOYEE', 'EMPLOYER'));
    END IF;
END$$;

-- Check constraint for transaction types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_transaction_type') THEN
        ALTER TABLE payroll_tax_transactions ADD CONSTRAINT ck_payroll_transaction_type CHECK (transaction_type IN ('WITHHOLD', 'CREDIT', 'REFUND', 'ADJUSTMENT'));
    END IF;
END$$;

-- Check constraint for payment status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_payment_status') THEN
        ALTER TABLE payroll_payments ADD CONSTRAINT ck_payroll_payment_status CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));
    END IF;
END$$;

-- Check constraint for settlement status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payroll_settlement_status') THEN
        ALTER TABLE payroll_final_settlements ADD CONSTRAINT ck_payroll_settlement_status CHECK (status IN ('draft', 'approved', 'posted', 'completed', 'cancelled'));
    END IF;
END$$;

INSERT INTO db_sequence (sequence_name, current_value) VALUES ('payroll_migration_seq', 178) ON CONFLICT DO NOTHING;