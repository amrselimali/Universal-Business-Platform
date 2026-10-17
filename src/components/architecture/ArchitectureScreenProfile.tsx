/**
 * ملف موارد الشاشات — استهلاك الذاكرة وأثره على السرعة
 * ---------------------------------------------------------------------------
 * ثلاثة أنواع من الأرقام، وكل نوع مصدره معلن أمامه:
 *   1. **ساكن (من الكود)**: الأسطر · useState · useEffect · المكتبات الثقيلة —
 *      يُمسح آلياً بـ `scripts/screen-metrics.mjs` عند كل بناء/CI.
 *   2. **حزمة فعلية (من آخر بناء)**: gzip لكل شاشة من `dist/screen-budget.json`
 *      الذي يُولّده `scripts/emit-screen-budget.mjs` من Vite manifest.
 *   3. **حي (في متصفحك الآن)**: الذاكرة المستخدمة والمهام الطويلة ومدة تحميل حزمة
 *      الشاشة — تُقاس عبر performance APIs لحظة فتح الشاشة.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Gauge, MemoryStick, Timer } from 'lucide-react';
import { SCREEN_FILE_LIMIT, SCREEN_METRICS } from '../../data/architecture/screenMetrics';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}

interface BudgetScreen {
  file: string;
  rawKb: number;
  gzipKb: number;
}

interface ScreenBudget {
  generatedAt: string;
  entry: { file: string; gzipKb: number } | null;
  screens: Record<string, BudgetScreen>;
}

const HEAVY_LABELS: Record<string, string> = {
  xlsx: 'Excel',
  docx: 'Word',
  recharts: 'رسوم بيانية',
  motion: 'حركات',
  neon: 'اتصال DB',
  qrcode: 'QR',
};

const LiveMetric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">{value}</p>
    {hint && <p className="mt-0.5 text-[9px] leading-4 text-slate-400">{hint}</p>}
  </div>
);

export const ArchitectureScreenProfile: React.FC<Props> = ({ t, isArabic }) => {
  const [budget, setBudget] = useState<ScreenBudget | null>(null);
  const [budgetError, setBudgetError] = useState(false);
  const [live, setLive] = useState({ heap: 0, peak: 0, longTasks: 0, longTaskMs: 0, nodes: 0 });
  const [ownChunk, setOwnChunk] = useState<{ ms: number; kb: number } | null>(null);

  useEffect(() => {
    // baseURI يحترم نشر الصفحات تحت مسار فرعي (GitHub Pages)
    fetch(new URL('screen-budget.json', document.baseURI).toString())
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('missing'))))
      .then((data: ScreenBudget) => setBudget(data))
      .catch(() => setBudgetError(true));
  }, []);

  useEffect(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    let peak = 0;
    let longTasks = 0;
    let longTaskMs = 0;

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((item) => {
          longTasks += 1;
          longTaskMs += item.duration;
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      observer = null;
    }

    const tick = () => {
      const heap = memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1048576) : 0;
      peak = Math.max(peak, heap);
      setLive({
        heap,
        peak,
        longTasks,
        longTaskMs: Math.round(longTaskMs),
        nodes: document.querySelectorAll('*').length,
      });
    };

    tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!budget) return;
    const own = budget.screens.ArchitectureView;
    if (!own) return;
    const entry = performance
      .getEntriesByType('resource')
      .find((item) => item.name.includes(own.file)) as PerformanceResourceTiming | undefined;
    if (entry) setOwnChunk({ ms: Math.round(entry.duration), kb: Math.round((entry.transferSize || 0) / 1024) });
  }, [budget]);

  const rows = useMemo(
    () =>
      SCREEN_METRICS.map((metric) => ({
        ...metric,
        chunk: budget?.screens[metric.viewId],
      })).sort((a, b) => (b.chunk?.gzipKb ?? 0) - (a.chunk?.gzipKb ?? 0) || b.lines - a.lines),
    [budget]
  );

  const overLimit = SCREEN_METRICS.filter((metric) => metric.overLimit).length;
  const heavyScreens = SCREEN_METRICS.filter((metric) => metric.heavyLibs.length > 0).length;
  const totalScreenKb = rows.reduce((sum, row) => sum + (row.chunk?.gzipKb ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <LiveMetric label={t('حزمة الإقلاع (آخر بناء)', 'Entry bundle (last build)')} value={budget?.entry ? `${budget.entry.gzipKb} KB` : '—'} hint={t('تُحمَّل قبل أي شاشة', 'Loaded before any screen')} />
        <LiveMetric label={t('مجموع حزم الشاشات', 'Sum of screen chunks')} value={`${Math.round(totalScreenKb)} KB`} hint={t('gzip لـ 41 شاشة (تُحمَّل عند الطلب)', 'gzip across 41 lazy screens')} />
        <LiveMetric label={t('شاشات فوق 300 سطر', 'Screens over 300 lines')} value={`${overLimit} / ${SCREEN_METRICS.length}`} hint={t('خط الأساس القديم (Ratchet)', 'Legacy ratchet baseline')} />
        <LiveMetric label={t('شاشات تستورد مكتبات ثقيلة', 'Screens importing heavy libs')} value={String(heavyScreens)} hint={t('Excel/Word/رسوم/حركات', 'Excel/Word/charts/motion')} />
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-[10px] leading-5 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-200">
        <p className="font-extrabold">{t('حي الآن في متصفحك (هذا التبويب)', 'Live in your browser (this tab)')}</p>
        <div className="mt-1 flex flex-wrap gap-3 font-mono" dir="ltr">
          <span className="inline-flex items-center gap-1"><MemoryStick className="h-3 w-3" /> heap: {live.heap ? `${live.heap} MB` : 'n/a'}</span>
          <span>peak: {live.peak ? `${live.peak} MB` : 'n/a'}</span>
          <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> long tasks: {live.longTasks} ({live.longTaskMs} ms)</span>
          <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" /> DOM: {live.nodes}</span>
          {ownChunk && <span>this chunk: {ownChunk.ms} ms / {ownChunk.kb} KB</span>}
        </div>
        <p className="mt-1 text-[9px]">
          {t(
            'الذاكرة تُعرض في Chrome فقط (performance.memory). المهام الطويلة = كل مهمة > 50ms وتسبب هنج الإحساس. افتح أي شاشة ثم ارجع هنا لترى أثرها على الذاكرة.',
            'Memory is Chrome-only (performance.memory). Long tasks = any task > 50 ms, the usual cause of perceived jank. Open any screen then come back to see its memory impact.'
          )}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
            <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            {t('كل شاشة: الأسطر والخطافات والحزمة', 'Every screen: lines, hooks, bundle')}
          </p>
          <span className="text-[9px] text-slate-400">
            {budget ? t(`حزمة من بناء ${new Date(budget.generatedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-GB')}`, `bundle from build ${new Date(budget.generatedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-GB')}`) : budgetError ? t('ملف الحزم غير متاح (شغّل npm run build)', 'bundle file unavailable (run npm run build)') : t('جارٍ تحميل أحجام الحزم…', 'loading bundle sizes…')}
          </span>
        </div>

        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-right text-[10px]">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-2 py-1.5">{t('الشاشة', 'Screen')}</th>
                <th className="px-2 py-1.5">{t('أسطر', 'Lines')}</th>
                <th className="px-2 py-1.5">{t('حالة/تأثير', 'useState / useEffect')}</th>
                <th className="px-2 py-1.5">{t('مكتبات ثقيلة', 'Heavy libs')}</th>
                <th className="px-2 py-1.5">{t('حزمة gzip', 'Chunk gzip')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => {
                const big = (row.chunk?.gzipKb ?? 0) >= 50;
                return (
                  <tr key={row.viewId} className="text-slate-700 dark:text-slate-200">
                    <td className="px-2 py-1 font-mono">{row.viewId}</td>
                    <td className="px-2 py-1">
                      <span className={row.overLimit ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {row.lines}
                      </span>
                      <span className="ms-1 text-[8px] text-slate-400">/ {SCREEN_FILE_LIMIT}</span>
                      {row.overLimit ? <AlertTriangle className="ms-1 inline h-3 w-3 text-rose-500" /> : <CheckCircle2 className="ms-1 inline h-3 w-3 text-emerald-500" />}
                    </td>
                    <td className="px-2 py-1 font-mono text-[9px]">{row.useState} / {row.useEffect}</td>
                    <td className="px-2 py-1 text-[9px]">
                      {row.heavyLibs.length === 0 ? <span className="text-slate-400">—</span> : row.heavyLibs.map((lib) => (
                        <span key={lib} className="me-1 rounded bg-amber-50 px-1 text-[8px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          {HEAVY_LABELS[lib] ?? lib}
                        </span>
                      ))}
                    </td>
                    <td className={`px-2 py-1 font-mono ${big ? 'font-bold text-amber-600 dark:text-amber-400' : ''}`}>
                      {row.chunk ? `${row.chunk.gzipKb} KB` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
        {t(
          'الأسطر والخطافات تُمسح آلياً من الكود (scripts/screen-metrics.mjs) والـ CI يفشل إذا قدمت. أحجام الحزم تُقاس من آخر بناء فعلي (Vite manifest + gzip). الذاكرة والمهام الطويلة تُقاس حياً في Chrome. الشاشات القديمة فوق 300 سطر مسجّلة في خط أساس مُقاس (Ratchet) ولا يُسمح بنموها.',
          'Lines and hooks are scanned automatically from the code (scripts/screen-metrics.mjs) and CI fails if stale. Bundle sizes come from the last real build (Vite manifest + gzip). Memory and long tasks are measured live in Chrome. Legacy screens over 300 lines are recorded in a measured ratchet baseline and may not grow.'
        )}
      </p>
    </div>
  );
};
