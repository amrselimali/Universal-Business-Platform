/**
 * كل مجموعات البيانات المخزّنة في Neon — تعريف نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` (12,241 سطر) كخطوة سادسة في تقسيمه.
 *
 * الأهمية: هذه القائمة هي **عقد التخزين**. أي مجموعة بيانات تُنسى هنا
 * لا تُحفظ ولا تُستعاد — أي أن بيانات المستخدم تضيع بصمت. لذلك يتحقق
 * الاختبار المصاحب من وجود كل المجموعات الـ 34 بلا تكرار.
 */

export interface DatasetSource {
  allAccounts: unknown[];
  allAppointments: unknown[];
  allAttendanceRecords: unknown[];
  allAuditRecords: unknown[];
  allBranches: unknown[];
  allCashPayments: unknown[];
  allCashReceipts: unknown[];
  allCategories: unknown[];
  allCustomerRefunds: unknown[];
  allDeviceMaintenance: unknown[];
  allGoodsIssues: unknown[];
  allGoodsReceipts: unknown[];
  allInventoryAudits: unknown[];
  allInvoices: unknown[];
  allJournals: unknown[];
  allLaserDevices: unknown[];
  allNotifications: unknown[];
  allParties: unknown[];
  allPatientFollowUps: unknown[];
  allPaymentMethods: unknown[];
  allPayrollRuns: unknown[];
  allPeriodLocks: unknown[];
  allPosShifts: unknown[];
  allProducts: unknown[];
  allReceptionShifts: unknown[];
  allSpecializedTaxInvoices: unknown[];
  allStaffMembers: unknown[];
  allStockMovements: unknown[];
  allTenants: unknown[];
  allTreatmentPlans: unknown[];
  allUserActivityLogs: unknown[];
  allUsers: unknown[];
  allWarehouses: unknown[];
  stockLevels: unknown[];
}

export interface DatasetDocument {
  key: string;
  payload: unknown;
}

/** عدد مجموعات البيانات المخزّنة = 34. */
export const DATASET_COUNT = 34;

/**
 * يبني قائمة كل مجموعات البيانات جاهزة للمزامنة أو النسخ الاحتياطي.
 * تُستخدم في: المزامنة التلقائية، النقل الكامل، وتصدير النسخة الاحتياطية.
 */
export const buildDatasetDocuments = (source: DatasetSource): DatasetDocument[] => [
  { key: 'erp_tenants', payload: source.allTenants },
  { key: 'erp_users', payload: source.allUsers },
  { key: 'erp_branches', payload: source.allBranches },
  { key: 'erp_warehouses', payload: source.allWarehouses },
  { key: 'erp_categories', payload: source.allCategories },
  { key: 'erp_products', payload: source.allProducts },
  { key: 'erp_stock_movements', payload: source.allStockMovements },
  { key: 'erp_stock_levels', payload: source.stockLevels },
  { key: 'erp_accounts', payload: source.allAccounts },
  { key: 'erp_journals', payload: source.allJournals },
  { key: 'erp_parties_backup', payload: source.allParties },
  { key: 'erp_invoices', payload: source.allInvoices },
  { key: 'erp_appointments', payload: source.allAppointments },
  { key: 'erp_patient_followups', payload: source.allPatientFollowUps },
  { key: 'erp_treatment_plans', payload: source.allTreatmentPlans },
  { key: 'erp_cash_receipts', payload: source.allCashReceipts },
  { key: 'erp_customer_refunds', payload: source.allCustomerRefunds },
  { key: 'erp_cash_payments', payload: source.allCashPayments },
  { key: 'erp_reception_shifts', payload: source.allReceptionShifts },
  { key: 'erp_pos_shifts', payload: source.allPosShifts },
  { key: 'erp_payment_methods', payload: source.allPaymentMethods },
  { key: 'erp_tax_invoices', payload: source.allSpecializedTaxInvoices },
  { key: 'erp_goods_receipts', payload: source.allGoodsReceipts },
  { key: 'erp_goods_issues', payload: source.allGoodsIssues },
  { key: 'erp_staff_members', payload: source.allStaffMembers },
  { key: 'erp_payroll_runs', payload: source.allPayrollRuns },
  { key: 'erp_attendance_records', payload: source.allAttendanceRecords },
  { key: 'erp_inventory_audits', payload: source.allInventoryAudits },
  { key: 'erp_device_maintenance', payload: source.allDeviceMaintenance },
  { key: 'clinic_laser_devices', payload: source.allLaserDevices },
  { key: 'erp_period_locks', payload: source.allPeriodLocks },
  { key: 'erp_audit_records', payload: source.allAuditRecords },
  { key: 'erp_activity_logs', payload: source.allUserActivityLogs },
  { key: 'erp_notifications_history', payload: source.allNotifications },
];
