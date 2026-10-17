import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { loadDatabaseCatalog, fetchTableRows } from '../services/databaseExplorerApi';
import { loadConnectionIdentity } from '../services/databaseIdentityApi';
import { dropTable } from '../services/databaseSchemaApi';
import { isProtectedTable } from '../services/databaseIdentifiers';
import { TablesSidebar } from '../components/database/TablesSidebar';
import { TableGrid } from '../components/database/TableGrid';
import { TableStructure } from '../components/database/TableStructure';
import type { DbCatalog, DbConnectionIdentity, DbRowPage, DbTable } from '../types/databaseExplorer';

/**
 * إدارة قاعدة البيانات من الواجهة — مرآة حقيقية
 * ---------------------------------------------------------------------------
 * • تعرض المخططات والجداول والأعمدة والصفوف كما هي في قاعدة البيانات.
 * • التعديل/الإضافة/الحذف/DDL يؤثر مباشرة في الداتابيز، ثم يُطلق `syncNow`
 *   لتحديث بيانات التطبيق المعروضة (مرآة مزدوجة الاتجاه).
 * • كل عملية محكومة بصلاحية مستقلة، والحذف بتأكيد نصي، وكل شيء يُسجَّل في
 *   `db_admin_audit`.
 */

const EMPTY_PAGE: DbRowPage = { rows: [], total: 0, limit: 50, offset: 0 };

