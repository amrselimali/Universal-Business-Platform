/**
 * Neon schema definition (هيكل جداول قاعدة البيانات السحابية).
 *
 * Each local dataset gets a matching Neon table with typed key columns for querying
 * plus a `payload` JSONB column that always holds the full record, so nested
 * structures (journal lines, shift rows, party offers, ...) are never lost.
 *
 * The same definition drives creation and future updates: every table is created with
 * `CREATE TABLE IF NOT EXISTS` and extra columns are (re)applied with
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so the migration is idempotent and safe
 * to re-run at any time.
 */

export interface NeonColumnSchema {
  name: string;
  type: string;
  /** Included in the CREATE TABLE statement (primary keys / initial columns). */
  create?: boolean;
}

export interface NeonTableSchema {
  /** Neon table name (mirrors the local dataset). */
  table: string;
  /** Local storage key this table mirrors. */
  sourceKey: string;
  columns: NeonColumnSchema[];
}

const common = (): NeonColumnSchema[] => [
  { name: 'id', type: 'VARCHAR(200)', create: true },
  { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
  { name: 'branch_id', type: 'VARCHAR(100)', create: true },
];

export const NEON_SCHEMA_TABLES: NeonTableSchema[] = [
  { table: 'tenants', sourceKey: 'erp_tenants', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'code', type: 'VARCHAR(50)', create: true },
    { name: 'name_ar', type: 'VARCHAR(255)', create: true },
    { name: 'name_en', type: 'VARCHAR(255)', create: true },
  ] },
  { table: 'users', sourceKey: 'erp_users', columns: [
    ...common(),
    { name: 'name', type: 'VARCHAR(255)', create: true },
    { name: 'username', type: 'VARCHAR(150)', create: true },
    { name: 'user_role', type: 'VARCHAR(60)', create: true },
    { name: 'is_active', type: 'BOOLEAN', create: true },
  ] },
  { table: 'branches', sourceKey: 'erp_branches', columns: [
    ...common(),
    { name: 'name', type: 'VARCHAR(255)', create: true },
    { name: 'code', type: 'VARCHAR(50)' },
    { name: 'phone', type: 'VARCHAR(50)' },
  ] },
  { table: 'warehouses', sourceKey: 'erp_warehouses', columns: [
    ...common(),
    { name: 'name', type: 'VARCHAR(255)', create: true },
    { name: 'code', type: 'VARCHAR(50)' },
  ] },
  { table: 'categories', sourceKey: 'erp_categories', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'name', type: 'VARCHAR(255)', create: true },
  ] },
  { table: 'products', sourceKey: 'erp_products', columns: [
    ...common(),
    { name: 'sku', type: 'VARCHAR(100)', create: true },
    { name: 'name_ar', type: 'VARCHAR(255)', create: true },
    { name: 'selling_price', type: 'NUMERIC(15, 2)', create: true },
    { name: 'is_service', type: 'BOOLEAN', create: true },
  ] },
  { table: 'stock_movements', sourceKey: 'erp_stock_movements', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'product_id', type: 'VARCHAR(100)', create: true },
    { name: 'warehouse_id', type: 'VARCHAR(100)', create: true },
    { name: 'movement_type', type: 'VARCHAR(50)', create: true },
    { name: 'quantity', type: 'NUMERIC(15, 3)', create: true },
  ] },
  { table: 'stock_levels', sourceKey: 'erp_stock_levels', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'product_id', type: 'VARCHAR(100)', create: true },
    { name: 'warehouse_id', type: 'VARCHAR(100)', create: true },
    { name: 'quantity_on_hand', type: 'NUMERIC(15, 3)', create: true },
  ] },
  { table: 'accounts', sourceKey: 'erp_accounts', columns: [
    ...common(),
    { name: 'code', type: 'VARCHAR(50)', create: true },
    { name: 'name_ar', type: 'VARCHAR(255)', create: true },
    { name: 'account_type', type: 'VARCHAR(40)', create: true },
    { name: 'balance', type: 'NUMERIC(15, 2)', create: true },
  ] },
  // ملاحظة معمارية: أُخرج `erp_journals` من حِزمة الإقلاع.
  // دفتر اليومية يُقرأ من قاعدة البيانات (fn_journal_list / fn_journal_summary)،
  // والترحيل يكتبه ذرّياً في الداتابيز (fn_post_journal).
  { table: 'parties', sourceKey: 'erp_parties_backup', columns: [
    ...common(),
    { name: 'name', type: 'VARCHAR(255)', create: true },
    { name: 'party_type', type: 'VARCHAR(40)', create: true },
    { name: 'phone', type: 'VARCHAR(50)' },
    { name: 'customer_code', type: 'VARCHAR(50)' },
    { name: 'balance', type: 'NUMERIC(15, 2)', create: true },
  ] },
  // ملاحظة معمارية: أُخرج `erp_invoices` من حِزمة الإقلاع.
  // كل مستهلكي الفواتير يقرأون من دوال قاعدة البيانات (fn_invoice_list / summary / detail)،
  // والكتابة تتم عبر commands/API مع تمرير لقطة الفاتورة من الشاشة.
  { table: 'appointments', sourceKey: 'erp_appointments', columns: [
    ...common(),
    { name: 'patient_name', type: 'VARCHAR(255)', create: true },
    { name: 'doctor_name', type: 'VARCHAR(255)' },
    { name: 'service_name_ar', type: 'VARCHAR(255)' },
    { name: 'appointment_date', type: 'VARCHAR(20)', create: true },
    { name: 'appointment_time', type: 'VARCHAR(20)' },
    { name: 'status', type: 'VARCHAR(50)', create: true },
  ] },
  { table: 'patient_follow_ups', sourceKey: 'erp_patient_followups', columns: [
    ...common(),
    { name: 'patient_name', type: 'VARCHAR(255)', create: true },
    { name: 'follow_up_date', type: 'VARCHAR(20)', create: true },
    { name: 'reason', type: 'TEXT' },
    { name: 'status', type: 'VARCHAR(50)', create: true },
  ] },
  { table: 'treatment_plans', sourceKey: 'erp_treatment_plans', columns: [
    ...common(),
    { name: 'patient_name', type: 'VARCHAR(255)', create: true },
    { name: 'title', type: 'VARCHAR(255)' },
    { name: 'status', type: 'VARCHAR(50)', create: true },
  ] },
  { table: 'cash_receipts', sourceKey: 'erp_cash_receipts', columns: [
    ...common(),
    { name: 'voucher_number', type: 'VARCHAR(100)', create: true },
    { name: 'receipt_date', type: 'VARCHAR(20)', create: true },
    { name: 'amount', type: 'NUMERIC(15, 2)', create: true },
    { name: 'party_id', type: 'VARCHAR(200)' },
    { name: 'customer_code', type: 'VARCHAR(50)' },
    { name: 'status', type: 'VARCHAR(40)', create: true },
  ] },
  { table: 'customer_refunds', sourceKey: 'erp_customer_refunds', columns: [
    ...common(),
    { name: 'voucher_number', type: 'VARCHAR(100)', create: true },
    { name: 'refund_date', type: 'VARCHAR(20)', create: true },
    { name: 'amount', type: 'NUMERIC(15, 2)', create: true },
    { name: 'units', type: 'NUMERIC(15, 3)' },
    { name: 'party_id', type: 'VARCHAR(200)' },
    { name: 'customer_code', type: 'VARCHAR(50)' },
    { name: 'status', type: 'VARCHAR(40)', create: true },
  ] },
  { table: 'cash_payments', sourceKey: 'erp_cash_payments', columns: [
    ...common(),
    { name: 'voucher_number', type: 'VARCHAR(100)', create: true },
    { name: 'payment_date', type: 'VARCHAR(20)', create: true },
    { name: 'amount', type: 'NUMERIC(15, 2)', create: true },
    { name: 'paid_to', type: 'VARCHAR(255)' },
  ] },
  { table: 'reception_shifts', sourceKey: 'erp_reception_shifts', columns: [
    ...common(),
    { name: 'shift_number', type: 'VARCHAR(100)', create: true },
    { name: 'shift_date', type: 'VARCHAR(20)', create: true },
    { name: 'status', type: 'VARCHAR(40)', create: true },
  ] },
  { table: 'pos_shifts', sourceKey: 'erp_pos_shifts', columns: [
    ...common(),
    { name: 'status', type: 'VARCHAR(40)', create: true },
    { name: 'opened_at', type: 'VARCHAR(40)' },
  ] },
  { table: 'payment_methods', sourceKey: 'erp_payment_methods', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'code', type: 'VARCHAR(50)', create: true },
    { name: 'name_ar', type: 'VARCHAR(255)', create: true },
    { name: 'method_type', type: 'VARCHAR(40)' },
    { name: 'linked_account_id', type: 'VARCHAR(200)' },
  ] },
  { table: 'specialized_tax_invoices', sourceKey: 'erp_tax_invoices', columns: [
    ...common(),
    { name: 'invoice_number', type: 'VARCHAR(100)', create: true },
    { name: 'invoice_date', type: 'VARCHAR(20)' },
    { name: 'total_amount', type: 'NUMERIC(15, 2)' },
  ] },
  { table: 'goods_receipts', sourceKey: 'erp_goods_receipts', columns: [
    ...common(),
    { name: 'grn_number', type: 'VARCHAR(100)', create: true },
    { name: 'supplier_id', type: 'VARCHAR(200)' },
    { name: 'voucher_date', type: 'VARCHAR(20)' },
  ] },
  { table: 'goods_issues', sourceKey: 'erp_goods_issues', columns: [
    ...common(),
    { name: 'gin_number', type: 'VARCHAR(100)', create: true },
    { name: 'voucher_date', type: 'VARCHAR(20)' },
  ] },
  { table: 'staff_members', sourceKey: 'erp_staff_members', columns: [
    ...common(),
    { name: 'name', type: 'VARCHAR(255)', create: true },
    { name: 'staff_role', type: 'VARCHAR(100)' },
  ] },
  { table: 'payroll_runs', sourceKey: 'erp_payroll_runs', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'month', type: 'VARCHAR(20)', create: true },
    { name: 'status', type: 'VARCHAR(40)' },
  ] },
  { table: 'attendance_records', sourceKey: 'erp_attendance_records', columns: [
    ...common(),
    { name: 'staff_id', type: 'VARCHAR(200)', create: true },
    { name: 'attendance_date', type: 'VARCHAR(20)', create: true },
    { name: 'check_in', type: 'VARCHAR(20)' },
  ] },
  { table: 'inventory_audits', sourceKey: 'erp_inventory_audits', columns: [
    ...common(),
    { name: 'audit_number', type: 'VARCHAR(100)', create: true },
    { name: 'audit_date', type: 'VARCHAR(20)' },
    { name: 'status', type: 'VARCHAR(40)' },
  ] },
  { table: 'device_maintenance', sourceKey: 'erp_device_maintenance', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'device_name', type: 'VARCHAR(255)', create: true },
    { name: 'maintenance_date', type: 'VARCHAR(20)', create: true },
    { name: 'cost', type: 'NUMERIC(15, 2)' },
  ] },
  { table: 'laser_devices', sourceKey: 'clinic_laser_devices', columns: [
    ...common(),
    { name: 'name', type: 'VARCHAR(255)', create: true },
    { name: 'serial_number', type: 'VARCHAR(150)' },
  ] },
  // أُخرج `erp_period_locks` من الإقلاع: يُقرأ من accounting_period_locks في الداتابيز.
  { table: 'audit_records', sourceKey: 'erp_audit_records', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'entity_type', type: 'VARCHAR(80)' },
    { name: 'action_type', type: 'VARCHAR(40)' },
    { name: 'performed_at', type: 'VARCHAR(40)' },
  ] },
  // أُخرج `erp_activity_logs` من الإقلاع: يُقرأ من الداتابيز بالصفحات (loadActivityPage).
  { table: 'notifications_history', sourceKey: 'erp_notifications_history', columns: [
    { name: 'id', type: 'VARCHAR(200)', create: true },
    { name: 'tenant_id', type: 'VARCHAR(100)', create: true },
    { name: 'title', type: 'VARCHAR(255)' },
    { name: 'notification_type', type: 'VARCHAR(60)' },
  ] },
];

/** Builds the CREATE TABLE statement (idempotent). */
/** History/archive table: every previous version of a document is kept here before it is overwritten. */


export function buildCreateTableSql(schema: NeonTableSchema): string {
  const created = schema.columns.filter((column) => column.create);
  const body = created.map((column) => `  ${column.name} ${column.type}`).join(',\n');
  return `CREATE TABLE IF NOT EXISTS ${schema.table} (\n${body},\n  payload JSONB,\n  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`;
}

/** Builds the ADD COLUMN statements that keep an existing table up to date. */
export function buildAlterTableSql(schema: NeonTableSchema): string[] {
  const statements = schema.columns
    .filter((column) => !column.create)
    .map((column) => `ALTER TABLE ${schema.table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};`);
  // Existing tables (created by older syncs) may not have the payload/synced_at columns yet.
  statements.push(`ALTER TABLE ${schema.table} ADD COLUMN IF NOT EXISTS payload JSONB;`);
  statements.push(`ALTER TABLE ${schema.table} ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  return statements;
}

/** The CREATE TABLE statement for the unified document store. */
