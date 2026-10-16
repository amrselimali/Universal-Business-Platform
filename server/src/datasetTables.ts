/**
 * خريطة مجموعات البيانات → الجداول المنمّطة
 * ---------------------------------------------------------------------------
 * الـ API يستقبل `docKey` (مثل `erp_parties_backup`) من الواجهة، ويحتاج معرفة
 * الجدول الفعلي الذي يقرأ منه ويكتب فيه.
 *
 * ⚠️ لماذا لا نستورد `src/services/neonSchema.ts` مباشرة؟
 *   لأن `server/` حزمة مستقلة (package.json · tsconfig منفصل)، واستيراد ملف
 *   من الواجهة يخلق اعتماداً هشاً بين الحزمتين.
 *
 *   هذه الخريطة هي **نسخة مطابقة** تُفحَص آلياً في اختبارات السيرفر ضد الأصل،
 *   فأي اختلاف يُكتشف فوراً.
 *
 * 🔒 الأسماء تُتحقّق دائماً قبل استخدامها في SQL (انظر `resolveTable`).
 */

/** مجموعات البيانات العامّة (غير التابعة لمنشأة) — لا تحتوي عمود tenant_id. */
export const GLOBAL_DATASETS = new Set<string>(['erp_tenants']);

/** doc_key → اسم الجدول المنمّط. */
export const DATASET_TABLE_MAP: Readonly<Record<string, string>> = {
  erp_tenants: 'tenants',
  erp_users: 'users',
  erp_branches: 'branches',
  erp_warehouses: 'warehouses',
  erp_categories: 'categories',
  erp_products: 'products',
  erp_stock_movements: 'stock_movements',
  erp_stock_levels: 'stock_levels',
  erp_accounts: 'accounts',
  erp_journals: 'journal_entries',
  erp_parties_backup: 'parties',
  erp_invoices: 'sales_invoices',
  erp_appointments: 'appointments',
  erp_patient_followups: 'patient_follow_ups',
  erp_treatment_plans: 'treatment_plans',
  erp_cash_receipts: 'cash_receipts',
  erp_customer_refunds: 'customer_refunds',
  erp_cash_payments: 'cash_payments',
  erp_reception_shifts: 'reception_shifts',
  erp_pos_shifts: 'pos_shifts',
  erp_payment_methods: 'payment_methods',
  erp_tax_invoices: 'specialized_tax_invoices',
  erp_goods_receipts: 'goods_receipts',
  erp_goods_issues: 'goods_issues',
  erp_staff_members: 'staff_members',
  erp_payroll_runs: 'payroll_runs',
  erp_attendance_records: 'attendance_records',
  erp_inventory_audits: 'inventory_audits',
  erp_device_maintenance: 'device_maintenance',
  clinic_laser_devices: 'laser_devices',
  erp_period_locks: 'period_locks',
  erp_audit_records: 'audit_records',
  erp_activity_logs: 'activity_logs',
  erp_notifications_history: 'notifications_history',
};

/** أسماء الجداول المسموح بها — Allow-list صارم ضد SQL Injection. */
const ALLOWED_TABLES = new Set(Object.values(DATASET_TABLE_MAP));

/** صيغة معرّف SQL صالح. */
const VALID_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * يحوّل `docKey` إلى اسم الجدول — أو `null` إن لم يكن مسجّلاً.
 * لا تُستخدم الأسماء الخام في SQL أبداً بلا هذه الدالة.
 */
export function resolveTable(docKey: string): string | null {
  const table = DATASET_TABLE_MAP[docKey];
  if (!table) return null;
  // تحقّق مزدوج: الخريطة + صيغة المعرّف + قائمة السماح
  if (!VALID_IDENTIFIER.test(table) || !ALLOWED_TABLES.has(table)) return null;
  return table;
}

/** هل هذه المجموعة تابعة لمنشأة (تحتاج شرط tenant_id)؟ */
export const isTenantScoped = (docKey: string): boolean => !GLOBAL_DATASETS.has(docKey);

/** أعمدة النظام التي لا يجوز للعميل كتابتها. */
export const MANAGED_COLUMNS = new Set([
  'id', 'tenant_id', 'payload', 'updated_at', 'updated_by', 'deleted_at', 'synced_at',
]);