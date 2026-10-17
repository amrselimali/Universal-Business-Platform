/**
 * قواعد الترحيل — عرض مرجعي للقراءة فقط
 * ---------------------------------------------------------------------------
 * بعد تحويل الشاشة إلى مراقبة، تُعرض القواعد هنا كما هي في قاعدة البيانات دون
 * أي إمكانية تعديل: لتفهم **لماذا** ذهب القيد إلى هذا الحساب.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import {
  ACCOUNTING_OPERATIONS,
  PAYMENT_METHOD_TYPE_LABELS,
  type CoverageGapRow,
  type PaymentMethodRef,
} from '../../data/accountingOperations';
import type { PostingRule } from '../../types/postingRules';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  rules: PostingRule[];
  gaps: CoverageGapRow[];
  coverage: { total: number; covered: number };
  paymentMethods: PaymentMethodRef[];
}

const selectorLabel = (key: string, methods: PaymentMethodRef[], isArabic: boolean): string => {
  if (key === 'default') return isArabic ? 'افتراضي' : 'Default';
  if (key === 'cash') return isArabic ? 'أي نقدي' : 'Any cash';
  if (key === 'bank') return isArabic ? 'أي بنك' : 'Any bank';
  if (key.startsWith('pmt:')) {
    const type = key.slice(4);
    const label = PAYMENT_METHOD_TYPE_LABELS[type];
    return `${isArabic ? 'نوع' : 'type'}: ${label ? (isArabic ? label.ar : label.en) : type}`;
  }
  if (key.startsWith('pm:')) {
    const method = methods.find((item) => `pm:${item.id}` === key);
    return method ? `${method.nameAr}${isArabic ? ' (هذه الطريقة)' : ' (this method)'}` : key;
  }
  return key;
};

export const PostingRulesReadOnly: React.FC<Props> = ({
  t, isArabic, rules, gaps, coverage, paymentMethods,
}) => {
  const byType = useMemo(() => {
    const map = new Map<string, PostingRule[]>();
    rules.forEach((rule) => map.set(rule.transactionType, [...(map.get(rule.transactionType) ?? []), rule]));
    return map;
  }, [rules]);

  const gapsByType = useMemo(() => {
    const map = new Map<string, CoverageGapRow[]>();
    gaps.forEach((gap) => map.set(gap.type, [...(map.get(gap.type) ?? []), gap]));
    return map;
  }, [gaps]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {t(
            'مرجع للقراءة فقط: القواعد التي وُجّهت بها القيود. للتعديل افتح «أدوات الإدارة».',
            'Read-only reference: the rules that routed the entries. Use “Admin tools” to edit.'
          )}
        </p>
        <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Lock className="h-3 w-3" /> {coverage.covered}/{coverage.total} {t('خلية مربوطة', 'cells bound')}
        </span>
      </div>

      {ACCOUNTING_OPERATIONS.map((op) => {
        const list = byType.get(op.type) ?? [];
        const opGaps = gapsByType.get(op.type) ?? [];
        if (list.length === 0 && opGaps.length === 0) return null;

        return (
          <div key={op.type} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="border-b border-slate-100 pb-1.5 text-[12px] font-extrabold text-slate-800 dark:border-slate-800 dark:text-slate-100">
              {isArabic ? op.labelAr : op.labelEn}
              <span className="ms-1 font-mono text-[9px] font-normal text-slate-400">{op.type}</span>
            </p>

            <div className="mt-2 space-y-1">
              {list.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] dark:bg-slate-800/40">
                  <span className="font-mono text-slate-700 dark:text-slate-200">{rule.fieldKey}</span>
                  <span className="rounded bg-slate-200 px-1 text-[9px] text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {selectorLabel(rule.selectorKey, paymentMethods, isArabic)}
                  </span>
                  <span className={`rounded px-1 text-[9px] font-bold ${rule.direction === 'debit' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'}`}>
                    {rule.direction === 'debit' ? t('مدين', 'Debit') : t('دائن', 'Credit')}
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {rule.accountCode} — {rule.accountName}
                  </span>
                  <span className={`rounded px-1 text-[9px] ${rule.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 line-through'}`}>
                    {rule.isActive ? t('فعّالة', 'active') : t('موقوفة', 'inactive')}
                  </span>
                </div>
              ))}

              {opGaps.map((gap) => (
                <div key={`${gap.type}-${gap.field}`} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="font-mono">{gap.field}</span>
                  <span>— {t('بلا قاعدة (يمنع الترحيل)', 'no rule (posting blocked)')}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
