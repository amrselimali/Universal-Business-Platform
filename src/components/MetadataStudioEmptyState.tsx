import React from 'react';
import { Database, Loader2, RefreshCw } from 'lucide-react';

interface MetadataStudioEmptyStateProps {
  loading: boolean;
  busy: boolean;
  onReload: () => void;
  t: (ar: string, en: string) => string;
}

export const MetadataStudioEmptyState: React.FC<MetadataStudioEmptyStateProps> = ({
  loading,
  busy,
  onReload,
  t,
}) => {
  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/20 p-8 text-center dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
          {t('جاري تحميل محرك الشاشات والكيانات من Neon...', 'Loading metadata engine from Neon...')}
        </h2>
        <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          {t(
            'يتم جلب الحقول والكيانات والصلاحيات المسجلة...',
            'Fetching entities, fields, and permissions registry...'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
      <Database className="h-10 w-10 text-slate-400" />
      <div>
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
          {t('محرك الشاشات غير مهيأ بعد', 'The metadata engine is not set up yet')}
        </h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t(
            'شغّل ملفَي neon_metadata_engine.sql و neon_metadata_seed.sql ثم أعد التحميل.',
            'Run neon_metadata_engine.sql and neon_metadata_seed.sql, then reload.'
          )}
        </p>
      </div>
      <code className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        scripts/neon_metadata_engine.sql → scripts/neon_metadata_seed.sql
      </code>
      <button
        type="button"
        onClick={onReload}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        {t('إعادة التحميل من Neon الآن', 'Reload from Neon now')}
      </button>
    </div>
  );
};
