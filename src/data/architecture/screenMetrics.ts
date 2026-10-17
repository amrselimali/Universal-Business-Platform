/**
 * مقياس موارد الشاشات — ملف **مولَّد آلياً** (لا تُعدّله يدوياً)
 * ---------------------------------------------------------------------------
 * التوليد: node scripts/screen-metrics.mjs --update
 * التحقق في الـ CI: node scripts/screen-metrics.mjs --check
 *
 * القياس ساكن (من الكود): الأسطر · useState · useEffect · المكتبات الثقيلة.
 * أما الذاكرة وزمن الرسم فتُقاس حياً داخل المتصفح في شاشة المعمارية.
 */

export interface ScreenMetric {
  viewId: string;
  file: string;
  lines: number;
  useState: number;
  useEffect: number;
  heavyLibs: string[];
  overLimit: boolean;
}

export const SCREEN_FILE_LIMIT = 300;

export const SCREEN_METRICS: ScreenMetric[] = [
  { viewId: 'BookingsFollowUpView', file: 'src/views/BookingsFollowUpView.tsx', lines: 6061, useState: 102, useEffect: 1, heavyLibs: [], overLimit: true },
  { viewId: 'AccountingView', file: 'src/views/AccountingView.tsx', lines: 3320, useState: 58, useEffect: 6, heavyLibs: [], overLimit: true },
  { viewId: 'ReceptionOpsView', file: 'src/views/ReceptionOpsView.tsx', lines: 3054, useState: 45, useEffect: 1, heavyLibs: [], overLimit: true },
  { viewId: 'InventoryManagementView', file: 'src/views/InventoryManagementView.tsx', lines: 3005, useState: 34, useEffect: 1, heavyLibs: [], overLimit: true },
  { viewId: 'ProductManagementView', file: 'src/views/ProductManagementView.tsx', lines: 2504, useState: 22, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'CompaniesBranchesView', file: 'src/views/CompaniesBranchesView.tsx', lines: 2351, useState: 49, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'EmployeeDossierView', file: 'src/views/EmployeeDossierView.tsx', lines: 2216, useState: 14, useEffect: 3, heavyLibs: ['xlsx'], overLimit: true },
  { viewId: 'PartiesView', file: 'src/views/PartiesView.tsx', lines: 2101, useState: 40, useEffect: 3, heavyLibs: ['xlsx'], overLimit: true },
  { viewId: 'CollectionReceiptsView', file: 'src/views/CollectionReceiptsView.tsx', lines: 1951, useState: 32, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'InvoicesView', file: 'src/views/InvoicesView.tsx', lines: 1749, useState: 27, useEffect: 1, heavyLibs: [], overLimit: true },
  { viewId: 'UsersRolesView', file: 'src/views/UsersRolesView.tsx', lines: 1605, useState: 23, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'InventoryView', file: 'src/views/InventoryView.tsx', lines: 1509, useState: 16, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'LaserDevicesView', file: 'src/views/LaserDevicesView.tsx', lines: 1486, useState: 14, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'SmartNotificationsView', file: 'src/views/SmartNotificationsView.tsx', lines: 1443, useState: 12, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'StaffManagementView', file: 'src/views/StaffManagementView.tsx', lines: 1278, useState: 34, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'PosView', file: 'src/views/PosView.tsx', lines: 1188, useState: 20, useEffect: 2, heavyLibs: [], overLimit: true },
  { viewId: 'PaymentMethodsView', file: 'src/views/PaymentMethodsView.tsx', lines: 1142, useState: 16, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'SystemManualView', file: 'src/views/SystemManualView.tsx', lines: 1140, useState: 4, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'AttendanceManagementView', file: 'src/views/AttendanceManagementView.tsx', lines: 904, useState: 12, useEffect: 0, heavyLibs: ['xlsx'], overLimit: true },
  { viewId: 'CustomerRefundsView', file: 'src/views/CustomerRefundsView.tsx', lines: 845, useState: 24, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'PayrollView', file: 'src/views/PayrollView.tsx', lines: 821, useState: 14, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'NeonHubView', file: 'src/views/NeonHubView.tsx', lines: 810, useState: 19, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'SuppliersView', file: 'src/views/SuppliersView.tsx', lines: 747, useState: 8, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'ClinicsView', file: 'src/views/ClinicsView.tsx', lines: 536, useState: 5, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'ShiftReportsView', file: 'src/views/ShiftReportsView.tsx', lines: 533, useState: 3, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'DashboardView', file: 'src/views/DashboardView.tsx', lines: 472, useState: 4, useEffect: 1, heavyLibs: [], overLimit: true },
  { viewId: 'AuditTrailView', file: 'src/views/AuditTrailView.tsx', lines: 353, useState: 7, useEffect: 1, heavyLibs: [], overLimit: true },
  { viewId: 'ActivityLogsView', file: 'src/views/ActivityLogsView.tsx', lines: 348, useState: 5, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'LoginView', file: 'src/views/LoginView.tsx', lines: 342, useState: 5, useEffect: 0, heavyLibs: [], overLimit: true },
  { viewId: 'MetadataStudioView', file: 'src/views/MetadataStudioView.tsx', lines: 295, useState: 6, useEffect: 1, heavyLibs: [], overLimit: false },
  { viewId: 'DatabaseExplorerView', file: 'src/views/DatabaseExplorerView.tsx', lines: 291, useState: 12, useEffect: 2, heavyLibs: [], overLimit: false },
  { viewId: 'AccountingMappingView', file: 'src/views/AccountingMappingView.tsx', lines: 271, useState: 10, useEffect: 1, heavyLibs: [], overLimit: false },
  { viewId: 'ModulesConfigView', file: 'src/views/ModulesConfigView.tsx', lines: 261, useState: 0, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'DynamicScreenView', file: 'src/views/DynamicScreenView.tsx', lines: 226, useState: 2, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'FiscalDocumentsView', file: 'src/views/FiscalDocumentsView.tsx', lines: 203, useState: 2, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'ArchitectureView', file: 'src/views/ArchitectureView.tsx', lines: 114, useState: 1, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'SpecializedTaxInvoicesView', file: 'src/views/SpecializedTaxInvoicesView.tsx', lines: 73, useState: 1, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'CashPaymentsView', file: 'src/views/CashPaymentsView.tsx', lines: 66, useState: 1, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'CashReceiptsView', file: 'src/views/CashReceiptsView.tsx', lines: 66, useState: 1, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'GoodsIssuesView', file: 'src/views/GoodsIssuesView.tsx', lines: 66, useState: 1, useEffect: 0, heavyLibs: [], overLimit: false },
  { viewId: 'GoodsReceiptsView', file: 'src/views/GoodsReceiptsView.tsx', lines: 66, useState: 1, useEffect: 0, heavyLibs: [], overLimit: false },
];
