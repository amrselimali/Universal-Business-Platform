/**
 * محرّر قيد محاسبي — تعديل موثّق ينعكس على المصدر
 * ---------------------------------------------------------------------------
 * - التعديل لا يمر إلا بقيد متوازن وحسابات موجودة وسبب مكتوب.
 * - الحفظ يستدعي fn_update_journal: يطبّق الفرق على الأرصدة، يسجّل قبل/بعد،
 *   ويزامن المصدر (مستند الترحيل / السند / الفاتورة) ثم يرفع الإصدار.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Save, Trash2, X } from 'lucide-react';
import { toEditableLine, validateEditLines, type EditableLine } from '../../services/journalEditHelpers';
import { updateJournalEntry } from '../../services/journalExplorerApi';
import type { JournalEntryView } from '../../types/journalExplorer';
import type { AccountOption } from './PostingRulesPanel';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  tenantId: string;
  actor?: string;
  entry: JournalEntryView;
  accounts: AccountOption[];
  canEdit: boolean;
  notify: (type: 'ok' | 'err', text: string) => void;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export const JournalEntryEditor: React.FC<Props> = ({
  t, isArabic, tenantId, actor, entry, accounts, canEdit, notify, onCancel, onSaved,
}) => {
  const [date, setDate] = useState(entry.entryDate);
  const [description, setDescription] = useState(entry.description);
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<EditableLine[]>(entry.lines.map(toEditableLine));
  const [busy, setBusy] = useState(false);

  const accountCodes = useMemo(() => new Set(accounts.map((account) => account.code)), [accounts]);
  const validation = useMemo(() => validateEditLines(lines, accountCodes), [lines, accountCodes]);
  const canSave = canEdit && validation.ok && reason.trim().length >= 3 && !busy;

  const patchLine = (index: number, patch: Partial<EditableLine>) =>
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const result = await updateJournalEntry({
      tenantId,
      journalId: entry.id,
      date,
      description,
      reason: reason.trim(),
      actor,
      lines,
    });
    setBusy(false);

    if (!result.ok) {
      notify('err', result.error ?? 'edit_failed');
      return;
    }

    const synced = (result.sourceSync ?? []).map((item) => item.kind).join(' · ');
    notify(
      'ok',
      t(
        `تم تعديل القيد (إصدار ${result.version}). المصدر المتزامن: ${synced || 'لا يوجد مصدر مرتبط'}`,
        `Entry updated (version ${result.version}). Synced source: ${synced || 'none linked'}`
      )
    );
    await onSaved();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-3 dark:border-indigo-900/40 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
          {t('تعديل القيد', 'Edit entry')}{' '}
          <span className="font-mono text-[10px] text-slate-400">{entry.entryNumber || entry.id.slice(0, 12)}</span>
          <span className="ms-2 rounded bg-slate-100 px-1 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            v{entry.version}
          </span>
        </p>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <X className="h-3 w-3" /> {t('إلغاء', 'Cancel')}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label>
          <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('التاريخ', 'Date')}</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={input} />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('البيان', 'Description')}</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} className={input} />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-[10px]">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-2 py-1 text-right">{t('الحساب', 'Account')}</th>
              <th className="px-2 py-1 text-right">{t('البيان', 'Memo')}</th>
              <th className="px-2 py-1 text-right">{t('مدين', 'Debit')}</th>
              <th className="px-2 py-1 text-right">{t('دائن', 'Credit')}</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-1 py-1">
                  <select value={line.accountCode} onChange={(event) => patchLine(index, { accountCode: event.target.value })} className={input}>
                    <option value="">{t('— اختر —', '— pick —')}</option>
                    {accounts.map((account) => (
                      <option key={account.code} value={account.code}>{account.code} — {account.nameAr}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input value={line.memo} onChange={(event) => patchLine(index, { memo: event.target.value })} className={input} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" step="0.01" value={line.debit || ''} onChange={(event) => patchLine(index, { debit: Number(event.target.value) || 0, credit: 0 })} className={input} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" step="0.01" value={line.credit || ''} onChange={(event) => patchLine(index, { credit: Number(event.target.value) || 0, debit: 0 })} className={input} />
                </td>
                <td className="px-1 py-1 text-center">
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))} className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { accountCode: '', memo: '', debit: 0, credit: 0 }])}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          <Plus className="h-3 w-3" /> {t('إضافة سطر', 'Add line')}
        </button>

        <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${validation.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
          {validation.ok ? <CheckCircle2 className="inline h-3 w-3" /> : <AlertCircle className="inline h-3 w-3" />}{' '}
          {t('مدين', 'Debit')} {validation.totalDebit} · {t('دائن', 'Credit')} {validation.totalCredit}
        </span>
      </div>

      {!validation.ok && (
        <ul className="space-y-0.5 rounded-xl bg-rose-50 p-2 text-[10px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {(isArabic ? validation.errorsAr : validation.errorsEn).map((error) => (
            <li key={error}>• {error}</li>
          ))}
        </ul>
      )}

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">
          {t('سبب التعديل (إجباري — يُسجَّل في سجل التدقيق)', 'Reason for the edit (required — audited)')}
        </span>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('مثال: تصحيح حساب الإيراد', 'e.g. correcting the revenue account')} className={input} />
      </label>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
          {t(
            'الحفظ يطبّق الفرق على أرصدة الحسابات، يسجّل قبل/بعد في سجل التعديلات، ويحدّث المصدر المرتبط (مستند/سند/فاتورة).',
            'Saving applies the balance delta, records before/after in the audit log, and updates the linked source (document/receipt/invoice).'
          )}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ التعديل', 'Save edit')}
        </button>
      </div>
    </div>
  );
};
