import React from 'react';
import {
  AccountingMappingView,
  AccountingView,
  ActivityLogsView,
  ArchitectureView,
  AttendanceManagementView,
  AuditTrailView,
  BookingsFollowUpView,
  CashPaymentsView,
  CashReceiptsView,
  ClinicsView,
  CollectionReceiptsView,
  CompaniesBranchesView,
  CustomerRefundsView,
  DashboardView,
  DatabaseExplorerView,
  DynamicScreenView,
  EmployeeDossierView,
  FiscalDocumentsView,
  GoodsIssuesView,
  GoodsReceiptsView,
  InventoryManagementView,
  InvoicesView,
  LaserDevicesView,
  MetadataStudioView,
  ModulesConfigView,
  NeonHubView,
  PartiesView,
  PaymentMethodsView,
  PayrollView,
  PosView,
  ProductManagementView,
  ReceptionOpsView,
  ShiftReportsView,
  SmartNotificationsView,
  SpecializedTaxInvoicesView,
  StaffManagementView,
  SuppliersView,
  SystemManualView,
  UsersRolesView,
} from '../views/lazyViews';

/**
 * سجل الشاشات التنفيذي (Active View Renderer)
 * ---------------------------------------------------------------------------
 * نُقل هذا المنطق خارج `App.tsx` (وخارج مجلد `views` عمداً) لسببين:
 *   1. إضافة أي شاشة جديدة كانت تُكبّر ملف التخطيط الرئيسي — وهو ما تمنعه بوابة
 *      حد الأسطر. الآن الإضافة هنا فقط، و`App.tsx` يبقى مسؤولاً عن الهيكل العام.
 *   2. اختبار سلامة الشاشات يمنع استيراد أي شاشة مباشرة داخل `App.tsx` ويُلزم
 *      المرور بـ `lazyViews` (تقسيم الحزمة). وُجد هذا الملف في `components/`
 *      ليبقى فحص ذلك الاختبار فعّالاً بلا استثناءات: الشاشات كلها تُحمَّل عند
 *      الطلب، ولا يُستورد هنا إلا مُغلّفات `lazy`.
 */

export interface ActiveViewContext {
  /** التنقّل بين الشاشات — يأتي من الـ PlatformContext عبر App.tsx. */
  setCurrentView: (view: string) => void;
  /** الموظف المختار لفتح ملفه الوظيفي مباشرة (حالة محفوظة في App.tsx). */
  selectedStaffDossierId?: string;
  setSelectedStaffDossierId?: (staffId: string) => void;
}

export const renderActiveView = (viewId: string, ctx: ActiveViewContext): React.ReactNode => {
  const { setCurrentView, selectedStaffDossierId, setSelectedStaffDossierId } = ctx;

  // شاشات مولّدة من محرك الشاشات (Metadata): meta_parties، meta_products، ...
  // تُبنى من تعريف الكيان في قاعدة البيانات بلا كود مكتوب لكل حقل.
  if (viewId.startsWith('meta_')) {
    return <DynamicScreenView entityCode={viewId.slice('meta_'.length)} />;
  }

  // ربط العمليات بالحسابات — المصدر الوحيد لقيود اليومية.
  if (viewId === 'accounting_mapping') return <AccountingMappingView />;

  // استوديو الـ Metadata: إدارة الشاشات والحقول بلا كود.
  if (viewId === 'metadata_studio') {
    return <MetadataStudioView onPreview={(code) => setCurrentView(`meta_${code}`)} />;
  }

  // إدارة قاعدة البيانات من الواجهة (قراءة/كتابة/بنية) — محكومة بالصلاحيات.
  if (viewId === 'database_admin') return <DatabaseExplorerView />;

  // معمارية المنظومة الجديدة: توثيق المعمارية المعتمدة + بوابات الفحص الحقيقية.
  if (viewId === 'architecture') return <ArchitectureView />;

  switch (viewId) {
    case 'dashboard':
      return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
    case 'reception_ops':
      return <ReceptionOpsView onNavigateToLaserDevices={() => setCurrentView('laser_devices')} />;
    case 'laser_devices':
      return <LaserDevicesView onNavigateToReception={() => setCurrentView('reception_ops')} />;
    case 'bookings':
      return <BookingsFollowUpView />;
    case 'pos':
      return <PosView />;
    case 'invoices':
      return <InvoicesView />;
    case 'collection_receipts':
      return <CollectionReceiptsView />;
    case 'customer_refunds':
      return <CustomerRefundsView />;
    case 'parties':
      return <PartiesView />;
    case 'suppliers':
      return <SuppliersView />;
    case 'staff':
      return (
        <StaffManagementView
          onNavigateToPayroll={() => setCurrentView('payroll')}
          onNavigateToDossier={(staffId) => {
            setSelectedStaffDossierId?.(staffId);
            setCurrentView('employee_dossier');
          }}
        />
      );
    case 'attendance':
      return <AttendanceManagementView />;
    case 'payroll':
      return <PayrollView />;
    case 'employee_dossier':
      return <EmployeeDossierView initialStaffId={selectedStaffDossierId} />;
    case 'products':
      return <ProductManagementView />;
    case 'inventory_mgmt':
      return <InventoryManagementView />;
    case 'inventory':
      return <ProductManagementView />;
    case 'payment_methods':
      return <PaymentMethodsView />;
    case 'cash_receipts':
      return <CashReceiptsView />;
    case 'cash_payments':
      return <CashPaymentsView />;
    case 'tax_invoices':
      return <SpecializedTaxInvoicesView />;
    case 'goods_receipts':
      return <GoodsReceiptsView />;
    case 'goods_issues':
      return <GoodsIssuesView />;
    case 'fiscal_documents':
      return <FiscalDocumentsView initialTab="receipts" />;
    case 'goods_vouchers':
      return <GoodsReceiptsView />;
    case 'accounting':
      return <AccountingView />;
    case 'shift_reports':
      return <ShiftReportsView />;
    case 'audit_trail':
      return <AuditTrailView />;
    case 'activity_logs':
      return <ActivityLogsView />;
    case 'clinics':
      return <ClinicsView />;
    case 'modules':
      return <ModulesConfigView />;
    case 'companies':
      return <CompaniesBranchesView />;
    case 'users':
      return <UsersRolesView />;
    case 'neon':
      return <NeonHubView />;
    case 'notifications_config':
      return <SmartNotificationsView onNavigate={(view) => setCurrentView(view)} />;
    case 'system_manual':
      return <SystemManualView />;
    default:
      return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
  }
};
