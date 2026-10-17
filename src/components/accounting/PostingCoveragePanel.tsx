/**
 * لوحة التغطية: هل كل خلية إلزامية لها قاعدة؟
 * ---------------------------------------------------------------------------
 * التغطية ليست "تقريراً" فقط: أي فجوة هنا تعني أن الترحيل لتلك العملية سيُرفض
 * داخل الداتابيز. الشاشة تكشف الفجوة قبل أن يكتشفها المحاسب وقت الإقفال.
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Gauge } from 'lucide-react';
import type { CoverageGapRow } from '../../data/accountingOperations';
import type { PostingDocument } from '../../types/postingRules';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  coverage: { total: number; covered: number; gaps: CoverageGapRow[] };
  documents: PostingDocument[];
}

export const PostingCoveragePanel: React.FC<Props> = ({ t, isArabic, coverage, documents }) => {
  const percent = coverage.total === 0 ? 100 : Math.round((coverage.covered / coverage.total) * 100);
  const counts = documents.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.status] = (acc[doc.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
              {t('تغطية قواعد الترحيل', 'Posting rules coverage')}
            </p>
          </div>
          <span className={`text-[11px] font-black ${percent === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {coverage.covered} / {coverage.total} ({percent}%)
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
          {t(
            'المقصود بالخلية: حقل مبلغ إلزامي داخل عملية. أي فجوة = ذلك النوع من المستندات لن يُرحَّل حتى تربطه.',
            'A cell is a required amount field inside an operation. Any gap means those documents cannot post until you bind it.'
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p className="border-b border-slate-100 px-3 py-2 text-[12px] font-extrabold text-slate-800 dark:border-slate-800 dark:text-slate-100">
          {t('الفجوات', 'Gaps')} ({coverage.gaps.length})
        </p>
        {coverage.gaps.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {t('كل الخلايا الإلزامية مربوطة بقاعدة.', 'Every required cell is bound to a rule.')}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {coverage.gaps.map((gap) => (
              <div key={`${gap.type}|${gap.field}`} className="flex items-start gap-2 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{gap.labelAr} ← {gap.fieldLabelAr}</p>
                  <p className="font-mono text-[9px] text-slate-400">{gap.type}.{gap.field}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(['posted', 'failed', 'pending'] as const).map((status) => (
          <div key={status} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {status === 'posted' ? t('مُرحَّلة', 'Posted') : status === 'failed' ? t('فاشلة', 'Failed') : t('معلّقة', 'Pending')}
            </p>
            <p className="mt-1 text-lg font-black text-slate-800 dark:text-slate-100">{counts[status] ?? 0}</p>
            <p className="text-[9px] text-slate-400">
              {isArabic ? 'من إجمالي ' : 'of '}{documents.length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
