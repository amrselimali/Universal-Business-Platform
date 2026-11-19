CREATE TABLE IF NOT EXISTS payroll_journal_links (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
	journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE RESTRICT, posting_type varchar(30) NOT NULL,
	status varchar(20) NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (payroll_run_id, posting_type)
);
CREATE TABLE IF NOT EXISTS payroll_payments (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
	employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, payment_method_code varchar(30) NOT NULL,
	amount numeric(19,4) NOT NULL CHECK (amount > 0), currency_code varchar(20) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'pending', external_reference varchar(200),
 idempotency_key varchar(100) NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_payment_transactions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payroll_payments(id) ON DELETE RESTRICT,
	amount numeric(19,4) NOT NULL CHECK (amount > 0), transaction_key varchar(100) NOT NULL UNIQUE,
	paid_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id) ON DELETE SET NULL
);
