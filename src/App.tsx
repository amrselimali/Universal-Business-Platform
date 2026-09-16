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
import { ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const { language, t, canAccessView, currentUser } = usePlatform();

  // If currentUser doesn't have access to the default dashboard, redirect to first allowed view
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
        'payment_methods',
        'accounting',
        'shift_reports',
        'audit_trail',
        'activity_logs',
        'companies',
        'users',
        'modules',
        'neon',
      ];
      const firstAllowed = candidateViews.find((v) => canAccessView(v));
      if (firstAllowed) {
        setCurrentView(firstAllowed);
      }
    }
  }, [currentUser, currentView, canAccessView]);

  // Keyboard shortcut listener (e.g. F2 for POS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (canAccessView('pos')) {
          setCurrentView('pos');
        }
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
      case 'parties':
        return <PartiesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'staff':
        return <StaffManagementView onNavigateToPayroll={() => setCurrentView('payroll')} />;
      case 'payroll':
        return <PayrollView />;
      case 'products':
        return <ProductManagementView />;
      case 'inventory_mgmt':
        return <InventoryManagementView />;
      case 'inventory':
        return <ProductManagementView />;
      case 'payment_methods':
        return <PaymentMethodsView />;
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
          <div className="mx-auto max-w-7xl">
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
