import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Building2,
  GitBranch,
  Warehouse as WarehouseIcon,
  Globe,
  Database,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Layers,
  Sparkles,
  User,
  Menu,
  LogOut,
  Shield,
} from 'lucide-react';

interface HeaderProps {
  onNavigate: (view: string) => void;
  currentView?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentView, onToggleSidebar }) => {
  const {
    tenant,
    tenants,
    switchTenant,
    branches,
    activeBranch,
    setActiveBranch,
    warehouses,
    activeWarehouse,
    setActiveWarehouse,
    currentUser,
    logout,
    canAccessTenant,
    canAccessBranch,
    canAccessWarehouse,
    canAccessView,
    language,
    setLanguage,
    t,
    neonDb,
    activeShift,
  } = usePlatform();

  // RBAC scoped collections
  const allowedTenants = tenants.filter((tItem) => canAccessTenant(tItem.id));
  const currentTenantBranches = branches.filter((b) => b.tenantId === tenant?.id && canAccessBranch(b.id));
  const displayBranches = currentTenantBranches.length > 0 ? currentTenantBranches : branches.filter((b) => canAccessBranch(b.id));

  const currentBranchWarehouses = warehouses.filter((w) => w.branchId === activeBranch?.id && canAccessWarehouse(w.id));
  const displayWarehouses = currentBranchWarehouses.length > 0 ? currentBranchWarehouses : warehouses.filter((w) => canAccessWarehouse(w.id));

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:px-6">
      {/* Left / Start: Brand & Company Context */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 transition-colors"
            title="القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          {canAccessView('companies') ? (
            <button
              onClick={() => onNavigate('companies')}
              title={t('إدارة الشركات والمؤسسات', 'Manage Companies')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Layers className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Layers className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              {allowedTenants && allowedTenants.length > 1 ? (
                <select
                  value={tenant?.id || ''}
                  onChange={(e) => switchTenant(e.target.value)}
                  className="font-extrabold tracking-tight text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer text-xs sm:text-sm"
                >
                  {allowedTenants.map((tItem) => (
                    <option key={tItem.id} value={tItem.id} className="dark:bg-slate-900 font-normal">
                      {language === 'ar' ? tItem.name : tItem.nameEn}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  onClick={() => canAccessView('companies') && onNavigate('companies')}
                  className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${canAccessView('companies') ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''}`}
                >
                  {language === 'ar' ? tenant?.name : tenant?.nameEn}
                </span>
              )}
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {tenant?.plan || 'Enterprise'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {t('منصة إدارة الأعمال الشاملة (Universal ERP)', 'Universal Business Platform')}
            </p>
          </div>
        </div>

        {/* Branch Switcher */}
        {displayBranches.length > 0 && (
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-750 dark:bg-slate-800 md:flex">
            <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <select
              value={activeBranch?.id || ''}
              onChange={(e) => {
                const selected = branches.find((b) => b.id === e.target.value);
                if (selected) setActiveBranch(selected);
              }}
              className="bg-transparent text-xs font-semibold text-slate-800 outline-none dark:text-slate-200 cursor-pointer"
            >
              {displayBranches.map((b) => (
                <option key={b.id} value={b.id} className="dark:bg-slate-900">
                  {language === 'ar' ? b.name : b.nameEn}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Warehouse Indicator */}
        {displayWarehouses.length > 0 && (
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300 xl:flex">
            <WarehouseIcon className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={activeWarehouse?.id || ''}
              onChange={(e) => {
                const w = warehouses.find((item) => item.id === e.target.value);
                if (w) setActiveWarehouse(w);
              }}
              className="bg-transparent text-xs text-slate-700 outline-none dark:text-slate-300 cursor-pointer"
            >
              {displayWarehouses.map((w) => (
                <option key={w.id} value={w.id} className="dark:bg-slate-900">
                  {language === 'ar' ? w.name : w.nameEn}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right / End Controls */}
      <div className="flex items-center gap-2">
        {/* Version Badge */}
        <span className="hidden lg:inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
          Version 1.01
        </span>

        {/* Active POS Shift Badge */}
        {activeShift?.status === 'Open' && canAccessView('pos') && (
          <button
            onClick={() => onNavigate('pos')}
            className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 sm:flex hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('شيفت كاشير نشط', 'POS Shift Active')}
          </button>
        )}

        {/* Neon Database Status Indicator */}
        {canAccessView('neon') && (
          <button
            onClick={() => onNavigate('neon')}
            title={t('حالة الاتصال بقاعدة بيانات Neon PostgreSQL', 'Neon PostgreSQL Connection Status')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              neonDb.connected
                ? 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300'
                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Neon:</span>
            <span className="font-bold">
              {neonDb.connected ? t('متصل', 'Connected') : t('محلي', 'Local')}
            </span>
          </button>
        )}

        {/* Fast POS Button */}
        {canAccessView('pos') && (
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('نقطة البيع POS', 'Fast POS')}</span>
          </button>
        )}

        {/* Current User Profile & Quick Logout */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => canAccessView('users') && onNavigate('users')}
            title={canAccessView('users') ? t('المستخدمين وصلاحيات الأدوار', 'Users & Roles') : currentUser?.name}
            className={`flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors ${canAccessView('users') ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : ''}`}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <span className="hidden sm:inline">{currentUser?.name?.split(' ')[0]}</span>
            <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold dark:bg-slate-700">
              {currentUser?.isAdmin ? 'Admin' : currentUser?.role}
            </span>
          </button>

          <button
            id="btn-header-logout"
            onClick={logout}
            title={t('تسجيل الخروج', 'Log Out')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Language Toggle */}
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={t('تغيير اللغة (عربي / English)', 'Switch Language')}
        >
          <Globe className="h-3.5 w-3.5 text-slate-500" />
          <span>{language === 'ar' ? 'English' : 'عربي'}</span>
        </button>
      </div>
    </header>
  );
};
