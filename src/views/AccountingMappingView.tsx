import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  GitMerge,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { loadPostingSnapshot } from '../services/postingRulesApi';
import { loadJournalEntries } from '../services/journalExplorerApi';
import { computeCoverage } from '../data/accountingOperations';
import type { JournalEntryView } from '../types/journalExplorer';
import type { PostingRulesSnapshot } from '../types/postingRules';
import { JournalEntriesExplorer } from '../components/accounting/JournalEntriesExplorer';
import { PostingRulesReadOnly } from '../components/accounting/PostingRulesReadOnly';
import { PostingStatusReadOnly } from '../components/accounting/PostingStatusReadOnly';
import { PostingRulesPanel } from '../components/accounting/PostingRulesPanel';
import { PostingDocumentsPanel } from '../components/accounting/PostingDocumentsPanel';
import { PeriodLocksPanel } from '../components/accounting/PeriodLocksPanel';
import { PostingCoveragePanel } from '../components/accounting/PostingCoveragePanel';
import { GeneratedEntriesTable } from './accounting-mapping/GeneratedEntriesTable';

/**
 * شاشة ربط العمليات بالقيود المحاسبية — **للعرض فقط**
 * ---------------------------------------------------------------------------
 * الافتراضي: مراقبة ما يحدث فعلاً في الدفاتر:
 *   1. القيود المنشأة : كل قيد أُنشئ (حتى 500) بسطوره ومصدره وقواعد الترحيل التي
 *      أنتجته، مع بحث وتصفية تاريخ وإجماليات وحالة توازن — بلا أي تعديل.
 *   2. القواعد        : مرجع قراءة فقط لكل قاعدة (اتجاه + حساب + الطريقة/النوع).
 *   3. حالة الترحيل   : مستندات (مُرحَّلة/فاشلة/معلّقة) وأقفال الفترات — قراءة فقط.
 *
 * أدوات الإدارة (تحرير القواعد/الترحيل/الإقفال) لا تُفتح إلا بضغطة صريحة من
 * مستخدم يملك الأفعال، حتى تبقى هذه الشاشة مرآة لا لوحة تحكم.
 */

type ViewTab = 'journals' | 'rules' | 'status';
type AdminTab = 'edit-rules' | 'posting' | 'locks' | 'coverage';

const EMPTY: PostingRulesSnapshot = { rules: [], documents: [], locks: [], generated: [] };

