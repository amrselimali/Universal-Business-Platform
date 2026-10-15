import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GitMerge,
  Lock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  FileText,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import {
  TRANSACTION_TYPE_LABELS,
  loadAccountingMapping,
  saveAccountingMappingRule,
  type MappingLoadResult,
} from '../services/accountingMappingApi';
import type { AccountingMappingRule } from '../types/accountingMapping';

/**
 * شاشة ربط التسجيل بالحسابات — المصدر الحصري والوحيد لقيود اليومية
 * ---------------------------------------------------------------------------
 * كل قيد في النظام يُولَّد من قاعدة ربط مسجّلة هنا. لا قيد يدوي، ولا حساب
 * مكتوب في الكود. تغيير الحساب = تعديل صف واحد.
 *
 * الرقابة:
 *   • «فجوة تغطية»: أي نوع عملية بلا قاعدة ⇒ قيد لن يُولَّد ⇒ تحذير ظاهر.
 *   • «مصدر حصري»: يمنع إنشاء قيد يدوي لهذا النوع من خارج القاعدة.
 *   • سجل القيود المولَّدة: أثر تدقيقي كامل (أي قاعدة ولّدت أي قيد).
 */

const EMPTY: MappingLoadResult = { rules: [], gaps: [], generated: [] };

/** أعمدة جدول القواعد. */
const HEADERS: [string, string][] = [
  ['نوع العملية', 'Transaction'], ['القاعدة', 'Rule'], ['مدين', 'Debit'],
  ['دائن', 'Credit'], ['حصري', 'Exclusive'], ['آلي', 'Auto'], ['', ''],
];

export const AccountingMappingView: React.FC = () => {
  const { t, language, tenant, formatMoney } = usePlatform();
  const isArabic = language === 'ar';

  const [data, setData] = useState<MappingLoadResult>(EMPTY);
  const [drafts, setDrafts] = useState<Record<number, AccountingMappingRule>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const tenantId = tenant?.id || 'tenant-eg-001';

  const reload = useCallback(async () => {
    setBusy(true);
    const loaded = await loadAccountingMapping(tenantId);
    setData(loaded);
    setDrafts({});
    setBusy(false);
    const noConn =
      'لا يوجد اتصال بقاعدة البيانات — من شاشة Neon Hub أدخل الرابط ثم أعد المحاولة.';
    if (loaded.error === 'no_database_connection') {
      setNotice({ type: 'err', text: t(noConn, 'No database connection — configure it from the Neon Hub screen.') });
    } else if (loaded.error) {
      setNotice({ type: 'err', text: t('تعذّر تحميل القواعد: ', 'Failed to load rules: ') + loaded.error });
    }
  }, [tenantId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateDraft = (rule: AccountingMappingRule, patch: Partial<AccountingMappingRule>) =>
    setDrafts((prev) => ({ ...prev, [rule.id ?? -1]: { ...(prev[rule.id ?? -1] ?? rule), ...patch } }));

  const handleSave = async (rule: AccountingMappingRule) => {
    const draft = drafts[rule.id ?? -1] ?? rule;
    if (draft.debitAccountCode === draft.creditAccountCode) {
      setNotice({ type: 'err', text: t('لا يمكن أن يكون المدين هو الدائن.', 'Debit and credit must differ.') });
      return;
    }
    setBusy(true);
    const result = await saveAccountingMappingRule(draft);
    setBusy(false);
    if (result.ok) {
      setNotice({ type: 'ok', text: t('تم حفظ القاعدة.', 'Rule saved.') });
      await reload();
    } else {
      setNotice({ type: 'err', text: result.error ?? 'save_failed' });
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, AccountingMappingRule[]>();
    data.rules.forEach((rule) => {
      const list = map.get(rule.transactionType) ?? [];
      list.push(rule);
      map.set(rule.transactionType, list);
    });
    return [...map.entries()];
  }, [data.rules]);

  return (
    <div className="space-y-5" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* الترويسة */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Lock className="h-3.5 w-3.5" />
            <span>{t('المصدر الحصري والوحيد لقيود اليومية', 'Single Exclusive Source of Truth')}</span>
          </div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
            <GitMerge className="h-5 w-5 text-indigo-600" />
            <span>{t('ربط التسجيل بالحسابات ومولّد القيود', 'Posting-to-Accounts Mapping')}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t(
              'كل قيد محاسبي يُولَّد تلقائياً من قاعدة ربط مسجّلة هنا — لا قيد يدوي ولا حساب مكتوب في الكود.',
              'Every journal entry is generated from a rule registered here — no manual entries, no hardcoded accounts.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('توازن مدين = دائن', 'Debit = Credit')}
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Reload')}
          </button>
        </div>
      </div>

      {/* التنبيه */}
      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* فجوات التغطية */}
      {data.gaps.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('فجوات تغطية: ', 'Coverage gaps: ')}{data.gaps.length}</span>
          </div>
          <p className="mb-2 text-[11px] text-amber-800 dark:text-amber-400">
            {t(
              'أنواع عمليات بلا قاعدة ربط ⇒ لن يُولَّد لها أي قيد محاسبي.',
              'Transaction types without a rule ⇒ no journal entry will be generated.'
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.gaps.map((gap) => (
              <span
                key={gap.transactionType}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-mono text-[10px] font-bold text-amber-900 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
              >
                {TRANSACTION_TYPE_LABELS[gap.transactionType]?.ar ?? gap.transactionType}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* جدول القواعد */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
            <GitMerge className="h-4 w-4 text-indigo-600" />
            {t('قواعد الربط', 'Mapping rules')}
            <span className="font-mono text-slate-400">({data.rules.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {HEADERS.map(([ar, en]) => (
                  <th key={en} className="px-3 py-2 font-extrabold text-slate-600 dark:text-slate-300">
                    {t(ar, en)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                    {busy
                      ? t('جارٍ التحميل…', 'Loading…')
                      : t(
                          'لا توجد قواعد. شغّل neon_accounting_mapping_seed.sql لتحميل القواعد الأساسية.',
                          'No rules. Run neon_accounting_mapping_seed.sql to load the defaults.'
                        )}
                  </td>
                </tr>
              ) : (
                grouped.flatMap(([type, rules]) =>
                  rules.map((rule, index) => {
                    const draft = drafts[rule.id ?? -1] ?? rule;
                    const dirty = Boolean(drafts[rule.id ?? -1]);
                    const input =
                      'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

                    return (
                      <tr
                        key={rule.code}
                        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                          dirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {index === 0 ? (
                            TRANSACTION_TYPE_LABELS[type]?.ar ?? type
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
                          <input
                            value={draft.debitAccountCode}
                            onChange={(e) => updateDraft(rule, { debitAccountCode: e.target.value })}
                            className={`${input} w-20 font-mono`}
                          />
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {draft.debitAccountName}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={draft.creditAccountCode}
                            onChange={(e) => updateDraft(rule, { creditAccountCode: e.target.value })}
                            className={`${input} w-20 font-mono`}
                          />
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {draft.creditAccountName}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={draft.isStrictExclusive}
                            onChange={(e) => updateDraft(rule, { isStrictExclusive: e.target.checked })}
                            className="h-4 w-4 accent-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={draft.autoPostEnabled}
                            onChange={(e) => updateDraft(rule, { autoPostEnabled: e.target.checked })}
                            className="h-4 w-4 accent-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void handleSave(rule)}
                            disabled={busy || !dirty}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-30"
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

    </div>
  );
};
