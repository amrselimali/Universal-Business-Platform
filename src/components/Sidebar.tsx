import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import { SIDEBAR_MENU_SECTIONS } from '../data/sidebarMenu';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calculator,
  Receipt,
  Undo2,
  Stethoscope,
  Users,
  SlidersHorizontal,
  Database,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Building2,
  ShieldCheck,
  LogOut,
  CreditCard,
  Activity,
  Calendar,
  UserCheck,
  ShieldAlert,
  Clock,
  FileText,
  Wallet,
  Truck,
  Zap,
  Warehouse,
  Boxes,
  BookOpen,
  PackagePlus,
  PackageMinus,
  ArrowDownLeft,
  ArrowUpRight,
  Contact,
  Bell,
  ExternalLink,
  LucideIcon,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { language, t, isModuleActive, resetToDefaults, canAccessView, currentUser, logout } = usePlatform();
  const isRtl = language === 'ar';

  // تعريف القائمة انتقل إلى src/data/sidebarMenu.tsx
  const menuSections = SIDEBAR_MENU_SECTIONS;

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 select-none">
      {/* Platform Architecture Indicator */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="overflow-hidden">
            <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
              Universal Business Platform
            </p>
            <p className="text-[10px] text-slate-400">
              {t('منصة إدارة الأعمال الشاملة', 'Universal Business Platform')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links with Grouped Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {menuSections.map((section, sIdx) => {
          const validItems = section.items.filter((item) => {
            if (!canAccessView(item.id)) return false;
            if (item.alwaysShow) return true;
            if (item.moduleId) return isModuleActive(item.moduleId);
            return true;
          });

          if (validItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ar' ? section.titleAr : section.titleEn}
              </div>

              {validItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <div key={item.id} className="group relative flex items-center">
                    <a
                      href={`?view=${item.id}`}
                      onClick={(e) => {
                        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                          e.preventDefault();
                          onNavigate(item.id);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                          : item.highlight
                          ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden pe-5">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-white' : item.highlight ? 'text-indigo-500' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{language === 'ar' ? item.labelAr : item.labelEn}</span>
                      </div>
                    </a>

                    {/* Dedicated Open in New Tab Button on hover */}
                    {item.id !== 'bookings' && <a
                      href={`?view=${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={language === 'ar' ? 'فتح في تبويب جديد (Open in New Tab)' : 'Open in New Tab'}
                      className={`absolute end-2 opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all cursor-pointer ${
                        isActive
                          ? 'text-white/80 hover:text-white hover:bg-indigo-700'
                          : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Info, User & Reset */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        {/* User Card with Quick Logout */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-black text-white">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
                {currentUser?.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentUser?.isAdmin ? t('مدير عام', 'Super Admin') : currentUser?.role}
              </p>
            </div>
          </div>

          <button
            id="btn-sidebar-logout"
            onClick={logout}
            title={t('تسجيل الخروج', 'Log Out')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {canAccessView('modules') && (
          <button
            onClick={() => onNavigate('modules')}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-2 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100/60 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300 transition-colors cursor-pointer"
          >
            <span>{t('تخصيص وإضافة أنشطة +', 'Configure Modules +')}</span>
            {isRtl ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}

        <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
          <span>v2.4 Pro</span>
          <button
            onClick={() => {
              if (window.confirm(t('هل تريد إعادة تعيين البيانات إلى حالتها الأولية؟', 'Reset data to defaults?'))) {
                resetToDefaults();
              }
            }}
            className="flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>{t('إعادة ضبط', 'Reset')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
