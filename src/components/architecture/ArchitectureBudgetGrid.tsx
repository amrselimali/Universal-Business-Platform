import React from 'react';
import { Gauge, ShieldCheck, Layers, FileCode2 } from 'lucide-react';
import { ARCHITECTURE_BUDGET } from '../../data/architecture/architectureSpec';
import { GUARDRAIL_SCOPE_AR, GUARDRAIL_SCOPE_EN } from '../../data/architecture/architectureGuardrailsContent';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
}

const accentClasses: Record<string, string> = {
  sky: 'border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/20',
  emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
  amber: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20',
  violet: 'border-violet-200 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20',
};

/** ميزانية الالتزام المعماري: الأرقام التي يُقاس عليها النظام + نطاق الفحص. */
export const ArchitectureBudgetGrid: React.FC<Props> = ({ t, isArabic }) => {
  const accents = ['sky', 'emerald', 'amber', 'violet', 'sky', 'emerald'];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ARCHITECTURE_BUDGET.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-2xl border p-4 ${accentClasses[accents[index % accents.length]]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isArabic ? item.labelAr : item.labelEn}
              </span>
              <Gauge className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {item.value}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
              {isArabic ? item.noteAr : item.noteEn}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            {t('نطاق الفحص الفعلي لهذه الشاشة', 'The actual audit scope of this screen')}
          </h3>
        </div>
        <ul className="mt-3 space-y-1.5">
          {(isArabic ? GUARDRAIL_SCOPE_AR : GUARDRAIL_SCOPE_EN).map((line) => (
            <li key={line} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="font-mono leading-5" dir="ltr">
                {line}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            {t(
              'لا تتحقق هذه الشاشة من زمن الاستجابة الفعلي (يُقاس بـ k6/Lighthouse على بيئة حقيقية)، بل تتحقق من وجود الثوابت المعمارية التي تمنع البطء: نقطة نهاية موحّدة، Keyset Pagination، بث لحظي بدل السحب الدوري، وخدمة دائمة التشغيل.',
              'This screen does not measure real latency (that needs k6/Lighthouse on a live environment). It verifies the architectural invariants that prevent slowness: one consolidated endpoint, keyset pagination, push-based realtime instead of polling, and an always-on runtime.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
