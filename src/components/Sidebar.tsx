import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calculator,
  Receipt,
  Stethoscope,
  Users,
  SlidersHorizontal,
  Database,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { language, t, isModuleActive, resetToDefaults } = usePlatform();
  const isRtl = language === 'ar';

  const menuItems = [
    {
      id: 'dashboard',
      labelAr: 'لوحة التحكم والتحليلات',
      labelEn: 'Dashboard & KPIs',
      icon: LayoutDashboard,
      alwaysShow: true,
    },
    {
      id: 'pos',
      labelAr: 'نقطة البيع السريعة (POS)',
      labelEn: 'Fast POS Terminal',
      icon: ShoppingCart,
      moduleId: 'pos_sales',
      badge: 'F2',
    },
    {
      id: 'inventory',
      labelAr: 'المخازن والأصناف',
      labelEn: 'Products & Inventory',
      icon: Package,
      moduleId: 'inventory',
    },
    {
      id: 'accounting',
      labelAr: 'الشجرة المحاسبية والقيود',
      labelEn: 'Chart of Accounts & GL',
      icon: Calculator,
      moduleId: 'accounting',
    },
    {
      id: 'invoices',
      labelAr: 'سجل فواتير المبيعات',
      labelEn: 'Sales Invoices Log',
      icon: Receipt,
      moduleId: 'pos_sales',
    },
    {
      id: 'clinics',
      labelAr: 'العيادات وبرامج العلاج',
      labelEn: 'Clinics & Patients',
      icon: Stethoscope,
      moduleId: 'clinics_records',
    },
    {
      id: 'parties',
      labelAr: 'العملاء والموردين',
      labelEn: 'Customers & Vendors',
      icon: Users,
      moduleId: 'parties',
    },
    {
      id: 'modules',
      labelAr: 'تخصيص وتفعيل الموديولات',
      labelEn: 'Modules Switcher (15)',
      icon: SlidersHorizontal,
      alwaysShow: true,
      highlight: true,
    },
    {
      id: 'neon',
      labelAr: 'قاعدة بيانات Neon PostgreSQL',
      labelEn: 'Neon Database Hub',
      icon: Database,
      alwaysShow: true,
    },
  ];

  const filteredItems = menuItems.filter((item) => {
    if (item.alwaysShow) return true;
    if (item.moduleId) return isModuleActive(item.moduleId);
    return true;
  });

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
              {t('النظام المعماري الشامل', 'Modular Platform')}
            </p>
            <p className="text-[10px] text-slate-400">
              {t('Multi-Tenant • 0$ Ready', 'Multi-Tenant • 0$ Ready')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {t('الوحدات المفعّلة للشركة', 'Active Modules')}
        </div>

        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                  : item.highlight
                  ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : item.highlight ? 'text-indigo-500' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{language === 'ar' ? item.labelAr : item.labelEn}</span>
              </div>

              {item.badge && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info & Reset */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <button
          onClick={() => onNavigate('modules')}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-2 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100/60 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300 transition-colors"
        >
          <span>{t('تخصيص وإضافة أنشطة +', 'Configure Modules +')}</span>
          {isRtl ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        <button
          onClick={() => {
            if (window.confirm(t('هل تريد إعادة تعيين البيانات إلى حالتها الأولية؟', 'Reset data to defaults?'))) {
              resetToDefaults();
            }
          }}
          className="flex w-full items-center justify-center gap-1.5 py-1 text-[10px] text-slate-400 hover:text-rose-500 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{t('إعادة ضبط البيانات التجريبية', 'Reset Demo Data')}</span>
        </button>
      </div>
    </aside>
  );
};
