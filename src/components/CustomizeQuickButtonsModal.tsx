import React, { useState, useEffect } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  SlidersHorizontal,
  X,
  Check,
  Sparkles,
  Calendar,
  Activity,
  ShoppingCart,
  ArrowDownLeft,
  Users,
  Clock,
  Printer,
  Save,
  RotateCcw,
  Building2,
  LayoutDashboard,
} from 'lucide-react';

interface CustomizeQuickButtonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export interface QuickButtonOption {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
  viewId: string;
  actionType?: string;
  defaultChecked: boolean;
}

export const AVAILABLE_QUICK_BUTTONS: QuickButtonOption[] = [
  {
    id: 'btn_new_booking',
    labelAr: '+ حجز موعد جديد',
    labelEn: '+ New Booking',
    icon: Calendar,
    viewId: 'bookings',
    actionType: 'open_add_booking',
    defaultChecked: true,
  },
  {
    id: 'btn_new_run_row',
    labelAr: '+ حركة تشغيل جديدة',
    labelEn: '+ New Shift Run',
    icon: Activity,
    viewId: 'reception_ops',
    actionType: 'open_add_run_row',
    defaultChecked: true,
  },
  {
    id: 'btn_pos_sales',
    labelAr: 'نقطة البيع السريعة POS',
    labelEn: 'Fast POS Terminal',
    icon: ShoppingCart,
    viewId: 'pos',
    defaultChecked: true,
  },
  {
    id: 'btn_cash_receipt',
    labelAr: '+ سند قبض نقدي',
    labelEn: '+ Cash Receipt',
    icon: ArrowDownLeft,
    viewId: 'cash_receipts',
    defaultChecked: true,
  },
  {
    id: 'btn_new_patient',
    labelAr: '+ مريض جديد 360',
    labelEn: '+ New Patient 360',
    icon: Users,
    viewId: 'parties',
    defaultChecked: false,
  },
  {
    id: 'btn_staff_schedule',
    labelAr: '+ موعد دوام موظف',
    labelEn: '+ Staff Shift Schedule',
    icon: Clock,
    viewId: 'bookings',
    actionType: 'open_staff_schedule',
    defaultChecked: false,
  },
  {
    id: 'btn_shift_report',
    labelAr: 'تقارير وشيتات الشيفت',
    labelEn: 'Shift Run Reports',
    icon: Printer,
    viewId: 'shift_reports',
    defaultChecked: false,
  },
];

const DEFAULT_LANDING_VIEWS = [
  { id: 'dashboard', labelAr: 'لوحة التحكم والتحليلات (Dashboard)', labelEn: 'Dashboard & Analytics' },
  { id: 'reception_ops', labelAr: 'شاشة التشغيل (الريسيبشن والنبضات)', labelEn: 'Reception Operations' },
  { id: 'bookings', labelAr: 'إدارة ومتابعة الحجوزات والدوام', labelEn: 'Bookings & Schedule' },
  { id: 'pos', labelAr: 'نقطة البيع السريعة (POS)', labelEn: 'Fast POS Terminal' },
  { id: 'parties', labelAr: 'دليل المرضى والعملاء 360', labelEn: 'Patients & Customers' },
  { id: 'cash_receipts', labelAr: 'سندات القبض النقدية', labelEn: 'Cash Receipt Vouchers' },
];

