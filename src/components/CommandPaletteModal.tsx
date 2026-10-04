import React, { useState, useEffect, useRef } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Search,
  Calendar,
  Activity,
  ShoppingCart,
  Users,
  UserCheck,
  FileText,
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  SlidersHorizontal,
  Database,
  BookOpen,
  Zap,
  X,
  CornerDownLeft,
  Clock,
  Plus,
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (viewId: string) => void;
}

interface PaletteItem {
  id: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  icon: React.ElementType;
  shortcut?: string;
  viewId: string;
  actionKey?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { language, t, canAccessView, canPerformAction, activeBranch } = usePlatform();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: PaletteItem[] = [
    {
      id: 'bookings',
      titleAr: 'إدارة ومتابعة الحجوزات ومواعيد الدوام',
      titleEn: 'Bookings Management & Staff Schedule',
      categoryAr: 'العمليات',
      categoryEn: 'Operations',
      icon: Calendar,
      shortcut: 'F4',
      viewId: 'bookings',
    },
    {
      id: 'reception_ops',
      titleAr: 'شاشة التشغيل (الريسيبشن والنبضات)',
      titleEn: 'Reception Operations Run-Sheet',
      categoryAr: 'العمليات',
      categoryEn: 'Operations',
      icon: Activity,
      shortcut: 'F3',
      viewId: 'reception_ops',
    },
    {
      id: 'pos',
      titleAr: 'نقطة البيع السريعة وفواتير الكاشير',
      titleEn: 'Fast POS Cashier Terminal',
      categoryAr: 'المبيعات',
      categoryEn: 'Sales',
      icon: ShoppingCart,
      shortcut: 'F2',
      viewId: 'pos',
    },
    {
      id: 'parties',
      titleAr: 'دليل المرضى والعملاء 360',
      titleEn: 'Patients & Customers Directory',
      categoryAr: 'العملاء',
      categoryEn: 'Customers',
      icon: Users,
      shortcut: 'F6',
      viewId: 'parties',
    },
    {
      id: 'staff',
      titleAr: 'إدارة الأطباء ومقدمي الخدمة والموظفين',
      titleEn: 'Doctors, Service Providers & Staff',
      categoryAr: 'الكوادر',
      categoryEn: 'Staff',
      icon: UserCheck,
      shortcut: 'F8',
      viewId: 'staff',
    },
    {
      id: 'laser_devices',
      titleAr: 'أجهزة الليزر ومتابعة الصيانة والعدادات',
      titleEn: 'Laser Devices & Maintenance',
      categoryAr: 'الأجهزة',
      categoryEn: 'Equipment',
      icon: Zap,
      viewId: 'laser_devices',
    },
    {
      id: 'cash_receipts',
      titleAr: 'سندات القبض النقدية والتحصيل',
      titleEn: 'Cash Receipt Vouchers',
      categoryAr: 'المالية',
      categoryEn: 'Finance',
      icon: ArrowDownLeft,
      shortcut: 'F7',
      viewId: 'cash_receipts',
    },
    {
      id: 'cash_payments',
      titleAr: 'سندات الصرف النقدية والمصروفات',
      titleEn: 'Cash Payment Vouchers',
      categoryAr: 'المالية',
      categoryEn: 'Finance',
      icon: ArrowUpRight,
      viewId: 'cash_payments',
    },
    {
      id: 'invoices',
      titleAr: 'سجل فواتير المبيعات المكتملة',
      titleEn: 'Sales Invoices Log',
      categoryAr: 'المبيعات',
      categoryEn: 'Sales',
      icon: FileText,
      viewId: 'invoices',
    },
    {
      id: 'inventory_mgmt',
      titleAr: 'إدارة المخازن والجرد والتحويلات',
      titleEn: 'Warehouse & Stock Inventory',
      categoryAr: 'المخازن',
      categoryEn: 'Inventory',
      icon: Warehouse,
      viewId: 'inventory_mgmt',
    },
    {
      id: 'users',
      titleAr: 'إدارة المستخدمين وصلاحيات الأدوار والشاشات',
      titleEn: 'Users & Roles Permissions (RBAC)',
      categoryAr: 'الإدارة',
      categoryEn: 'Admin',
      icon: ShieldCheck,
      viewId: 'users',
    },
    {
      id: 'companies',
      titleAr: 'إدارة الشركات والفروع والمخازن',
      titleEn: 'Companies, Branches & Warehouses',
      categoryAr: 'الإدارة',
      categoryEn: 'Admin',
      icon: Building2,
      viewId: 'companies',
    },
    {
      id: 'modules',
      titleAr: 'تخصيص وتفعيل موديولات النظام',
      titleEn: 'Module Configurations',
      categoryAr: 'الإدارة',
      categoryEn: 'Admin',
      icon: SlidersHorizontal,
      viewId: 'modules',
    },
    {
      id: 'system_manual',
      titleAr: 'دليل المستخدم والتوثيق التقني الشامل',
      titleEn: 'System User Manual & Tech Specs',
      categoryAr: 'المساعدة',
      categoryEn: 'Help',
      icon: BookOpen,
      shortcut: 'F1',
      viewId: 'system_manual',
    },
  ];

  // Filter accessible items matching user query
  const filteredItems = items.filter((item) => {
    if (!canAccessView(item.viewId)) return false;
    if (item.actionKey && !canPerformAction(item.actionKey)) return false;

    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      item.titleAr.toLowerCase().includes(q) ||
      item.titleEn.toLowerCase().includes(q) ||
      item.categoryAr.toLowerCase().includes(q) ||
      item.categoryEn.toLowerCase().includes(q) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        onNavigate(selected.viewId);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Box */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'ابحث عن شاشة، عملية سريعة، أو اختصار... (Ctrl+K)',
              'Search screens, quick actions, or shortcuts... (Ctrl+K)'
            )}
            className="w-full bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-50 dark:divide-slate-800/40">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              <Search className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p>{t('لم يتم العثور على شاشة أو عملية تطابق البحث', 'No matching screens or actions found')}</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.viewId);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                        {language === 'ar' ? item.titleAr : item.titleEn}
                      </p>
                      <p className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {language === 'ar' ? item.categoryAr : item.categoryEn}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.shortcut && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-white/80" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>{t('الفرع النشط:', 'Active Branch:')}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {activeBranch ? (language === 'ar' ? activeBranch.name : activeBranch.nameEn) : t('كل الفروع', 'All Branches')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">↑↓ للتنقل</span>
            <span className="hidden sm:inline">Enter للاختيار</span>
          </div>
        </div>
      </div>
    </div>
  );
};
