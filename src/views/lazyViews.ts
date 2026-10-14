import { lazy } from 'react';

/**
 * تعريفات الشاشات المؤجّلة (Lazy Views)
 * ---------------------------------------------------------------------------
 * كل شاشة تُصبح ملفاً مستقلاً لا يُنزَّل إلا عند فتحها. كان تحميل 36 شاشة
 * معاً يجعل الحزمة الابتدائية 3.8 ميجابايت؛ الآن 515 كيلوبايت فقط.
 *
 * فُصلت هنا (بدل App.tsx) للحفاظ على صِغَر ملف التخطيط الرئيسي.
 * للإضافة: انسخ السطر وبدّل اسم الشاشة والمسار.
 */

export const LoginView = lazy(() =>
  import('./LoginView').then((m) => ({ default: m.LoginView }))
);
export const DynamicScreenView = lazy(() =>
  import('./DynamicScreenView').then((m) => ({ default: m.DynamicScreenView }))
);
export const DashboardView = lazy(() =>
  import('./DashboardView').then((m) => ({ default: m.DashboardView }))
);
export const PosView = lazy(() =>
  import('./PosView').then((m) => ({ default: m.PosView }))
);
export const AccountingView = lazy(() =>
  import('./AccountingView').then((m) => ({ default: m.AccountingView }))
);
export const InventoryView = lazy(() =>
  import('./InventoryView').then((m) => ({ default: m.InventoryView }))
);
export const ClinicsView = lazy(() =>
  import('./ClinicsView').then((m) => ({ default: m.ClinicsView }))
);
export const InvoicesView = lazy(() =>
  import('./InvoicesView').then((m) => ({ default: m.InvoicesView }))
);
export const PartiesView = lazy(() =>
  import('./PartiesView').then((m) => ({ default: m.PartiesView }))
);
export const SuppliersView = lazy(() =>
  import('./SuppliersView').then((m) => ({ default: m.SuppliersView }))
);
export const ModulesConfigView = lazy(() =>
  import('./ModulesConfigView').then((m) => ({ default: m.ModulesConfigView }))
);
export const NeonHubView = lazy(() =>
  import('./NeonHubView').then((m) => ({ default: m.NeonHubView }))
);
export const CompaniesBranchesView = lazy(() =>
  import('./CompaniesBranchesView').then((m) => ({ default: m.CompaniesBranchesView }))
);
export const UsersRolesView = lazy(() =>
  import('./UsersRolesView').then((m) => ({ default: m.UsersRolesView }))
);
export const ReceptionOpsView = lazy(() =>
  import('./ReceptionOpsView').then((m) => ({ default: m.ReceptionOpsView }))
);
export const BookingsFollowUpView = lazy(() =>
  import('./BookingsFollowUpView').then((m) => ({ default: m.BookingsFollowUpView }))
);
export const StaffManagementView = lazy(() =>
  import('./StaffManagementView').then((m) => ({ default: m.StaffManagementView }))
);
export const ProductManagementView = lazy(() =>
  import('./ProductManagementView').then((m) => ({ default: m.ProductManagementView }))
);
export const InventoryManagementView = lazy(() =>
  import('./InventoryManagementView').then((m) => ({ default: m.InventoryManagementView }))
);
export const PaymentMethodsView = lazy(() =>
  import('./PaymentMethodsView').then((m) => ({ default: m.PaymentMethodsView }))
);
export const AuditTrailView = lazy(() =>
  import('./AuditTrailView').then((m) => ({ default: m.AuditTrailView }))
);
export const ActivityLogsView = lazy(() =>
  import('./ActivityLogsView').then((m) => ({ default: m.ActivityLogsView }))
);
export const ShiftReportsView = lazy(() =>
  import('./ShiftReportsView').then((m) => ({ default: m.ShiftReportsView }))
);
export const PayrollView = lazy(() =>
  import('./PayrollView').then((m) => ({ default: m.PayrollView }))
);
export const LaserDevicesView = lazy(() =>
  import('./LaserDevicesView').then((m) => ({ default: m.LaserDevicesView }))
);
export const FiscalDocumentsView = lazy(() =>
  import('./FiscalDocumentsView').then((m) => ({ default: m.FiscalDocumentsView }))
);
export const CashReceiptsView = lazy(() =>
  import('./CashReceiptsView').then((m) => ({ default: m.CashReceiptsView }))
);
export const CollectionReceiptsView = lazy(() =>
  import('./CollectionReceiptsView').then((m) => ({ default: m.CollectionReceiptsView }))
);
export const CustomerRefundsView = lazy(() =>
  import('./CustomerRefundsView').then((m) => ({ default: m.CustomerRefundsView }))
);
export const CashPaymentsView = lazy(() =>
  import('./CashPaymentsView').then((m) => ({ default: m.CashPaymentsView }))
);
export const SpecializedTaxInvoicesView = lazy(() =>
  import('./SpecializedTaxInvoicesView').then((m) => ({ default: m.SpecializedTaxInvoicesView }))
);
export const GoodsReceiptsView = lazy(() =>
  import('./GoodsReceiptsView').then((m) => ({ default: m.GoodsReceiptsView }))
);
export const GoodsIssuesView = lazy(() =>
  import('./GoodsIssuesView').then((m) => ({ default: m.GoodsIssuesView }))
);
export const AttendanceManagementView = lazy(() =>
  import('./AttendanceManagementView').then((m) => ({ default: m.AttendanceManagementView }))
);
export const EmployeeDossierView = lazy(() =>
  import('./EmployeeDossierView').then((m) => ({ default: m.EmployeeDossierView }))
);
export const SmartNotificationsView = lazy(() =>
  import('./SmartNotificationsView').then((m) => ({ default: m.SmartNotificationsView }))
);
export const SystemManualView = lazy(() =>
  import('./SystemManualView').then((m) => ({ default: m.SystemManualView }))
);
