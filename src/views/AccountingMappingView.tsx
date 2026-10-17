import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, GitMerge, Layers, ListChecks, Lock, Send } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { loadPostingSnapshot } from '../services/postingRulesApi';
import { computeCoverage } from '../data/accountingOperations';
import type { PostingRulesSnapshot } from '../types/postingRules';
import { PostingRulesPanel } from '../components/accounting/PostingRulesPanel';
import { PostingDocumentsPanel } from '../components/accounting/PostingDocumentsPanel';
import { PeriodLocksPanel } from '../components/accounting/PeriodLocksPanel';
import { PostingCoveragePanel } from '../components/accounting/PostingCoveragePanel';

/**
 * شاشة ربط العمليات بالقيود المحاسبية — المصدر الوحيد للتوجيه
 * ---------------------------------------------------------------------------
 * أربعة تبويبات:
 *   1. قواعد الترحيل : كل خلية رقمية في كل عملية ← اتجاه + حساب (أو "غير مربوطة").
 *   2. الترحيل        : زر ترحيل ظاهر + طابور المستندات (معلّق/فاشل/مُرحَّل).
 *   3. إقفال الفترات  : أزرار إقفال/فتح تُفحص داخل الداتابيز.
 *   4. التغطية        : نسبة الخلايا المربوطة + الفجوات التي تمنع الترحيل.
 *
 * لا يوجد قيد يُبنى من حسابات مخزّنة على المنتج/طريقة الدفع/العميل، ولا كود
 * يحتوي أكواد حسابات احتياطية. غياب القاعدة = رفض الترحيل.
 */

type TabId = 'rules' | 'posting' | 'locks' | 'coverage';

const EMPTY: PostingRulesSnapshot = { rules: [], documents: [], locks: [] };

export const AccountingMappingView: React.FC = () => {
  const { t, language, tenant, accounts, currentUser, canPerformAction, formatMoney, activeBranch } =
    usePlatform();
  const isArabic = language === 'ar';
  const tenantId = tenant?.id || 'tenant-eg-001';

  const [tab, setTab] = useState<TabId>('rules');
  const [snapshot, setSnapshot] = useState<PostingRulesSnapshot>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const notify = useCallback((type: 'ok' | 'err', text: string) => setNotice({ type, text }), []);

  const reload = useCallback(async () => {
    setBusy(true);
    const loaded = await loadPostingSnapshot(tenantId);
    setSnapshot(loaded);
    setBusy(false);
    if (loaded.error === 'no_database_connection') {
      notify('err', t('لا يوجد اتصال بقاعدة البيانات — اضبطه من شاشة Neon Hub.', 'No database connection — configure it from the Neon Hub screen.'));
    } else if (loaded.error) {
      notify('err', t('تعذّر تحميل القواعد: ', 'Failed to load rules: ') + loaded.error);
    }
  }, [tenantId, t, notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const coverage = useMemo(() => computeCoverage(snapshot.rules), [snapshot.rules]);
  const canPost = canPerformAction('accounting.post_journal');
  const canLock = canPerformAction('accounting.lock_period');
  const canOpen = canPerformAction('accounting.open_period');
  const accountOptions = useMemo(
    () => accounts.map((account) => ({ id: account.id, code: account.code ?? '', nameAr: account.nameAr })),
    [accounts]
  );

  const tabs: { id: TabId; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: 'rules', labelAr: 'قواعد الترحيل', labelEn: 'Posting rules', icon: <GitMerge className="h-3.5 w-3.5" /> },
    { id: 'posting', labelAr: 'الترحيل', labelEn: 'Posting', icon: <Send className="h-3.5 w-3.5" /> },
    { id: 'locks', labelAr: 'إقفال الفترات', labelEn: 'Period locks', icon: <Lock className="h-3.5 w-3.5" /> },
    { id: 'coverage', labelAr: 'التغطية', labelEn: 'Coverage', icon: <ListChecks className="h-3.5 w-3.5" /> },
  ];

  const failedCount = snapshot.documents.filter((doc) => doc.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <GitMerge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white">
              {t('ربط العمليات بالقيود المحاسبية', 'Posting rules & chart routing')}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t('المصدر الوحيد لتوجيه القيود · لا حسابات مخزّنة ولا أكواد في الكود', 'The single source of journal routing · no stored account fields, no hardcoded codes')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
          <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Layers className="h-3 w-3" /> {snapshot.rules.length} {t('قاعدة', 'rules')}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 ${
              coverage.covered === coverage.total
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            {coverage.covered} / {coverage.total} {t('خلية مربوطة', 'cells bound')}
          </span>
          {failedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-3 w-3" /> {failedCount} {t('ترحيل فاشل', 'failed')}
            </span>
          )}
          <button
            type="button"
            onClick={() => void reload()}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {busy ? t('تحديث…', 'Refreshing…') : t('تحديث', 'Refresh')}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-[11px] font-bold ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="leading-5">{notice.text}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${
              tab === item.id
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.icon}
            {isArabic ? item.labelAr : item.labelEn}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <PostingRulesPanel
          t={t}
          isArabic={isArabic}
          tenantId={tenantId}
          rules={snapshot.rules}
          accounts={accountOptions}
          canEdit={canPost}
          actor={currentUser?.name}
          notify={notify}
          onSaved={reload}
        />
      )}
      {tab === 'posting' && (
        <PostingDocumentsPanel
          t={t}
          isArabic={isArabic}
          tenantId={tenantId}
          branchId={activeBranch?.id}
          documents={snapshot.documents}
          canPost={canPost}
          actor={currentUser?.name}
          formatMoney={formatMoney}
          notify={notify}
          onChanged={reload}
        />
      )}
      {tab === 'locks' && (
        <PeriodLocksPanel
          t={t}
          isArabic={isArabic}
          tenantId={tenantId}
          locks={snapshot.locks}
          canLock={canLock}
          canOpen={canOpen}
          actor={currentUser?.name}
          notify={notify}
          onChanged={reload}
        />
      )}
      {tab === 'coverage' && (
        <PostingCoveragePanel t={t} isArabic={isArabic} coverage={coverage} documents={snapshot.documents} />
      )}
    </div>
  );
};
