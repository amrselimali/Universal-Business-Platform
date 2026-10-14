import React, { useState, useEffect, Suspense } from 'react';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { setRecoveryMode } from './utils/persistenceMode';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

import { ShieldAlert, ArrowRight, ArrowLeft, Database, RefreshCw } from 'lucide-react';
import { QuickActionsBar } from './components/QuickActionsBar';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { CustomizeQuickButtonsModal } from './components/CustomizeQuickButtonsModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { GlobalContextMenu } from './components/GlobalContextMenu';
import { LoginView, DynamicScreenView, DashboardView, PosView, AccountingView, InventoryView, ClinicsView, InvoicesView, PartiesView, SuppliersView, ModulesConfigView, NeonHubView, CompaniesBranchesView, UsersRolesView, ReceptionOpsView, BookingsFollowUpView, StaffManagementView, ProductManagementView, InventoryManagementView, PaymentMethodsView, AuditTrailView, ActivityLogsView, ShiftReportsView, PayrollView, LaserDevicesView, FiscalDocumentsView, CashReceiptsView, CollectionReceiptsView, CustomerRefundsView, CashPaymentsView, SpecializedTaxInvoicesView, GoodsReceiptsView, GoodsIssuesView, AttendanceManagementView, EmployeeDossierView, SmartNotificationsView, SystemManualView, MetadataStudioView } from './views/lazyViews';

/** شاشة انتظار خفيفة تظهر أثناء تحميل شاشة عند الطلب. */
const ViewLoadingFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400">
    <RefreshCw className="h-6 w-6 animate-spin" />
    <span className="text-xs font-bold">{label}</span>
  </div>
);

