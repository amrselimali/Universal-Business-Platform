import React from 'react';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { GeneratedJournalEntry } from '../../types/accountingMapping';

interface Props {
  entries: GeneratedJournalEntry[];
  formatMoney: (amount: number) => string;
  t: (ar: string, en?: string) => string;
  isArabic: boolean;
}

export const GeneratedEntriesTable: React.FC<Props> = ({
  entries,
  formatMoney,
  t,
  isArabic,
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
          <FileText className="h-4 w-4 text-emerald-600" />
          {t('سجل القيود المحاسبية المولَّدة آلياً', 'Generated Journal Entries Log')}
          <span className="font-mono text-slate-400">({entries.length})</span>
        </h2>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('أثر تدقيقي موثق لكل قيد تم إنشاؤه عبر قواعد الربط', 'Full audit trail of generated entries')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('رقم القيد', 'Entry No')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('القاعدة', 'Rule')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('المستند المصدر', 'Source Document')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('حساب المدين', 'Debit Account')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('حساب الدائن', 'Credit Account')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('المبلغ', 'Amount')}
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-slate-600 dark:text-slate-300">
                {t('الحالة', 'Status')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('التوقيت', 'Timestamp')}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                  {t('لا توجد قيود مسجلة بعد. عند ترحيل أي معاملة ستظهر هنا فوراً.', 'No generated entries yet.')}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {entry.entryNumber || entry.journalEntryId || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {entry.ruleCode || 'AUTO'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div>{entry.sourceDocument || '—'}</div>
                    <div className="text-[10px] text-slate-400">{entry.sourceScreen || ''}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {entry.debitAccountCode || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {entry.creditAccountCode || '—'}
                  </td>
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                    {formatMoney(entry.amount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.isBalanced ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('متوازن', 'Balanced')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                        <AlertCircle className="h-3 w-3" />
                        {t('غير متوازن', 'Unbalanced')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-400">
                    {entry.postedAt ? new Date(entry.postedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
