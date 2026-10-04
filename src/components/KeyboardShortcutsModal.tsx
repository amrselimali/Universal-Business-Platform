import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  Keyboard,
  X,
  Sparkles,
  Command,
  Zap,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language, t } = usePlatform();

  if (!isOpen) return null;

  const shortcuts = [
    {
      key: 'Ctrl + K',
      labelAr: 'فتح شريط الأوامر والبحث السريع الفوري',
      labelEn: 'Open Command Palette & Fast Search',
      tag: 'شامل',
    },
    {
      key: 'F2',
      labelAr: 'الانتقال المباشر لنقطة البيع السريعة (POS)',
      labelEn: 'Jump to Fast POS Terminal',
      tag: 'كاشير',
    },
    {
      key: 'F3',
      labelAr: 'فتح شاشة التشغيل وحركات الشيفت اليومية',
      labelEn: 'Open Daily Reception Operations',
      tag: 'تشغيل',
    },
    {
      key: 'F4',
      labelAr: 'فتح إدارة الحجوزات ومواعيد دوام الموظفين',
      labelEn: 'Open Bookings & Staff Schedule',
      tag: 'حجوزات',
    },
    {
      key: 'F6',
      labelAr: 'فتح دليل المرضى والعملاء 360',
      labelEn: 'Open Patients & Customers 360',
      tag: 'مرضى',
    },
    {
      key: 'F7',
      labelAr: 'فتح سندات القبض النقدية والتحصيل',
      labelEn: 'Open Cash Receipt Vouchers',
      tag: 'خزينة',
    },
    {
      key: 'F8',
      labelAr: 'فتح إدارة الأطباء ومقدمي الخدمة والموظفين',
      labelEn: 'Open Staff & Service Providers Directory',
      tag: 'كوادر',
    },
    {
      key: 'F1',
      labelAr: 'فتح دليل المستخدم والمانيوال التقني',
      labelEn: 'Open User Manual & Documentation',
      tag: 'توثيق',
    },
    {
      key: 'Esc',
      labelAr: 'إغلاق أي نافذة أو شاشة منبثقة فوراً',
      labelEn: 'Close any active modal or popup',
      tag: 'تنقل',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t('اختصارات لوحة المفاتيح الفائقة', 'Keyboard Shortcuts Guide')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('لتسريع تنفيذ العمليات والتنقل الفوري بين الشاشات', 'Fast navigation & instant execution')}
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
        <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-80 overflow-y-auto">
          {shortcuts.map((sc, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {language === 'ar' ? sc.labelAr : sc.labelEn}
                </p>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  {sc.tag}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg font-mono font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
                {sc.key}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            {t('جاهز للاستخدام الفوري بجميع الشاشات', 'Active across all screens')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
          >
            {t('تم', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};
