/**
 * إقفال الفترات المحاسبية — بأزرار ظاهرة والمصدر الوحيد للقفل
 * ---------------------------------------------------------------------------
 * القفل يُكتب في `accounting_period_locks` وتفحصه `fn_post_document` داخل
 * الداتابيز: أي محاولة ترحيل بتاريخ داخل فترة مقفلة تُرفض حتى لو جاءت من API
 * أو من سكربت — لا يوجد قفل «على الواجهة فقط».
 */

import React, { useState } from 'react';
import { Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { lockPeriod, openPeriod } from '../../services/postingRulesApi';
import type { PeriodLock } from '../../types/postingRules';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  tenantId: string;
  locks: PeriodLock[];
  canLock: boolean;
  canOpen: boolean;
  actor?: string;
  notify: (type: 'ok' | 'err', text: string) => void;
  onChanged: () => void | Promise<void>;
}

export const PeriodLocksPanel: React.FC<Props> = ({
  t, isArabic, tenantId, locks, canLock, canOpen, actor, notify, onChanged,
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const activeLocks = locks.filter((lock) => lock.status === 'locked');
  const effectiveLock = activeLocks.reduce<string | null>(
    (max, lock) => (!max || lock.lockDate > max ? lock.lockDate : max),
    null
  );

  const run = async (action: 'lock' | 'open', lockDate: string) => {
    setBusy(true);
    const result =
      action === 'lock'
        ? await lockPeriod({ tenantId, date: lockDate, reason, actor })
        : await openPeriod(tenantId, lockDate);
    setBusy(false);
    notify(result.ok ? 'ok' : 'err', result.ok ? t('تم تحديث القفل.', 'Lock updated.') : result.error ?? 'failed');
    await onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
            {t('إقفال فترة محاسبية', 'Lock an accounting period')}
          </p>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
          {t(
            'الإقفال حتى تاريخ يعني منع أي ترحيل في هذا التاريخ أو ما قبله — يُفحص داخل الداتابيز وليس في الشاشة فقط.',
            'Locking up to a date blocks any posting on or before it — enforced inside the database, not just the UI.'
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('سبب الإقفال (اختياري)', 'Reason (optional)')}
            className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={() => void run('lock', date)}
            disabled={!canLock || busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            <Lock className="h-3.5 w-3.5" />
            {t('إقفال الفترة', 'Lock period')}
          </button>
        </div>

        {!canLock && (
          <p className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            {t('تحتاج صلاحية accounting.lock_period.', 'Requires accounting.lock_period.')}
          </p>
        )}

        {effectiveLock && (
          <p className="mt-2 rounded-xl bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {t(`الدفاتر مقفلة حتى ${effectiveLock}`, `Books locked through ${effectiveLock}`)}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p className="border-b border-slate-100 px-3 py-2 text-[12px] font-extrabold text-slate-800 dark:border-slate-800 dark:text-slate-100">
          {t('سجل الأقفال', 'Lock history')} ({locks.length})
        </p>
        <div className="max-h-80 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
          {locks.length === 0 && (
            <p className="p-4 text-center text-[11px] text-slate-400">{t('لا توجد أقفال.', 'No locks yet.')}</p>
          )}
          {locks.map((lock) => (
            <div key={lock.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div>
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {lock.lockDate}
                  <span
                    className={`ms-2 rounded px-1.5 py-0.5 text-[9px] font-black ${
                      lock.status === 'locked'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {lock.status === 'locked' ? t('مقفلة', 'locked') : t('مفتوحة', 'open')}
                  </span>
                </p>
                <p className="text-[9px] text-slate-400">
                  {lock.lockedBy ?? '—'} · {lock.reason ?? (isArabic ? 'بدون سبب' : 'no reason')}
                </p>
              </div>
              {lock.status === 'locked' && (
                <button
                  type="button"
                  onClick={() => void run('open', lock.lockDate)}
                  disabled={!canOpen || busy}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <LockOpen className="h-3 w-3" />
                  {t('فتح القفل', 'Unlock')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
