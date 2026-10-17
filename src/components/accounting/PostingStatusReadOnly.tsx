/**
 * حالة الترحيل — عرض فقط (مستندات + أقفال)
 * ---------------------------------------------------------------------------
 * يوضّح أي عمليات رُحّلت، وأيها فشل وسببه، وأي الفترات مقفلة — بلا أي أزرار
 * ترحيل أو إقفال (تلك في أدوات الإدارة).
 */

import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Lock } from 'lucide-react';
import { findOperation } from '../../data/accountingOperations';
import type { PeriodLock, PostingDocument } from '../../types/postingRules';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  documents: PostingDocument[];
  locks: PeriodLock[];
  formatMoney: (value: number) => string;
}

const badge = (status: string): string =>
  status === 'posted'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    : status === 'failed'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';

const statusIcon = (status: string) =>
  status === 'posted' ? <CheckCircle2 className="inline h-3 w-3" /> : status === 'failed' ? <AlertCircle className="inline h-3 w-3" /> : <Clock className="inline h-3 w-3" />;

export const PostingStatusReadOnly: React.FC<Props> = ({ t, isArabic, documents, locks, formatMoney }) => {
  const activeLock = locks
    .filter((lock) => lock.status === 'locked')
    .reduce<string | null>((max, lock) => (!max || lock.lockDate > max ? lock.lockDate : max), null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {t('حالة المستندات والأقفال — للعرض فقط', 'Documents and locks status — read-only')}
        </p>
        {activeLock ? (
          <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <Lock className="h-3 w-3" /> {t('الدفاتر مقفلة حتى ' + activeLock, 'Books locked through ' + activeLock)}
          </span>
        ) : (
          <span className="rounded-xl bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t('لا يوجد إقفال سارٍ', 'No active lock')}
          </span>
        )}
      </div>

      <DocumentsList t={t} isArabic={isArabic} documents={documents} formatMoney={formatMoney} />
      <LocksList t={t} locks={locks} />
    </div>
  );
};

const DocumentsList: React.FC<Pick<Props, 't' | 'isArabic' | 'documents' | 'formatMoney'>> = ({ t, isArabic, documents, formatMoney }) => (
  <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <p className="border-b border-slate-100 px-3 py-2 text-[12px] font-extrabold text-slate-800 dark:border-slate-800 dark:text-slate-100">
      {t('مستندات الترحيل', 'Posting documents')} ({documents.length})
    </p>
    <div className="max-h-80 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
      {documents.length === 0 && (
        <p className="p-4 text-center text-[11px] text-slate-400">{t('لا مستندات.', 'No documents.')}</p>
      )}
      {documents.map((doc) => {
        const op = findOperation(doc.transactionType);
        return (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {isArabic ? op?.labelAr ?? doc.transactionType : op?.labelEn ?? doc.transactionType}
                <span className="ms-1 font-mono text-[9px] text-slate-400">{doc.sourceDocument}</span>
              </p>
              <p className="text-[9px] text-slate-400">
                {doc.documentDate} · {formatMoney(doc.totalAmount)}
                {doc.journalEntryId ? ` · ${doc.journalEntryId}` : ''}
              </p>
              {doc.lastError && (
                <p className="flex items-start gap-1 text-[9px] text-rose-600 dark:text-rose-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> <span>{doc.lastError}</span>
                </p>
              )}
            </div>
            <span className={'rounded-lg px-1.5 py-0.5 text-[9px] font-bold ' + badge(doc.status)}>
              {statusIcon(doc.status)} {doc.status}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

const LocksList: React.FC<{ t: Props['t']; locks: PeriodLock[] }> = ({ t, locks }) => (
  <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <p className="border-b border-slate-100 px-3 py-2 text-[12px] font-extrabold text-slate-800 dark:border-slate-800 dark:text-slate-100">
      {t('أقفال الفترات', 'Period locks')} ({locks.length})
    </p>
    <div className="max-h-60 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
      {locks.length === 0 && (
        <p className="p-4 text-center text-[11px] text-slate-400">{t('لا أقفال.', 'No locks.')}</p>
      )}
      {locks.map((lock) => (
        <div key={lock.id} className="flex items-center justify-between px-3 py-1.5 text-[10px]">
          <span className="font-mono text-slate-700 dark:text-slate-200">{lock.lockDate}</span>
          <span className="text-slate-400">{(lock.lockedBy ?? '—') + ' · ' + (lock.reason ?? '—')}</span>
          <span className={lock.status === 'locked' ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
            {lock.status === 'locked' ? t('مقفلة', 'locked') : t('مفتوحة', 'open')}
          </span>
        </div>
      ))}
    </div>
  </div>
);
