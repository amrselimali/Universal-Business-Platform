import React, { useState, useEffect, useRef } from 'react';
import {
  ExternalLink,
  Sparkles,
  Users,
  LayoutDashboard,
  Building2,
  Copy,
  Check,
  RotateCw,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';

interface GlobalContextMenuProps {
  currentView: string;
}

interface MenuPosition {
  x: number;
  y: number;
}

export const GlobalContextMenu: React.FC<GlobalContextMenuProps> = ({ currentView }) => {
  const { language, t, canAccessView } = usePlatform();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Map view IDs to localized labels
  const viewNames: Record<string, { ar: string; en: string }> = {
    dashboard: { ar: 'لوحة التحكم والتحليلات', en: 'Dashboard & Analytics' },
    bookings: { ar: 'جدول الحجوزات والمتابعات', en: 'Bookings & Follow-ups' },
    reception_ops: { ar: 'شاشة الاستقبال والتشغيل', en: 'Reception & Operations' },
    pos: { ar: 'نقطة البيع السريعة POS', en: 'Fast POS' },
    parties: { ar: 'سجل العملاء والمرضى', en: 'Customers & Patients' },
    invoices: { ar: 'الفواتير وعروض الأسعار', en: 'Invoices & Quotations' },
    accounting: { ar: 'الحسابات وقيود اليومية', en: 'Accounting & Journals' },
    inventory: { ar: 'المخازن والمستودعات', en: 'Inventory & Warehouses' },
    staff: { ar: 'شؤون الموظفين والأطباء', en: 'Staff & Doctors' },
    shift_reports: { ar: 'تقارير الورديات والإقفال', en: 'Shift Reports' },
  };

  const currentViewLabel = viewNames[currentView]
    ? language === 'ar'
      ? viewNames[currentView].ar
      : viewNames[currentView].en
    : currentView;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Let the browser handle right-clicks on the Booking Management screen.
      if (currentView === 'bookings' || e.shiftKey) return;

      // Avoid blocking standard text input select/cut/copy if user right-clicks on an <input> or <textarea> with selected text
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        (target as HTMLInputElement).selectionStart !== (target as HTMLInputElement).selectionEnd
      ) {
        return;
      }

      e.preventDefault();

      const menuWidth = 280;
      const menuHeight = 360;
      const posX = e.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : e.clientX;
      const posY = e.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : e.clientY;

      setPosition({
        x: Math.max(10, posX),
        y: Math.max(10, posY),
      });
      setIsOpen(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentView]);

  const openInNewTab = (viewId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?view=${viewId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
    showToast(
      language === 'ar'
        ? 'تم فتح الشاشة بنجاح في تبويب جديد دون إغلاق الصفحة السابقة!'
        : 'Screen opened in a new tab without affecting current page!'
    );
  };

  const copyCurrentUrl = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?view=${currentView}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast(
        language === 'ar'
          ? 'تم نسخ الرابط المباشر للشاشة بنجاح!'
          : 'Direct screen URL copied to clipboard!'
      );
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 600);
    } catch {
      showToast(language === 'ar' ? 'تعذر نسخ الرابط' : 'Failed to copy URL');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-5 start-5 z-[99999] flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-bold shadow-2xl backdrop-blur-md border border-slate-700 dark:border-slate-300 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <ExternalLink className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Floating Custom Context Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${position.y}px`,
            left: `${position.x}px`,
            zIndex: 99990,
          }}
          className="w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 p-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {/* Header indicator */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-indigo-500" />
              {t('خيارات الشاشة والتصفح', 'Screen Navigation')}
            </span>
            <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
              Tab Sync
            </span>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Keep the custom new-tab action for other views only. */}
            {currentView !== 'bookings' && <button
              type="button"
              onClick={() => openInNewTab(currentView)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left rtl:text-right font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-md shadow-indigo-500/20 cursor-pointer transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0 text-white" />
                <div className="truncate">
                  <div className="text-[11px] leading-tight">
                    {t('فتح هذه الشاشة في تبويب جديد', 'Open in New Tab')}
                  </div>
                  <div className="text-[9px] text-indigo-100 font-normal truncate opacity-90">
                    {currentViewLabel}
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">
                New Tab
              </span>
            </button>}

            {/* Quick Open Core Screens */}
            <div className="pt-1.5 pb-0.5 px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {t('فتح شاشات رئيسية أخرى في تبويب جديد:', 'Open other views in new tab:')}
            </div>

            {currentView !== 'pos' && canAccessView('pos') && (
              <button
                type="button"
                onClick={() => openInNewTab('pos')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{t('نقطة البيع السريعة POS', 'Fast POS')}</span>
              </button>
            )}

            {currentView !== 'reception_ops' && canAccessView('reception_ops') && (
              <button
                type="button"
                onClick={() => openInNewTab('reception_ops')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{t('شاشة الاستقبال والتشغيل', 'Reception & Operations')}</span>
              </button>
            )}

            {currentView !== 'parties' && canAccessView('parties') && (
              <button
                type="button"
                onClick={() => openInNewTab('parties')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">{t('سجل العملاء والمرضى', 'Customers & Patients')}</span>
              </button>
            )}

            {currentView !== 'dashboard' && canAccessView('dashboard') && (
              <button
                type="button"
                onClick={() => openInNewTab('dashboard')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <span className="truncate">{t('لوحة التحكم الرئيسية', 'Dashboard')}</span>
              </button>
            )}

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            {/* Copy direct URL */}
            <button
              type="button"
              onClick={copyCurrentUrl}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate">
                {copied
                  ? t('تم نسخ الرابط!', 'Copied!')
                  : t('نسخ الرابط المباشر للشاشة', 'Copy Screen Direct Link')}
              </span>
            </button>

            {/* Refresh Screen */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                window.location.reload();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{t('تحديث الصفحة', 'Reload Page')}</span>
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
            >
              {document.fullscreenElement ? (
                <Minimize2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate">
                {document.fullscreenElement
                  ? t('إنهاء ملء الشاشة', 'Exit Fullscreen')
                  : t('ملء الشاشة', 'Fullscreen Mode')}
              </span>
            </button>
          </div>

          <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 text-center">
            {t('كليك يمين لفتح أي شاشة في تبويب مستقل دون إغلاق الشاشة السابقة', 'Right-click anytime to open in new tab')}
          </div>
        </div>
      )}
    </>
  );
};
