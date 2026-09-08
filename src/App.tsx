import React, { useState, useEffect } from 'react';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { PosView } from './views/PosView';
import { AccountingView } from './views/AccountingView';
import { InventoryView } from './views/InventoryView';
import { ClinicsView } from './views/ClinicsView';
import { InvoicesView } from './views/InvoicesView';
import { PartiesView } from './views/PartiesView';
import { ModulesConfigView } from './views/ModulesConfigView';
import { NeonHubView } from './views/NeonHubView';

const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const { language } = usePlatform();

  // Keyboard shortcut listener (e.g. F2 for POS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setCurrentView('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
      case 'pos':
        return <PosView />;
      case 'inventory':
        return <InventoryView />;
      case 'accounting':
        return <AccountingView />;
      case 'invoices':
        return <InvoicesView />;
      case 'clinics':
        return <ClinicsView />;
      case 'parties':
        return <PartiesView />;
      case 'modules':
        return <ModulesConfigView />;
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

export default function App() {
  return (
    <PlatformProvider>
      <MainLayout />
    </PlatformProvider>
  );
}
