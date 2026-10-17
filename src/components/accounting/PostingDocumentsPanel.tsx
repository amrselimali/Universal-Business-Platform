/**
 * لوحة الترحيل — زر الترحيل الظاهر + طابور المستندات
 * ---------------------------------------------------------------------------
 * لا يوجد أي ترحيل مخفي في الكود: كل مستند يظهر هنا بحالته (معلّق/فاشل/مُرحَّل)
 * ويُرحَّل بضغطة زر مقيّدة بصلاحية `accounting.post_journal`. القيد يُبنى من
 * قواعد الشاشة فقط؛ فإن نقصت قاعدة ظهر سبب الرفض هنا بوضوح.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RotateCw, Send } from 'lucide-react';
import { ACCOUNTING_OPERATIONS, SELECTOR_OPTIONS, findOperation } from '../../data/accountingOperations';
import { postDocument } from '../../services/postingRulesApi';
import type { PostingComponent, PostingDocument } from '../../types/postingRules';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  tenantId: string;
  branchId?: string;
  documents: PostingDocument[];
  canPost: boolean;
  actor?: string;
  formatMoney: (value: number) => string;
  notify: (type: 'ok' | 'err', text: string) => void;
  onChanged: () => void | Promise<void>;
}

const statusStyle: Record<string, string> = {
  posted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  failed: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
};

export const PostingDocumentsPanel: React.FC<Props> = ({
  t, isArabic, tenantId, branchId, documents, canPost, actor, formatMoney, notify, onChanged,
}) => {
  const [opType, setOpType] = useState<string>(ACCOUNTING_OPERATIONS[0].type);
  const [documentRef, setDocumentRef] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selectors, setSelectors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const operation = useMemo(() => findOperation(opType), [opType]);

  const components = (): PostingComponent[] =>
    (operation?.fields ?? [])
      .map((field) => ({
        field_key: field.key,
        amount: Number(amounts[field.key] || 0),
        selector: field.selector ? selectors[field.key] || 'default' : 'default',
        memo: description || undefined,
        optional: !field.required,
      }))
      .filter((component) => Number.isFinite(component.amount) && component.amount !== 0);

  const submit = async () => {
    if (!operation) return;
    if (!documentRef.trim()) {
      notify('err', t('اكتب رقم المستند أولاً.', 'Enter the document number first.'));
      return;
    }
    setBusy(true);
    const result = await postDocument({
      tenantId,
      branchId,
      transactionType: operation.type,
      sourceScreen: isArabic ? operation.screenAr : operation.screenEn,
      sourceDocument: documentRef.trim(),
      date,
      description: description || (isArabic ? operation.labelAr : operation.labelEn),
      actor,
      components: components(),
    });
    setBusy(false);

    if (result.status === 'failed') {
      notify('err', result.error ?? 'posting_failed');
    } else {
      notify(
        'ok',
        result.status === 'already_posted'
          ? t('هذا المستند مُرحَّل مسبقاً — لم يُنشأ قيد مكرر.', 'Already posted — no duplicate entry created.')
          : t(`تم الترحيل: قيد ${result.journalId} (${result.lines} سطراً)`, `Posted: entry ${result.journalId} (${result.lines} lines)`)
      );
      setDocumentRef('');
      setAmounts({});
    }
    await onChanged();
  };

  const retry = async (doc: PostingDocument) => {
    const payload = doc.payload ?? [];
    if (payload.length === 0) {
      notify('err', t('لا توجد مكوّنات محفوظة لهذا المستند — أعد ترحيله من شاشته.', 'No stored components — re-post it from its screen.'));
      return;
    }
    setBusy(true);
    const result = await postDocument({
      tenantId,
      branchId: doc.branchId,
      transactionType: doc.transactionType,
      sourceScreen: doc.sourceScreen,
      sourceDocument: doc.sourceDocument,
      date: doc.documentDate,
      description: doc.sourceDocument,
      actor,
      components: payload,
      idempotencyKey: doc.idempotencyKey,
    });
    setBusy(false);
    notify(result.status === 'failed' ? 'err' : 'ok', result.error ?? `${result.journalId ?? ''}`);
    await onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
          {t('ترحيل مستند بقيد من القواعد', 'Post a document from the rules')}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={opType} onChange={(e) => { setOpType(e.target.value); setAmounts({}); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
            {ACCOUNTING_OPERATIONS.map((op) => (
              <option key={op.type} value={op.type}>{isArabic ? op.labelAr : op.labelEn}</option>
            ))}
          </select>
          <input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} placeholder={t('رقم المستند', 'Document no.')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('البيان (اختياري)', 'Description (optional)')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(operation?.fields ?? []).map((field) => (
            <div key={field.key} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {isArabic ? field.labelAr : field.labelEn}
              </p>
              <div className="mt-1 flex gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amounts[field.key] ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                />
                {field.selector && (
                  <select
                    value={selectors[field.key] ?? 'default'}
                    onChange={(e) => setSelectors((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-1 text-[10px] dark:border-slate-700 dark:bg-slate-900"
                  >
                    {SELECTOR_OPTIONS[field.selector].map((option) => (
                      <option key={option.key} value={option.key}>{isArabic ? option.labelAr : option.labelEn}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canPost || busy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {busy ? t('جارٍ الترحيل…', 'Posting…') : t('ترحيل القيد', 'Post journal entry')}
        </button>
        {!canPost && (
          <p className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            {t('لا تملك صلاحية الترحيل (accounting.post_journal).', 'You lack the posting permission (accounting.post_journal).')}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
            {t('طابور المستندات', 'Documents queue')} ({documents.length})
          </p>
          <span className="text-[10px] text-slate-400">{t('آخر 200 مستند', 'Latest 200')}</span>
        </div>

        <div className="max-h-96 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
          {documents.length === 0 && (
            <p className="p-4 text-center text-[11px] text-slate-400">{t('لا مستندات بعد.', 'No documents yet.')}</p>
          )}
          {documents.map((doc) => {
            const op = findOperation(doc.transactionType);
            const payload = doc.payload ?? [];
            return (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {isArabic ? op?.labelAr ?? doc.transactionType : op?.labelEn ?? doc.transactionType}
                    <span className="ms-1 font-mono text-[9px] text-slate-400">{doc.sourceDocument}</span>
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {doc.documentDate} · {formatMoney(doc.totalAmount)} · {t('محاولات', 'attempts')}: {doc.attempts}
                    {doc.journalEntryId ? ` · ${doc.journalEntryId}` : ''}
                  </p>
                  {doc.lastError && (
                    <p className="mt-0.5 flex items-start gap-1 text-[9px] text-rose-600 dark:text-rose-400">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{doc.lastError}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`rounded-lg px-1.5 py-0.5 text-[9px] font-bold ${statusStyle[doc.status]}`}>
                    {doc.status === 'posted' ? <CheckCircle2 className="inline h-3 w-3" /> : doc.status === 'failed' ? <AlertCircle className="inline h-3 w-3" /> : <Clock className="inline h-3 w-3" />} {doc.status}
                  </span>
                  {doc.status !== 'posted' && (
                    <button
                      type="button"
                      onClick={() => void retry(doc)}
                      disabled={!canPost || busy || payload.length === 0}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                      <RotateCw className="h-3 w-3" />
                      {t('ترحيل القيد', 'Post entry')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
