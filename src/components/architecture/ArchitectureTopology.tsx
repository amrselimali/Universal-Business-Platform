import React from 'react';
import { ArrowLeftRight, Radio, Database, Server, MonitorSmartphone, Network } from 'lucide-react';
import { ARCHITECTURE_LAYERS, REALTIME_LOOP } from '../../data/architecture/architectureSpec';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}

const layerAccent: Record<string, { chip: string; icon: React.ReactNode }> = {
  sky: { chip: 'bg-sky-600', icon: <MonitorSmartphone className="h-4 w-4" /> },
  indigo: { chip: 'bg-indigo-600', icon: <Network className="h-4 w-4" /> },
  violet: { chip: 'bg-violet-600', icon: <Server className="h-4 w-4" /> },
  emerald: { chip: 'bg-emerald-600', icon: <Database className="h-4 w-4" /> },
};

/** مخطط تدفق البيانات الحي: الطبقات الأربع + حلقة المزامنة اللحظية. */
export const ArchitectureTopology: React.FC<Props> = ({ t, isArabic }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-white dark:bg-slate-100 dark:text-slate-900">
        HTTPS / WSS · TLS 1.3
      </span>
      <span>
        {t(
          'كل الاتجاهات تمر عبر بوابة واحدة — والمتصفح لا يتصل بقاعدة البيانات إطلاقاً',
          'Every direction passes one gateway — and the browser never touches the database'
        )}
      </span>
    </div>

    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
      {ARCHITECTURE_LAYERS.map((layer) => {
        const accent = layerAccent[layer.accent] ?? layerAccent.sky;
        return (
          <div
            key={layer.id}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${accent.chip}`}>
                {accent.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] font-black tracking-wide text-slate-500 dark:text-slate-400">
                  {layer.title}
                </p>
                <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                  {isArabic ? layer.subtitleAr : layer.subtitleEn}
                </p>
              </div>
            </div>

            <ul className="mt-3 flex-1 space-y-1.5">
              {(isArabic ? layer.itemsAr : layer.itemsEn).map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p className="mt-3 rounded-xl bg-slate-50 px-2.5 py-2 text-[10px] leading-4 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              {isArabic ? layer.evidenceAr : layer.evidenceEn}
            </p>
          </div>
        );
      })}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          {t('حلقة المزامنة اللحظية (The Realtime Loop)', 'The Realtime Loop')}
        </h3>
      </div>

      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {REALTIME_LOOP.map((step, index) => (
          <React.Fragment key={step.index}>
            <div className="min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <p className="text-[10px] font-black text-slate-400">#{step.index}</p>
              <p className="mt-0.5 text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                {isArabic ? step.titleAr : step.titleEn}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                {isArabic ? step.detailAr : step.detailEn}
              </p>
            </div>
            {index < REALTIME_LOOP.length - 1 && (
              <div className="hidden items-center text-slate-300 sm:flex dark:text-slate-600">
                <ArrowLeftRight className="h-4 w-4 rotate-90" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  </div>
);
