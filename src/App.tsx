import React, { useState, useEffect } from 'react';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { PosView } from './views/PosView';
import { AccountingView } from './views/AccountingView';
import { InventoryView } from './views/InventoryView';
import { ClinicsView } from './views/ClinicsView';
import { InvoicesView } from './views/InvoicesView';
import { PartiesView } from './views/PartiesView';
import { SuppliersView } from './views/SuppliersView';
import { ModulesConfigView } from './views/ModulesConfigView';
import { NeonHubView } from './views/NeonHubView';
import { CompaniesBranchesView } from './views/CompaniesBranchesView';
import { UsersRolesView } from './views/UsersRolesView';
import { ReceptionOpsView } from './views/ReceptionOpsView';
import { BookingsFollowUpView } from './views/BookingsFollowUpView';
import { StaffManagementView } from './views/StaffManagementView';
import { ProductManagementView } from './views/ProductManagementView';
import { InventoryManagementView } from './views/InventoryManagementView';
import { PaymentMethodsView } from './views/PaymentMethodsView';
import { AuditTrailView } from './views/AuditTrailView';
import { ActivityLogsView } from './views/ActivityLogsView';
import { ShiftReportsView } from './views/ShiftReportsView';
import { PayrollView } from './views/PayrollView';
import { LaserDevicesView } from './views/LaserDevicesView';
import { FiscalDocumentsView } from './views/FiscalDocumentsView';
import { CashReceiptsView } from './views/CashReceiptsView';
import { CollectionReceiptsView } from './views/CollectionReceiptsView';
import { CashPaymentsView } from './views/CashPaymentsView';
import { SpecializedTaxInvoicesView } from './views/SpecializedTaxInvoicesView';
import { GoodsReceiptsView } from './views/GoodsReceiptsView';
import { GoodsIssuesView } from './views/GoodsIssuesView';
import { AttendanceManagementView } from './views/AttendanceManagementView';
import { EmployeeDossierView } from './views/EmployeeDossierView';
import { SmartNotificationsView } from './views/SmartNotificationsView';
import { SystemManualView } from './views/SystemManualView';
import { ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react';
import { QuickActionsBar } from './components/QuickActionsBar';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { CustomizeQuickButtonsModal } from './components/CustomizeQuickButtonsModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { GlobalContextMenu } from './components/GlobalContextMenu';

const MainLayout: React.FC = () => {
  const { language, t, canAccessView, currentUser, activeBranch } = usePlatform();

  // Load preferred landing view from URL query param, hash, or localStorage (Supports Open in New Tab)
  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view');
      if (urlView) return urlView;

      if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        if (hash) return hash;
      }

      const saved = localStorage.getItem('erp_default_view');
      if (saved) return saved;
    } catch {}
    return 'dashboard';
  });

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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  return (
    <div className="flex h-screen w-full flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      {/* Global Application Header */}
      <Header
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onNavigate={(view) => setCurrentView(view)}
        currentView={currentView}
      />

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
            {renderActiveView()}
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
