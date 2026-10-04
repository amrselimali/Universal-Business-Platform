import React, { useState, useEffect } from 'react';
import { usePlatform } from '../context/PlatformContext';
import {
  SlidersHorizontal,
  Search,
  Keyboard,
  Building2,
  Calendar,
  Activity,
  ShoppingCart,
  ArrowDownLeft,
  Users,
  Clock,
  Printer,
  Sparkles,
} from 'lucide-react';
import { AVAILABLE_QUICK_BUTTONS } from './CustomizeQuickButtonsModal';

interface QuickActionsBarProps {
  onNavigate: (viewId: string) => void;
  onOpenCommandPalette: () => void;
  onOpenCustomize: () => void;
  onOpenShortcuts: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  onNavigate,
  onOpenCommandPalette,
  onOpenCustomize,
  onOpenShortcuts,
}) => {
  const { language, t, activeBranch, canAccessView, canPerformAction } = usePlatform();

  const [activeButtonIds, setActiveButtonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('erp_quick_buttons');
      if (saved) return JSON.parse(saved);
    } catch {}
    return AVAILABLE_QUICK_BUTTONS.filter((b) => b.defaultChecked).map((b) => b.id);
  });

  // Listen for storage changes in case customization modal updates it
  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        const saved = localStorage.getItem('erp_quick_buttons');
        if (saved) setActiveButtonIds(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // Filter buttons: must be enabled in settings AND user must have permission to access the view
  const visibleButtons = AVAILABLE_QUICK_BUTTONS.filter(
    (btn) => activeButtonIds.includes(btn.id) && canAccessView(btn.viewId)
  );

  return (
    <div className="w-full bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Left / Start: Fast Search & Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Fast Command Search Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 shadow-2xs transition-all cursor-pointer group"
          title={t('البحث السريع والتنقل بين الشاشات (Ctrl+K)', 'Fast Search & Jump (Ctrl+K)')}
        >
          <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600" />
          <span className="font-semibold">{t('بحث سريع...', 'Quick Search...')}</span>
          <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-500">
            Ctrl+K
          </span>
        </button>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

        {/* User's Customized Quick Action Buttons */}
        {visibleButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => onNavigate(btn.viewId)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 shadow-2xs"
            >
              <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{language === 'ar' ? btn.labelAr : btn.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Right / End: Active Branch & Customization & Shortcuts triggers */}
      <div className="flex items-center gap-1.5">
        {/* Active Branch Indicator */}
        {activeBranch && (
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
            <Building2 className="h-3 w-3" />
            <span>{language === 'ar' ? activeBranch.name : activeBranch.nameEn}</span>
          </div>
        )}

        {/* Keyboard Shortcuts Guide Button */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[11px] font-semibold"
          title={t('عرض اختصارات لوحة المفاتيح', 'Keyboard Shortcuts Guide')}
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{t('اختصارات', 'Shortcuts')}</span>
        </button>

        {/* Customize Quick Buttons Button */}
        <button
          type="button"
          onClick={onOpenCustomize}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800/80 transition-colors cursor-pointer text-[11px] font-bold"
          title={t('تخصيص الأزرار والشاشات المفضلة', 'Customize Quick Buttons')}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('تخصيص الأزرار', 'Customize')}</span>
        </button>
      </div>
    </div>
  );
};