const MainLayout: React.FC = () => {
  const { language, t, canAccessView, currentUser, activeBranch, neonBootstrap, retryNeonBootstrap, neonDb, updateNeonConnectionString, neonConnectionInfo, neonOnline, syncNow, neonLastRefresh, isStorageHydrated, currentView, setCurrentView } = usePlatform();

  // الشاشة الحالية تأتي الآن من الـ PlatformContext (مصدر واحد لكل الشاشات)
  // حتى تستطيع أي شاشة التنقل بنفسها بدل حصر التنقل في App.tsx.

  // Keep URL query param in sync so "Open in New Tab" and bookmarking work seamlessly
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('view') !== currentView) {
        url.searchParams.set('view', currentView);
        window.history.replaceState({ view: currentView }, '', url.toString());
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const v = params.get('view');
        if (v) setCurrentView(v);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [selectedStaffDossierId, setSelectedStaffDossierId] = useState<string | undefined>(undefined);

  // If currentUser doesn't have access to the current view, redirect to first allowed view
  useEffect(() => {
    if (currentUser && !canAccessView(currentView)) {
      const candidateViews = [
        'dashboard',
        'reception_ops',
        'laser_devices',
        'bookings',
        'pos',
        'invoices',
        'parties',
        'suppliers',
        'staff',
        'payroll',
        'products',
        'inventory_mgmt',
        'inventory',
        'customer_refunds',
        'cash_receipts',
        'cash_payments',
        'tax_invoices',
        'goods_receipts',
        'goods_issues',
        'goods_vouchers',
        'fiscal_documents',
        'payment_methods',
        'accounting',
        'shift_reports',
        'audit_trail',
        'activity_logs',
        'companies',
        'users',
        'modules',
        'neon',
        'system_manual',
      ];
      const firstAllowed = candidateViews.find((v) => canAccessView(v));
      if (firstAllowed) {
        setCurrentView(firstAllowed);
      }
    }
  }, [currentUser, currentView, canAccessView]);

  // Global Keyboard shortcuts listener (Ctrl+K, F1..F8, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: Open Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Esc: Close open modals
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsCustomizeModalOpen(false);
        setIsShortcutsModalOpen(false);
        return;
      }

      // Direct Function Keys
      if (e.key === 'F1') {
        e.preventDefault();
        if (canAccessView('system_manual')) setCurrentView('system_manual');
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (canAccessView('pos')) setCurrentView('pos');
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (canAccessView('reception_ops')) setCurrentView('reception_ops');
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (canAccessView('bookings')) setCurrentView('bookings');
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (canAccessView('parties')) setCurrentView('parties');
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (canAccessView('cash_receipts')) setCurrentView('cash_receipts');
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (canAccessView('staff')) setCurrentView('staff');
      }
    };

    const handleNavigate = (e: any) => {
      if (e.detail && canAccessView(e.detail)) {
        setCurrentView(e.detail);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:navigate', handleNavigate);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:navigate', handleNavigate);
    };
  }, [canAccessView]);

  const renderActiveView = () => {
    if (!canAccessView(currentView)) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {t('غير مصرح لك بالوصول إلى هذه الشاشة', 'Access Restricted')}
          </h2>
          <p className="mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {t(
              'حسابك الحالي لا يمتلك صلاحية الدخول لشاشة هذه الخدمة. يرجى مراجعة مسؤول النظام أو اختيار شاشة أخرى مصرحة.',
              'Your current account does not have permission to view this module. Please contact your system administrator.'
            )}
          </p>
          <button
            onClick={() => {
              const candidateViews = ['dashboard', 'reception_ops', 'pos', 'invoices', 'inventory', 'accounting'];
              const firstAllowed = candidateViews.find((v) => canAccessView(v)) || 'reception_ops';
              setCurrentView(firstAllowed);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <span>{t('العودة للشاشات المصرحة', 'Go to Allowed Screen')}</span>
            {language === 'ar' ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      );
    }

    // شاشات مولّدة من محرك الشاشات (Metadata): meta_parties، meta_products، ...
    // تُبنى من تعريف الكيان في قاعدة البيانات بلا كود مكتوب لكل حقل.
    if (currentView.startsWith('meta_')) {
      return <DynamicScreenView entityCode={currentView.slice('meta_'.length)} />;
    }

    // استوديو الـ Metadata: إدارة الشاشات والحقول بلا كود.
    if (currentView === 'metadata_studio') {
      return (
        <MetadataStudioView
          onPreview={(entityCode) => setCurrentView(`meta_${entityCode}`)}
        />
      );
    }

    switch (currentView) {
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
              setSelectedStaffDossierId(staffId);
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

  // ==========================================================================
  // Professional Enterprise Architecture (Stale-While-Revalidate / Optimistic Hydration):
  // Never block the user screen if local cache or hydrated datasets are available.
  // The app renders immediately (<50ms) with existing data, and refreshes in the background.
  // A blocking splash is ONLY shown during a true cold boot on a completely empty fresh browser.
  // ==========================================================================
  const isColdBoot = neonBootstrap.status === 'loading' && !neonBootstrap.usedCache && !isStorageHydrated;
  if (isColdBoot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-xl space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white">
            <Database className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-black text-white">
            {t('قاعدة البيانات السحابية (Neon)', 'Cloud Database (Neon)')}
          </h1>
          <p className="text-xs leading-6 text-slate-300">
            {neonBootstrap.message || t('جاري تحميل البيانات...', 'Loading data...')}
          </p>
          <div className="mx-auto h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-500" />
          </div>
          <p className="text-[10px] text-slate-500">
            {t(
              'يتم التحميل من قاعدة البيانات السحابية بسرعة فائقة ثم يعمل التطبيق بسلاسة ويزامن تلقائيًا.',
              'Rapidly connects to cloud database then runs seamlessly with instant zero-latency responses.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      {/* Global Application Header */}
      <Header
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onNavigate={(view) => setCurrentView(view)}
        currentView={currentView}
      />

      {/* Show notification banner only on genuine error or missing configuration */}
      {neonBootstrap.status === 'error' || neonBootstrap.status === 'no-config' ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <span>
            {neonBootstrap.status === 'error'
              ? t('تعذر الاتصال بقاعدة البيانات — التطبيق يعمل على البيانات المحلية.', 'Cannot reach the database — the app is running on local data.')
              : t('لم يتم إعداد رابط قاعدة البيانات بعد.', 'No database connection configured yet.')}
          </span>
          <button
            type="button"
            onClick={() => void syncNow()}
            className="ms-auto rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] text-white hover:bg-amber-700 cursor-pointer"
          >
            {t('مزامنة الآن', 'Sync now')}
          </button>
        </div>
      ) : null}

      {/* User Custom Quick Actions & Speed Bar */}
      <QuickActionsBar
        onNavigate={(view) => setCurrentView(view)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenCustomize={() => setIsCustomizeModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Modals for Command Palette, Customization, and Keyboard Shortcuts */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => setCurrentView(view)}
      />

      <CustomizeQuickButtonsModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Global Right-Click Context Menu (فتح في تبويب جديد دون إلغاء الصفحة السابقة) */}
      <GlobalContextMenu currentView={currentView} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar currentView={currentView} onNavigate={(view) => setCurrentView(view)} />
        </div>

        {/* Mobile / Tablet Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative z-50 flex h-full">
              <Sidebar
                currentView={currentView}
                onNavigate={(view) => {
                  setCurrentView(view);
                  setMobileSidebarOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Dynamic Content Main Stage */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div key={`${currentView}-${activeBranch?.id || 'none'}`} className="mx-auto max-w-7xl">
            {/*
              Suspense: الشاشات تُحمَّل عند الطلب (Lazy). كل شاشة تصبح ملفاً
              مستقلاً لا يُنزَّل إلا عند فتحها، بدل تحميل 36 شاشة معاً.
            */}
            <Suspense fallback={<ViewLoadingFallback label={t('جارٍ تحميل الشاشة…', 'Loading screen…')} />}>
              {renderActiveView()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PlatformProvider>
      <AppContent />
    </PlatformProvider>
  );
};

const AppContent: React.FC = () => {
  const { currentUser, isLoggedIn } = usePlatform();

  if (!isLoggedIn || !currentUser) {
    return <LoginView />;
  }

  return <MainLayout />;
};

export default App;