export const AccountingMappingView: React.FC = () => {
  const { t, language, tenant, accounts, paymentMethods, currentUser, canPerformAction, formatMoney, activeBranch } =
    usePlatform();
  const isArabic = language === 'ar';
  const tenantId = tenant?.id || 'tenant-eg-001';

  const [tab, setTab] = useState<ViewTab>('journals');
  const [adminMode, setAdminMode] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>('edit-rules');
  const [snapshot, setSnapshot] = useState<PostingRulesSnapshot>(EMPTY);
  const [journals, setJournals] = useState<JournalEntryView[]>([]);
  const [journalError, setJournalError] = useState<string | undefined>();
  const [rulesUnavailable, setRulesUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const notify = useCallback((type: 'ok' | 'err', text: string) => setNotice({ type, text }), []);

  const reload = useCallback(async () => {
    setBusy(true);
    const [loaded, journalResult] = await Promise.all([
      loadPostingSnapshot(tenantId),
      loadJournalEntries(tenantId),
    ]);
    setSnapshot(loaded);
    setJournals(journalResult.entries);
    setJournalError(journalResult.error);
    setRulesUnavailable(Boolean(journalResult.rulesUnavailable));
    setBusy(false);

    if (loaded.error === 'no_database_connection' || journalResult.error === 'no_database_connection') {
      notify('err', t('لا يوجد اتصال بقاعدة البيانات — اضبطه من شاشة Neon Hub.', 'No database connection — configure it from the Neon Hub screen.'));
    } else if (journalResult.error) {
      notify('err', t('تعذّر تحميل القيود: ', 'Failed to load entries: ') + journalResult.error);
    }
  }, [tenantId, t, notify]);

  useEffect(() => { void reload(); }, [reload]);

  const coverage = useMemo(() => computeCoverage(snapshot.rules), [snapshot.rules]);
  const canPost = canPerformAction('accounting.post_journal');
  const canLock = canPerformAction('accounting.lock_period');
  const canOpen = canPerformAction('accounting.open_period');
  const canManage = canPost || canLock;

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ id: account.id, code: account.code ?? '', nameAr: account.nameAr })),
    [accounts]
  );
  const paymentMethodRefs = useMemo(
    () =>
      paymentMethods
        .filter((method) => !method.isArchived)
        .map((method) => ({ id: method.id, nameAr: method.nameAr, code: method.code, type: method.type })),
    [paymentMethods]
  );

  const viewTabs: { id: ViewTab; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: 'journals', labelAr: 'القيود المنشأة', labelEn: 'Created entries', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'rules', labelAr: 'القواعد (مرجع)', labelEn: 'Rules (reference)', icon: <BookOpenCheck className="h-3.5 w-3.5" /> },
    { id: 'status', labelAr: 'حالة الترحيل', labelEn: 'Posting status', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  ];

  const adminTabs: { id: AdminTab; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: 'edit-rules', labelAr: 'تحرير القواعد', labelEn: 'Edit rules', icon: <GitMerge className="h-3.5 w-3.5" /> },
    { id: 'posting', labelAr: 'ترحيل مستند', labelEn: 'Post entry', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'locks', labelAr: 'إقفال الفترات', labelEn: 'Period locks', icon: <Lock className="h-3.5 w-3.5" /> },
    { id: 'coverage', labelAr: 'التغطية', labelEn: 'Coverage', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <GitMerge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white">
              {t('ربط العمليات بالقيود المحاسبية', 'Journal routing & entries')}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t('عرض كل القيود التي أُنشئت فعلاً وتوجيهها وقواعدها', 'Read every entry actually created, its routing and its rules')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
          <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <ShieldCheck className="h-3 w-3" /> {t('عرض فقط', 'Read-only')}
          </span>
          <span className="rounded-xl bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {journals.length} {t('قيد', 'entries')}
          </span>
          <span className={`rounded-xl px-2 py-1 ${coverage.covered === coverage.total ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
            {coverage.covered}/{coverage.total} {t('خلية مربوطة', 'cells bound')}
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {busy ? t('تحديث…', 'Refreshing…') : t('تحديث', 'Refresh')}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setAdminMode((prev) => !prev)}
              className={`rounded-xl px-2 py-1 ${adminMode ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-dashed border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300'}`}
              title={t('يفتح أدوات التحرير والترحيل والإقفال', 'Opens editing, posting and locking tools')}
            >
              {adminMode ? t('إغلاق أدوات الإدارة', 'Close admin tools') : t('أدوات الإدارة', 'Admin tools')}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-[11px] font-bold ${notice.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'}`}>
          {notice.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="leading-5">{notice.text}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {viewTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setTab(item.id); setAdminMode(false); }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${tab === item.id && !adminMode ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            {item.icon}
            {isArabic ? item.labelAr : item.labelEn}
          </button>
        ))}

        {adminMode && (
          <span className="mx-1 h-8 w-px self-center bg-slate-200 dark:bg-slate-700" />
        )}
        {adminMode &&
          adminTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAdminTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${adminTab === item.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'}`}
            >
              {item.icon}
              {isArabic ? item.labelAr : item.labelEn}
            </button>
          ))}
      </div>

      {!adminMode && tab === 'journals' && (
        <JournalEntriesExplorer
          t={t}
          isArabic={isArabic}
          entries={journals}
          busy={busy}
          error={journalError}
          rulesUnavailable={rulesUnavailable}
          formatMoney={formatMoney}
          onReload={reload}
        />
      )}
      {!adminMode && tab === 'rules' && (
        <PostingRulesReadOnly
          t={t}
          isArabic={isArabic}
          rules={snapshot.rules}
          gaps={coverage.gaps}
          coverage={coverage}
          paymentMethods={paymentMethodRefs}
        />
      )}
      {!adminMode && tab === 'status' && (
        <PostingStatusReadOnly
          t={t}
          isArabic={isArabic}
          documents={snapshot.documents}
          locks={snapshot.locks}
          formatMoney={formatMoney}
        />
      )}

      {adminMode && adminTab === 'edit-rules' && (
        <PostingRulesPanel
          t={t}
          isArabic={isArabic}
          tenantId={tenantId}
          rules={snapshot.rules}
          accounts={accountOptions}
          paymentMethods={paymentMethodRefs}
          canEdit={canPost}
          actor={currentUser?.name}
          notify={notify}
          onSaved={reload}
        />
      )}
      {adminMode && adminTab === 'posting' && (
        <PostingDocumentsPanel
          t={t}
          isArabic={isArabic}
          tenantId={tenantId}
          branchId={activeBranch?.id}
          documents={snapshot.documents}
          paymentMethods={paymentMethodRefs}
          canPost={canPost}
          actor={currentUser?.name}
          formatMoney={formatMoney}
          notify={notify}
          onChanged={reload}
        />
      )}
      {adminMode && adminTab === 'locks' && (
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
      {adminMode && adminTab === 'coverage' && (
        <div className="space-y-3">
          <PostingCoveragePanel t={t} isArabic={isArabic} coverage={coverage} documents={snapshot.documents} generated={snapshot.generated} formatMoney={formatMoney} />
          <GeneratedEntriesTable entries={snapshot.generated} formatMoney={formatMoney} t={t} isArabic={isArabic} />
        </div>
      )}
    </div>
  );
};
