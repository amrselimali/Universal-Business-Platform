import React from 'react';
import { CircleX, CircleCheckBig, Boxes, Server } from 'lucide-react';
import { PREVIOUS_FLAWS, ARCHITECTURE_SERVICES } from '../../data/architecture/architectureDecisions';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}

/** عيوب المنصة السابقة مقابل الحلول المعمارية + مسؤوليات الخدمات. */
export const ArchitectureDecisions: React.FC<Props> = ({ t, isArabic }) => (
  <div className="space-y-4">
    <div className="space-y-3">
      {PREVIOUS_FLAWS.map((row) => (
        <div
          key={row.id}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
            <div className="flex items-center gap-2">
              <CircleX className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                {t('عيب المنصة السابقة', 'Previous platform flaw')}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-700 dark:text-slate-200">
              {isArabic ? row.flawAr : row.flawEn}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2">
              <CircleCheckBig className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {t('الحل المعماري المعتمد', 'Adopted architectural fix')}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-700 dark:text-slate-200">
              {isArabic ? row.solutionAr : row.solutionEn}
            </p>
            <p className="mt-2 border-t border-emerald-200/70 pt-2 text-[10px] leading-4 text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-300">
              {t('الدليل: ', 'Evidence: ')}
              {isArabic ? row.proofAr : row.proofEn}
            </p>
          </div>
        </div>
      ))}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          {t('الخدمات: كل خدمة تملك مجالاً واحداً فقط', 'Services: one domain per service')}
        </h3>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ARCHITECTURE_SERVICES.map((service) => (
          <div
            key={service.id}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
          >
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                {isArabic ? service.nameAr : service.nameEn}
              </p>
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              {isArabic ? service.dutyAr : service.dutyEn}
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
