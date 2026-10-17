import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GitMerge,
  Lock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Sparkles,
  FileText,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import {
  loadAccountingMapping,
  saveAccountingMappingRule,
  createAccountingMappingRule,
  seedDefaultMappingRules,
  TRANSACTION_TYPE_LABELS,
  type MappingLoadResult,
} from '../services/accountingMappingApi';
import type { AccountingMappingRule } from '../types/accountingMapping';
import { MappingRulesTable } from './accounting-mapping/MappingRulesTable';
import { GeneratedEntriesTable } from './accounting-mapping/GeneratedEntriesTable';
import { NewRuleModal } from './accounting-mapping/NewRuleModal';

const EMPTY: MappingLoadResult = { rules: [], gaps: [], generated: [] };

export const AccountingMappingView: React.FC = () => {
  const { t, language, tenant, accounts, formatMoney } = usePlatform();
  const isArabic = language === 'ar';

  const [activeTab, setActiveTab] = useState<'rules' | 'generated'>('rules');
  const [data, setData] = useState<MappingLoadResult>(EMPTY);
  const [drafts, setDrafts] = useState<Record<number, AccountingMappingRule>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const tenantId = tenant?.id || 'tenant-eg-003';

  const reload = useCallback(async () => {
    setBusy(true);
    const loaded = await loadAccountingMapping(tenantId);
    setData(loaded);
    setDrafts({});
    setBusy(false);
    if (loaded.error === 'no_database_connection') {
      setNotice({ type: 'err', text: t('لا يوجد اتصال بقاعدة البيانات — تحقق من الاتصال.', 'No database connection.') });
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
      setNotice({ type: 'ok', text: t('تم حفظ وتحديث قاعدة الربط بنجاح.', 'Rule saved successfully.') });
      await reload();
    } else {
      setNotice({ type: 'err', text: result.error ?? 'save_failed' });
    }
  };

  const handleCreateRule = async (newRule: Omit<AccountingMappingRule, 'id'>) => {
    setBusy(true);
    const res = await createAccountingMappingRule(newRule);
    setBusy(false);
    if (res.ok) {
      setIsNewModalOpen(false);
      setNotice({ type: 'ok', text: t('تم إضافة قاعدة الربط الجديدة بنجاح.', 'New rule added successfully.') });
      await reload();
    } else {
      setNotice({ type: 'err', text: res.error || 'Failed to create rule' });
    }
  };

  const handleSeedDefaults = async () => {
    setBusy(true);
    const res = await seedDefaultMappingRules(tenantId);
    setBusy(false);
    if (res.ok) {
      setNotice({ type: 'ok', text: t(`تم تهيئة ${res.count} قاعدة ربط قياسية لهذا الكيان بنجاح!`, `Initialized ${res.count} default rules!`) });
      await reload();
    } else {
      setNotice({ type: 'err', text: res.error || 'Failed to seed rules' });
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
    <div className="space-y-4" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Lock className="h-3.5 w-3.5" />
            <span>{t('المصدر الحصري والوحيد لقيود اليومية في المنظومة', 'Single Exclusive Source of Truth')}</span>
          </div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
            <GitMerge className="h-5 w-5 text-indigo-600" />
            <span>{t('ربط العمليات بالحسابات ومولّد القيود', 'Posting-to-Accounts Mapping')}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t(
              'كل قيد محاسبي يُولَّد تلقائياً من قاعدة ربط مسجّلة هنا — تعديل الحساب هنا يوجه كافة القيود فوراً.',
              'Every journal entry is generated from a rule registered here — editing an account here updates all future postings immediately.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.rules.length === 0 && (
            <button
              type="button"
              onClick={() => void handleSeedDefaults()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('تهيئة القواعد القياسية', 'Seed Default Rules')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white shadow-xs hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('قاعدة جديدة', 'New Rule')}
          </button>
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <GitMerge className="h-4 w-4" />
          <span>{t('قواعد ربط العمليات', 'Mapping Rules')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold dark:bg-slate-800">
            {data.rules.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('generated')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === 'generated'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{t('سجل القيود المولَّدة آلياً', 'Generated Entries Log')}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold dark:bg-slate-800">
            {data.generated.length}
          </span>
        </button>
      </div>

      {/* Notice */}
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

      {/* Coverage Gaps Alert */}
      {data.gaps.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('فجوات تغطية تحتاج ضبط قاعدة: ', 'Coverage gaps requiring rules: ')}{data.gaps.length}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
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

      {/* Tab content */}
      {activeTab === 'rules' ? (
        <MappingRulesTable
          grouped={grouped}
          drafts={drafts}
          busy={busy}
          accounts={accounts}
          t={t}
          updateDraft={updateDraft}
          handleSave={handleSave}
        />
      ) : (
        <GeneratedEntriesTable
          entries={data.generated}
          formatMoney={formatMoney}
          t={t}
          isArabic={isArabic}
        />
      )}

      <NewRuleModal
        isOpen={isNewModalOpen}
        tenantId={tenantId}
        accounts={accounts}
        busy={busy}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateRule}
        t={t}
      />
    </div>
  );
};