export const CustomizeQuickButtonsModal: React.FC<CustomizeQuickButtonsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const {
    language,
    t,
    currentUser,
    branches,
    activeBranch,
    setActiveBranch,
    canAccessBranch,
    canAccessView,
  } = usePlatform();

  const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('erp_quick_buttons');
      if (saved) return JSON.parse(saved);
    } catch {}
    return AVAILABLE_QUICK_BUTTONS.filter((b) => b.defaultChecked).map((b) => b.id);
  });

  const [landingView, setLandingView] = useState<string>(() => {
    return localStorage.getItem('erp_default_view') || currentUser?.defaultLandingView || 'dashboard';
  });

  const [preferredBranchId, setPreferredBranchId] = useState<string>(() => {
    return activeBranch?.id || '';
  });

  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (activeBranch) {
      setPreferredBranchId(activeBranch.id);
    }
  }, [activeBranch]);

  if (!isOpen) return null;

  const handleToggle = (btnId: string) => {
    setSelectedButtonIds((prev) =>
      prev.includes(btnId) ? prev.filter((id) => id !== btnId) : [...prev, btnId]
    );
  };

  const handleReset = () => {
    const defaults = AVAILABLE_QUICK_BUTTONS.filter((b) => b.defaultChecked).map((b) => b.id);
    setSelectedButtonIds(defaults);
    setLandingView('dashboard');
  };

  const handleSave = () => {
    try {
      localStorage.setItem('erp_quick_buttons', JSON.stringify(selectedButtonIds));
      localStorage.setItem('erp_default_view', landingView);
      if (preferredBranchId) {
        const branchObj = branches.find((b) => b.id === preferredBranchId);
        if (branchObj && canAccessBranch(branchObj.id)) {
          setActiveBranch(branchObj);
          localStorage.setItem('erp_preferred_branch', branchObj.id);
        }
      }
    } catch (e) {
      console.error(e);
    }

    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onSaved?.();
      onClose();
    }, 700);
  };

  const allowedBranches = branches.filter((b) => canAccessBranch(b.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t('تخصيص الأزرار السريعة والشاشات', 'Customize Quick Buttons & Screens')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(
                  'حدد الأزرار التي تفضل ظهورها في الشريط العلوي والشاشة الافتراضية لحسابك',
                  'Configure quick action buttons and your default landing screen'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Quick Buttons Toggle Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('أزرار الإجراءات السريعة (الشريط العلوي):', 'Top Bar Quick Action Buttons:')}
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{t('استعادة الافتراضي', 'Reset Defaults')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_QUICK_BUTTONS.map((btn) => {
                const Icon = btn.icon;
                const isChecked = selectedButtonIds.includes(btn.id);
                const isViewAccessible = canAccessView(btn.viewId);

                return (
                  <div
                    key={btn.id}
                    onClick={() => isViewAccessible && handleToggle(btn.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all select-none cursor-pointer ${
                      !isViewAccessible
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        : isChecked
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          isChecked
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? btn.labelAr : btn.labelEn}
                      </span>
                    </div>

                    <div
                      className={`h-5 w-5 rounded-md flex items-center justify-center border transition-colors ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Default Landing Screen Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('الشاشة الافتراضية عند تسجيل الدخول أو الفتح:', 'Default Landing Screen on Login:')}
            </label>
            <select
              value={landingView}
              onChange={(e) => setLandingView(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-600"
            >
              {DEFAULT_LANDING_VIEWS.map((v) => (
                <option key={v.id} value={v.id}>
                  {language === 'ar' ? v.labelAr : v.labelEn}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">
              {t(
                'ستفتح هذه الشاشة تلقائياً لك عند فتح النظام أو تسجيل الدخول بدلاً من اللوحة العامة',
                'This view will automatically open on system start or login'
              )}
            </p>
          </div>

          {/* Preferred Active Branch */}
          {allowedBranches.length > 1 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('الفرع المفضل المرتبط بالمستخدم:', 'Preferred Branch for User:')}
              </label>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                <select
                  value={preferredBranchId}
                  onChange={(e) => setPreferredBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-600"
                >
                  {allowedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {language === 'ar' ? b.name : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* User Role & Permissions Snapshot */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">{t('المستخدم الحالي: ', 'User: ')}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{currentUser?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                {currentUser?.isAdmin ? 'Admin' : currentUser?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-emerald-600 font-bold">
            {showSavedToast && (
              <span className="flex items-center gap-1.5 animate-pulse">
                <Check className="h-4 w-4" />
                {t('تم حفظ التخصيص بنجاح!', 'Saved Successfully!')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{t('حفظ التخصيص', 'Save Customization')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