export const DatabaseExplorerView: React.FC = () => {
  const { t, language, canPerformAction, syncNow, neonOnline, currentUser } = usePlatform();
  const isArabic = language === 'ar';

  const [catalog, setCatalog] = useState<DbCatalog>({ tables: [], schemas: [] });
  const [selected, setSelected] = useState<DbTable | undefined>();
  const [page, setPage] = useState<DbRowPage>(EMPTY_PAGE);
  const [tab, setTab] = useState<'data' | 'structure'>('data');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [identity, setIdentity] = useState<DbConnectionIdentity | null>(null);
  const [bypassRls, setBypassRls] = useState(false);
  const [dropConfirm, setDropConfirm] = useState('');
  const [dropOpen, setDropOpen] = useState(false);

  const canWrite = canPerformAction('database.write');
  const canDdl = canPerformAction('database.ddl');
  const canDrop = canPerformAction('database.drop');

  const notify = useCallback((type: 'ok' | 'err', text: string) => setNotice({ type, text }), []);

  const reloadCatalog = useCallback(async () => {
    setBusy(true);
    const loaded = await loadDatabaseCatalog();
    setCatalog(loaded);
    setBusy(false);
    if (loaded.error === 'no_database_connection') {
      notify('err', t('لا يوجد اتصال بقاعدة البيانات — اضبطه من شاشة Neon Hub.', 'No database connection — configure it from the Neon Hub.'));
    } else if (loaded.error) {
      notify('err', loaded.error);
    }
    return loaded;
  }, [t, notify]);

  const loadRows = useCallback(async (table: DbTable, offset = 0) => {
    setBusy(true);
    const result = await fetchTableRows({ schema: table.schema, table: table.name, offset, bypassRls });
    setPage(result);
    setBusy(false);
    if (result.error) notify('err', result.error);
  }, [notify, bypassRls]);

  useEffect(() => {
    void loadConnectionIdentity().then(setIdentity);
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded = await reloadCatalog();
      const first = loaded.tables.find((table) => table.kind === 'table') ?? loaded.tables[0];
      if (first) {
        setSelected(first);
        await loadRows(first);
      }
    })();
  }, [reloadCatalog, loadRows]);

  const select = async (table: DbTable) => {
    setSelected(table);
    setCreating(false);
    setDropOpen(false);
    setDropConfirm('');
    await loadRows(table);
  };

  const afterWrite = async () => {
    // مرآة مزدوجة: نحدّث الجدول ثم نعيد مزامنة بيانات التطبيق من الداتابيز
    if (selected) {
      await loadRows(selected, page.offset);
      const loaded = await reloadCatalog();
      const refreshed = loaded.tables.find((table) => `${table.schema}.${table.name}` === `${selected.schema}.${selected.name}`);
      if (refreshed) setSelected(refreshed);
    }
    const result = await syncNow();
    if (result.error) notify('err', result.error);
  };

  const selectedKey = selected ? `${selected.schema}.${selected.name}` : undefined;
  const protectedTable = useMemo(() => (selected ? isProtectedTable(selected.name) : false), [selected]);
  const expectedDropConfirm = selected
    ? protectedTable ? `DROP ${selected.name}` : `${selected.schema}.${selected.name}`
    : '';

  const confirmDrop = async () => {
    if (!selected) return;
    setBusy(true);
    const result = await dropTable({ schema: selected.schema, table: selected.name, confirm: dropConfirm });
    setBusy(false);
    if (!result.ok) {
      notify('err', result.message ?? 'drop_failed');
      return;
    }
    notify('ok', t('تم حذف الجدول.', 'Table dropped.'));
    setDropOpen(false);
    setDropConfirm('');
    setSelected(undefined);
    await reloadCatalog();
    await syncNow();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white">
              {t('إدارة قاعدة البيانات', 'Database explorer')}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t('مرآة حقيقية للجداول والصفوف — التعديل يطبَّق على الداتابيز ثم يُزامَن التطبيق', 'A true mirror of tables and rows — writes hit the DB then resync the app')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
          <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 ${neonOnline ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
            {neonOnline ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {neonOnline ? t('متصل', 'connected') : t('غير متصل', 'offline')}
          </span>
          <span className="rounded-xl bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {catalog.tables.length} {t('جدول', 'tables')}
          </span>
          <button
            type="button"
            onClick={() => void reloadCatalog()}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`inline h-3 w-3 ${busy ? 'animate-spin' : ''}`} /> {t('تحديث', 'Refresh')}
          </button>
          {selected && (
            <button
              type="button"
              onClick={() => setBypassRls((prev) => !prev)}
              disabled={!canDdl}
              title={t('عرض كل الصفوف بتجاوز RLS (يتطلب دوراً مالكاً أو BYPASSRLS)', 'Show all rows by bypassing RLS (owner or BYPASSRLS role)')}
              className={`rounded-xl px-2 py-1 ${bypassRls ? 'bg-rose-600 text-white' : 'border border-dashed border-rose-300 text-rose-600 dark:border-rose-800 dark:text-rose-300'}`}
            >
              {bypassRls ? t('إخفاء تجاوز RLS', 'Disable RLS bypass') : t('تجاوز RLS', 'Bypass RLS')}
            </button>
          )}
          {selected && canDrop && (
            <button
              type="button"
              onClick={() => setDropOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-3 w-3" /> {t('حذف الجدول', 'Drop table')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <span className="font-bold">{t('الاتصال:', 'Connection:')}</span>
        <span className="font-mono" dir="ltr">{identity ? `${identity.user} @ ${identity.database}${identity.host ? ` (${identity.host})` : ''}` : '—'}</span>
        {selected && (
          <span className={`rounded px-1.5 py-0.5 font-bold ${selected.rlsEnabled ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {selected.rlsEnabled ? t('RLS مفعّل', 'RLS enabled') : t('بلا RLS', 'no RLS')}
          </span>
        )}
        {selected && <span>{selected.columns.length} {t('عمود', 'columns')}</span>}
        {selected && selected.rlsEnabled && page.total < selected.estimatedRows && (
          <span className="font-bold text-amber-700 dark:text-amber-300">
            {t(`هذا الدور يرى ${page.total} من ~${selected.estimatedRows} صفاً — الباقي لمستأجرين/صلاحيات أخرى (RLS).`, `This role sees ${page.total} of ~${selected.estimatedRows} rows — the rest belong to other tenants/grants (RLS).`)}
          </span>
        )}
        {page.bypassed && <span className="font-bold text-rose-600 dark:text-rose-300">{t('مُعروض بتجاوز RLS', 'shown bypassing RLS')}</span>}
      </div>

      {notice && (
        <div className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-[11px] font-bold ${notice.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'}`}>
          {notice.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="leading-5">{notice.text}</span>
        </div>
      )}

      {dropOpen && selected && (
        <div className="space-y-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-800 dark:text-rose-200">
            <ShieldAlert className="h-4 w-4" /> {t(`حذف ${selected.schema}.${selected.name} نهائياً`, `Permanently drop ${selected.schema}.${selected.name}`)}
          </p>
          <p className="text-[10px] text-rose-700 dark:text-rose-300">
            {t(`اكتب بالضبط: ${expectedDropConfirm}`, `Type exactly: ${expectedDropConfirm}`)}
            {protectedTable && t(' — جدول حرج محمي بتأكيد إضافي.', ' — critical table, extra confirmation required.')}
          </p>
          <div className="flex gap-2">
            <input value={dropConfirm} onChange={(event) => setDropConfirm(event.target.value)} className="w-56 rounded-lg border border-rose-300 px-2 py-1 font-mono text-[11px]" />
            <button type="button" onClick={() => void confirmDrop()} disabled={busy || dropConfirm.trim() !== expectedDropConfirm} className="rounded-lg bg-rose-600 px-3 py-1 text-[10px] font-bold text-white disabled:opacity-40">
              {t('تأكيد الحذف', 'Confirm drop')}
            </button>
            <button type="button" onClick={() => setDropOpen(false)} className="rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[250px_1fr]">
        <TablesSidebar
          t={t}
          isArabic={isArabic}
          tables={catalog.tables}
          schemas={catalog.schemas}
          selectedKey={selectedKey}
          onSelect={(table) => void select(table)}
          onCreate={() => { setCreating(true); setTab('structure'); }}
          canDdl={canDdl}
          busy={busy}
        />

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {selected ? `${selected.schema}.${selected.name}` : t('اختر جدولاً', 'Select a table')}
            </span>
            <button type="button" onClick={() => { setTab('data'); setCreating(false); }} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${tab === 'data' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {t('البيانات', 'Data')}
            </button>
            <button type="button" onClick={() => setTab('structure')} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${tab === 'structure' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {t('البنية', 'Structure')}
            </button>
            <span className="ms-auto text-[9px] text-slate-400">{currentUser?.name}</span>
          </div>

          {tab === 'structure' ? (
            <TableStructure
              t={t}
              isArabic={isArabic}
              table={selected}
              schemas={catalog.schemas.length > 0 ? catalog.schemas : ['public']}
              creating={creating}
              canDdl={canDdl}
              notify={notify}
              onChanged={async () => { setCreating(false); await afterWrite(); }}
              onCancelCreate={() => setCreating(false)}
            />
          ) : selected ? (
            <TableGrid
              t={t}
              isArabic={isArabic}
              table={selected}
              page={page}
              busy={busy}
              canWrite={canWrite}
              canDelete={canWrite}
              notify={notify}
              reload={() => loadRows(selected, page.offset)}
              onPage={(offset) => void loadRows(selected, offset)}
              onCatalogChanged={async () => { await reloadCatalog(); const s = await syncNow(); if (s.error) notify('err', s.error); }}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[11px] text-slate-400 dark:border-slate-700">
              {t('اختر جدولاً من القائمة لعرض صفوفه.', 'Pick a table to browse its rows.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
