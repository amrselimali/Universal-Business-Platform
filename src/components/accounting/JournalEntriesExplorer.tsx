/**
 * مستكشف القيود المحاسبية — عرض فقط
 * ---------------------------------------------------------------------------
 * يعرض **كل قيد أُنشئ فعلاً** (حتى 500 قيد) مع سطوره ومصدره وقواعد الترحيل التي
 * أنتجته. لا يحتوي أي زر تعديل أو ترحيل: الشاشة مرآة لما حدث في الدفاتر.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';
import { filterJournals, summarizeJournals } from '../../services/journalExplorerHelpers';
import type { JournalEntryView } from '../../types/journalExplorer';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  entries: JournalEntryView[];
  busy: boolean;
  error?: string;
  rulesUnavailable?: boolean;
  formatMoney: (value: number) => string;
  canEdit: boolean;
  onEdit: (entry: JournalEntryView) => void;
  onReload: () => void | Promise<void>;
}

export const JournalEntriesExplorer: React.FC<Props> = ({
  t, isArabic, entries, busy, error, rulesUnavailable, formatMoney, canEdit, onEdit, onReload,
}) => {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterJournals(entries, { search, dateFrom, dateTo }),
    [entries, search, dateFrom, dateTo]
  );
  const summary = useMemo(() => summarizeJournals(filtered), [filtered]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {t('بحث (رقم القيد، البيان، المستند، الحساب، القاعدة)', 'Search (entry no., description, document, account, rule)')}
            </span>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('اكتب للتصفية…', 'Type to filter…')}
                className="w-full bg-transparent py-1.5 text-[11px] outline-none dark:text-slate-100"
              />
            </div>
          </label>

          <label>
            <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('من تاريخ', 'From')}</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
          </label>

          <label>
            <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('إلى تاريخ', 'To')}</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
          </label>

          <button
            type="button"
            onClick={() => void onReload()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('تعذّر تحميل القيود: ', 'Failed to load entries: ') + error}</span>
        </div>
      )}

      {rulesUnavailable && (
        <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2 text-[10px] leading-4 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {t(
            'سجل قواعد الترحيل غير متاح (جدول التدقيق غير موجود بعد) — تُعرض القيود بلا أكواد القواعد.',
            'Rule audit log unavailable (audit table not applied yet) — entries are shown without rule codes.'
          )}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: 'count', labelAr: 'عدد القيود', labelEn: 'Entries', value: String(summary.count) },
          { key: 'debit', labelAr: 'إجمالي المدين', labelEn: 'Total debit', value: formatMoney(summary.totalDebit) },
          { key: 'credit', labelAr: 'إجمالي الدائن', labelEn: 'Total credit', value: formatMoney(summary.totalCredit) },
          { key: 'unbalanced', labelAr: 'قيود غير متوازنة', labelEn: 'Unbalanced', value: String(summary.unbalanced) },
        ].map((card) => (
          <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{isArabic ? card.labelAr : card.labelEn}</p>
            <p className={`mt-1 text-sm font-black ${card.key === 'unbalanced' && summary.unbalanced > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-right">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-2 py-2">{t('التاريخ', 'Date')}</th>
                <th className="px-2 py-2">{t('رقم القيد', 'Entry no.')}</th>
                <th className="px-2 py-2">{t('البيان / المستند', 'Description / document')}</th>
                <th className="px-2 py-2">{t('مدين', 'Debit')}</th>
                <th className="px-2 py-2">{t('دائن', 'Credit')}</th>
                <th className="px-2 py-2">{t('الحالة', 'Status')}</th>
                <th className="px-2 py-2">{t('السطور', 'Lines')}</th>
                <th className="px-2 py-2">{t('تعديل', 'Edit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[11px] text-slate-400">
                    {t('لا توجد قيود مطابقة.', 'No matching entries.')}
                  </td>
                </tr>
              )}

              {filtered.map((entry) => {
                const isOpen = expanded === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <tr className="text-[11px] text-slate-700 dark:text-slate-200">
                      <td className="px-2 py-2 align-top font-mono text-[10px] text-slate-500">{entry.entryDate || '—'}</td>
                      <td className="px-2 py-2 align-top font-mono text-[10px]">{entry.entryNumber || entry.id.slice(0, 10)}</td>
                      <td className="px-2 py-2 align-top">
                        <p className="font-bold">{entry.description || '—'}</p>
                        {entry.sourceDocument && <p className="text-[9px] text-slate-400">{entry.sourceDocument}</p>}
                        {entry.ruleCodes.length > 0 && (
                          <p className="mt-0.5 font-mono text-[9px] text-indigo-500 dark:text-indigo-300">{entry.ruleCodes.join(' · ')}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-[10px]">{formatMoney(entry.totalDebit)}</td>
                      <td className="px-2 py-2 align-top font-mono text-[10px]">{formatMoney(entry.totalCredit)}</td>
                      <td className="px-2 py-2 align-top">
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${entry.isBalanced ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                          {entry.isBalanced ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {entry.isBalanced ? t('متوازن', 'balanced') : t('غير متوازن', 'unbalanced')}
                        </span>
                        {!entry.isPosted && <span className="ms-1 rounded bg-amber-50 px-1 text-[9px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{t('غير مرحّل', 'unposted')}</span>}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : entry.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {entry.lines.length}
                        </button>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => onEdit(entry)}
                          disabled={!canEdit}
                          title={canEdit ? t('تعديل القيد ومزامنة المصدر', 'Edit the entry and sync its source') : t('تحتاج صلاحية accounting.edit_journal', 'Requires accounting.edit_journal')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-3 w-3" />
                          {t('تعديل', 'Edit')}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50/70 px-3 py-2 dark:bg-slate-800/40">
                          <table className="w-full text-[10px]">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="px-1 py-1 text-right">{t('الحساب', 'Account')}</th>
                                <th className="px-1 py-1 text-right">{t('البيان', 'Memo')}</th>
                                <th className="px-1 py-1 text-right">{t('مدين', 'Debit')}</th>
                                <th className="px-1 py-1 text-right">{t('دائن', 'Credit')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line, index) => (
                                <tr key={`${entry.id}-${index}`} className="border-t border-slate-200/60 dark:border-slate-700/60">
                                  <td className="px-1 py-1 font-mono">
                                    {line.accountCode} {line.accountName && `— ${line.accountName}`}
                                  </td>
                                  <td className="px-1 py-1 text-slate-500 dark:text-slate-400">{line.memo || '—'}</td>
                                  <td className="px-1 py-1 font-mono">{line.debit ? formatMoney(line.debit) : '—'}</td>
                                  <td className="px-1 py-1 font-mono">{line.credit ? formatMoney(line.credit) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {t(
          `تُعرض أحدث 500 قيد. المدة: ${summary.earliest ?? '—'} ← ${summary.latest ?? '—'}`,
          `Showing the latest 500 entries. Range: ${summary.earliest ?? '—'} → ${summary.latest ?? '—'}`
        )}
      </p>
    </div>
  );
};
