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
  LucideIcon,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

interface MenuItemDef {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  alwaysShow?: boolean;
  moduleId?: string;
  badge?: string;
  badgeColor?: string;
  highlight?: boolean;
}

interface MenuSectionDef {
  titleAr: string;
  titleEn: string;
  items: MenuItemDef[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { language, t, isModuleActive, resetToDefaults, canAccessView, currentUser, logout, activeReceptionShift } = usePlatform();
  const isRtl = language === 'ar';

  const menuSections: MenuSectionDef[] = [
    {
      titleAr: 'العمليات والتشغيل اليومي',
      titleEn: 'Daily Operations',
      items: [
        {
          id: 'dashboard',
          labelAr: 'لوحة التحكم والتحليلات',
          labelEn: 'Dashboard & KPIs',
          icon: LayoutDashboard,
          alwaysShow: true,
        },
        {
          id: 'reception_ops',
          labelAr: 'شاشة التشغيل (الريسيبشن)',
          labelEn: 'Reception Run-Sheet',
          icon: Activity,
          alwaysShow: true,
          badge: activeReceptionShift ? 'مفتوح' : undefined,
          badgeColor: 'bg-emerald-500 text-white animate-pulse',
        },
        {
          id: 'laser_devices',
          labelAr: 'أجهزة ومعدات الليزر',
          labelEn: 'Laser Devices Directory',
          icon: Zap,
          alwaysShow: true,
          badge: 'جديد',
          badgeColor: 'bg-amber-500 text-white',
        },
        {
          id: 'bookings',
          labelAr: 'الحجوزات والمتابعة',
          labelEn: 'Bookings & Follow-ups',
          icon: Calendar,
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
          id: 'invoices',
          labelAr: 'سجل فواتير المبيعات',
          labelEn: 'Sales Invoices Log',
          icon: Receipt,
          moduleId: 'pos_sales',
        },
      ],
    },
    {
      titleAr: 'الكوادر والعملاء والخدمات',
      titleEn: 'Directory & Management',
      items: [
        {
          id: 'parties',
          labelAr: 'المرضى والعملاء 360',
          labelEn: 'Patients & Customers',
          icon: Users,
          moduleId: 'parties',
        },
        {
          id: 'suppliers',
          labelAr: 'سجل وإدارة الموردين',
          labelEn: 'Suppliers Directory',
          icon: Truck,
          moduleId: 'parties',
        },
        {
          id: 'staff',
          labelAr: 'إدارة الموظفين',
          labelEn: 'Employee Management',
          icon: UserCheck,
          alwaysShow: true,
        },
        {
          id: 'payroll',
          labelAr: 'مسير الرواتب والأجور',
          labelEn: 'Staff Payroll & Salaries',
          icon: Wallet,
          alwaysShow: true,
          badge: 'جديد',
          badgeColor: 'bg-emerald-500 text-white',
        },
        {
          id: 'products',
          labelAr: 'إدارة المنتجات والخدمات',
          labelEn: 'Products & Services',
          icon: Boxes,
          moduleId: 'inventory',
        },
        {
          id: 'inventory_mgmt',
          labelAr: 'إدارة المخازن والجرد',
          labelEn: 'Warehouse & Stocktaking',
          icon: Warehouse,
          moduleId: 'inventory',
          badge: 'جرد وتسوية',
          badgeColor: 'bg-indigo-600 text-white',
        },
        {
          id: 'payment_methods',
          labelAr: 'طرق السداد وإيصالات الدفع',
          labelEn: 'Payment Methods & Receipt',
          icon: CreditCard,
          alwaysShow: true,
        },
        {
          id: 'accounting',
          labelAr: 'الشجرة المحاسبية والقيود',
          labelEn: 'Chart of Accounts & GL',
          icon: Calculator,
          moduleId: 'accounting',
        },
        {
          id: 'shift_reports',
          labelAr: 'تقارير شيتات التشغيل',
          labelEn: 'Historical Shift Reports',
          icon: FileText,
          alwaysShow: true,
        },
      ],
    },
    {
      titleAr: 'الرقابة والشركات والإعدادات',
      titleEn: 'Audit, Security & Platform',
      items: [
        {
          id: 'audit_trail',
          labelAr: 'سجل الرقابة والمحذوفات',
          labelEn: 'Audit Trail & Diffs',
          icon: ShieldAlert,
          alwaysShow: true,
        },
        {
          id: 'activity_logs',
          labelAr: 'سجل نشاط المستخدمين',
          labelEn: 'User Activity Logs',
          icon: Clock,
          alwaysShow: true,
        },
        {
          id: 'companies',
          labelAr: 'إدارة الشركات والفروع',
          labelEn: 'Companies & Branches',
          icon: Building2,
          alwaysShow: true,
        },
        {
          id: 'users',
          labelAr: 'المستخدمين والصلاحيات (RBAC)',
          labelEn: 'Users & Permissions',
          icon: ShieldCheck,
          alwaysShow: true,
        },
        {
          id: 'modules',
          labelAr: 'تخصيص وتفعيل الموديولات',
          labelEn: 'Modules Switcher',
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
      ],
    },
  ];

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
              {t('نظام إدارة المنشآت الطبية والشركات', 'Medical & Enterprise ERP')}
            </p>
            <p className="text-[10px] text-slate-400">
              {t('Multi-Tenant • Multi-Branch', 'Multi-Tenant • Multi-Branch')}
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
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                        : item.highlight
                        ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-white' : item.highlight ? 'text-indigo-500' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{language === 'ar' ? item.labelAr : item.labelEn}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                          item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
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
