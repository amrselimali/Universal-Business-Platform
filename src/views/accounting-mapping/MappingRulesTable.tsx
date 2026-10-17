import React from 'react';
import { GitMerge, Save, Lock, Zap } from 'lucide-react';
import type { AccountingMappingRule } from '../../types/accountingMapping';
import { TRANSACTION_TYPE_LABELS } from '../../services/accountingMappingApi';
import type { Account } from '../../types';

interface Props {
  grouped: [string, AccountingMappingRule[]][];
  drafts: Record<number, AccountingMappingRule>;
  busy: boolean;
  accounts: Account[];
  t: (ar: string, en?: string) => string;
  updateDraft: (rule: AccountingMappingRule, patch: Partial<AccountingMappingRule>) => void;
  handleSave: (rule: AccountingMappingRule) => void;
}

export const MappingRulesTable: React.FC<Props> = ({
  grouped,
  drafts,
  busy,
  accounts,
  t,
  updateDraft,
  handleSave,
}) => {
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  const onAccountChange = (
    rule: AccountingMappingRule,
    type: 'debit' | 'credit',
    accountCode: string
  ) => {
    const matched = accounts.find((a) => a.code === accountCode);
    if (type === 'debit') {
      updateDraft(rule, {
        debitAccountCode: accountCode,
        debitAccountName: matched?.nameAr || rule.debitAccountName,
        debitAccountId: matched?.id || rule.debitAccountId,
      });
    } else {
      updateDraft(rule, {
        creditAccountCode: accountCode,
        creditAccountName: matched?.nameAr || rule.creditAccountName,
        creditAccountId: matched?.id || rule.creditAccountId,
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
          <GitMerge className="h-4 w-4 text-indigo-600" />
          {t('قواعد ربط العمليات بالحسابات', 'Posting-to-Accounts Mapping Rules')}
          <span className="font-mono text-slate-400">
            ({grouped.reduce((acc, [, r]) => acc + r.length, 0)})
          </span>
        </h2>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('المصدر الحصري: أي تعديل هنا يحدد تلقائياً الحسابات المدينة والدائنة للعمليات', 'Single source of accounts')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('نوع العملية', 'Transaction')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('القاعدة والكود', 'Rule & Code')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('الحساب المدين', 'Debit Account')}
              </th>
              <th className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                {t('الحساب الدائن', 'Credit Account')}
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1" title={t('يمنع أي قيد يدوي من خارج هذه القاعدة', 'Strict Exclusive')}>
                  <Lock className="h-3 w-3 text-indigo-600" />
                  {t('حصري', 'Exclusive')}
                </span>
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1" title={t('ترحيل آلي فوري عند إنشاء المعاملة', 'Auto-Post')}>
                  <Zap className="h-3 w-3 text-amber-500" />
                  {t('آلي', 'Auto')}
                </span>
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                  {busy ? t('جارٍ التحميل…', 'Loading…') : t('لا توجد قواعد ربط مسجلة.', 'No mapping rules.')}
                </td>
              </tr>
            ) : (
              grouped.flatMap(([type, rules]) =>
                rules.map((rule, index) => {
                  const draft = drafts[rule.id ?? -1] ?? rule;
                  const dirty = Boolean(drafts[rule.id ?? -1]);

                  return (
                    <tr
                      key={rule.code}
                      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                        dirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {index === 0 ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {TRANSACTION_TYPE_LABELS[type]?.ar ?? type}
                          </span>
                        ) : (
                          <span className="text-slate-300">↳</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-100">
                          {rule.nameAr}
                        </span>
                        <span className="block font-mono text-[10px] text-slate-400">{rule.code}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={draft.debitAccountCode}
                            onChange={(e) => onAccountChange(rule, 'debit', e.target.value)}
                            className={`${inputClass} w-20 font-mono text-emerald-700 dark:text-emerald-400 font-bold`}
                            title={t('كود الحساب المدين', 'Debit code')}
                          />
                        </div>
                        <span className="mt-0.5 block truncate max-w-[160px] text-[10px] text-slate-400" title={draft.debitAccountName}>
                          {draft.debitAccountName}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={draft.creditAccountCode}
                            onChange={(e) => onAccountChange(rule, 'credit', e.target.value)}
                            className={`${inputClass} w-20 font-mono text-amber-700 dark:text-amber-400 font-bold`}
                            title={t('كود الحساب الدائن', 'Credit code')}
                          />
                        </div>
                        <span className="mt-0.5 block truncate max-w-[160px] text-[10px] text-slate-400" title={draft.creditAccountName}>
                          {draft.creditAccountName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={draft.isStrictExclusive}
                          onChange={(e) => updateDraft(rule, { isStrictExclusive: e.target.checked })}
                          className="h-4 w-4 rounded accent-indigo-600"
                          title={t('مصدر حصري: يمنع القيود اليدوية لهذا النوع', 'Strict exclusive')}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={draft.autoPostEnabled}
                          onChange={(e) => updateDraft(rule, { autoPostEnabled: e.target.checked })}
                          className="h-4 w-4 rounded accent-indigo-600"
                          title={t('ترحيل آلي فوري', 'Auto-post enabled')}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void handleSave(rule)}
                          disabled={busy || !dirty}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-30"
                        >
                          <Save className="h-3 w-3" />
                          {t('حفظ', 'Save')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
