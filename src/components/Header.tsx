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
} from 'lucide-react';

interface HeaderProps {
  onNavigate: (view: string) => void;
  currentView: string;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentView }) => {
  const {
    tenant,
    branches,
    activeBranch,
    setActiveBranch,
    warehouses,
    activeWarehouse,
    setActiveWarehouse,
    language,
    setLanguage,
    t,
    neonDb,
    activeShift,
  } = usePlatform();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:px-6">
      {/* Left / Start: Brand & Company Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-slate-900 dark:text-white">
                {language === 'ar' ? tenant.name : tenant.nameEn}
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {tenant.plan}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('منصة إدارة الأعمال الشاملة (Universal ERP)', 'Universal Business Platform')}
            </p>
          </div>
        </div>

        {/* Branch Switcher */}
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-750 dark:bg-slate-800 md:flex">
          <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <select
            value={activeBranch.id}
            onChange={(e) => {
              const selected = branches.find((b) => b.id === e.target.value);
              if (selected) setActiveBranch(selected);
            }}
            className="bg-transparent text-xs font-semibold text-slate-800 outline-none dark:text-slate-200 cursor-pointer"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="dark:bg-slate-900">
                {language === 'ar' ? b.name : b.nameEn}
              </option>
            ))}
          </select>
        </div>

        {/* Warehouse Indicator */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300 xl:flex">
          <WarehouseIcon className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={activeWarehouse.id}
            onChange={(e) => {
              const w = warehouses.find((item) => item.id === e.target.value);
              if (w) setActiveWarehouse(w);
            }}
            className="bg-transparent text-xs text-slate-700 outline-none dark:text-slate-300 cursor-pointer"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id} className="dark:bg-slate-900">
                {language === 'ar' ? w.name : w.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right / End Controls */}
      <div className="flex items-center gap-2">
        {/* Active POS Shift Badge */}
        {activeShift.status === 'Open' && (
          <button
            onClick={() => onNavigate('pos')}
            className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 sm:flex hover:bg-emerald-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('شيفت كاشير نشط', 'POS Shift Active')}
          </button>
        )}

        {/* Neon Database Status Indicator */}
        <button
          onClick={() => onNavigate('neon')}
          title={t('حالة الاتصال بقاعدة بيانات Neon PostgreSQL', 'Neon PostgreSQL Connection Status')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
            neonDb.connected
              ? 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300'
              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Neon PostgreSQL:</span>
          <span className="font-bold">
            {neonDb.connected ? t('متصل', 'Connected') : t('محلي / جاهز للربط', 'Local / Ready')}
          </span>
          {neonDb.connected ? (
            <CheckCircle2 className="h-3 w-3 text-cyan-600" />
          ) : (
            <AlertCircle className="h-3 w-3 text-amber-600" />
          )}
        </button>

        {/* Fast POS Button */}
        <button
          onClick={() => onNavigate('pos')}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t('نقطة البيع POS', 'Fast POS')}</span>
        </button>

        {/* Language Toggle */}
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          title={t('تغيير اللغة (عربي / English)', 'Switch Language')}
        >
          <Globe className="h-3.5 w-3.5 text-slate-500" />
          <span>{language === 'ar' ? 'English' : 'عربي'}</span>
        </button>
      </div>
    </header>
  );
};
