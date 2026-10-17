/**
 * شريط تشخيص الاتصال وRLS
 * ---------------------------------------------------------------------------
 * يجيب على سؤال «لماذا البيانات مختلفة عن نيون؟»:
 *   • من المستخدم وعلى أي قاعدة/مضيف؟
 *   • هل RLS مفعّل على الجدول؟
 *   • كم عموداً؟ وكم صفاً يرى هذا الدور مقابل تقدير المحرك؟
 * فُصل من الشاشة التزاماً بحد 300 سطر.
 */

import React from 'react';
import type { DbConnectionIdentity, DbRowPage, DbTable } from '../../types/databaseExplorer';

interface Props {
  t: (ar: string, en: string) => string;
  identity: DbConnectionIdentity | null;
  table?: DbTable;
  page: DbRowPage;
}

export const ConnectionDiagnostics: React.FC<Props> = ({ t, identity, table, page }) => (
  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
    <span className="font-bold">{t('الاتصال:', 'Connection:')}</span>
    <span className="font-mono" dir="ltr">
      {identity ? `${identity.user} @ ${identity.database}${identity.host ? ` (${identity.host})` : ''}` : '—'}
    </span>
    {table && (
      <span className={`rounded px-1.5 py-0.5 font-bold ${table.rlsEnabled ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
        {table.rlsEnabled ? t('RLS مفعّل', 'RLS enabled') : t('بلا RLS', 'no RLS')}
      </span>
    )}
    {table && <span>{table.columns.length} {t('عمود', 'columns')}</span>}
    {table && table.rlsEnabled && page.total < table.estimatedRows && (
      <span className="font-bold text-amber-700 dark:text-amber-300">
        {t(
          `هذا الدور يرى ${page.total} من ~${table.estimatedRows} — الباقي لمستأجرين آخرين (RLS).`,
          `This role sees ${page.total} of ~${table.estimatedRows} — the rest belongs to other tenants (RLS).`
        )}
      </span>
    )}
    {page.bypassed && <span className="font-bold text-rose-600 dark:text-rose-300">{t('معروض بتجاوز RLS', 'shown bypassing RLS')}</span>}
    {page.bypassError && (
      <span className="text-rose-600 dark:text-rose-300">{t('تجاوز RLS مرفوض: ', 'RLS bypass rejected: ') + page.bypassError}</span>
    )}
  </div>
);
