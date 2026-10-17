/**
 * بنية الجدول — الأعمدة وإضافة/حذف عمود وإنشاء جدول جديد
 */

import React, { useState } from 'react';
import { AlertTriangle, KeyRound, Plus, Trash2 } from 'lucide-react';
import { addColumn, createTable, dropColumn } from '../../services/databaseSchemaApi';
import type { DbColumnDraft, DbColumnType, DbTable } from '../../types/databaseExplorer';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  table?: DbTable;
  schemas: string[];
  creating: boolean;
  canDdl: boolean;
  notify: (type: 'ok' | 'err', text: string) => void;
  onChanged: () => void | Promise<void>;
  onCancelCreate: () => void;
}

const TYPES: DbColumnType[] = ['text', 'varchar', 'integer', 'bigint', 'numeric', 'boolean', 'date', 'timestamptz', 'uuid', 'jsonb'];
const input = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

const emptyDraft = (primaryKey = false): DbColumnDraft => ({ name: '', type: 'text', nullable: !primaryKey, primaryKey });

export const TableStructure: React.FC<Props> = ({
  t, isArabic, table, schemas, creating, canDdl, notify, onChanged, onCancelCreate,
}) => {
  const [schema, setSchema] = useState(table?.schema ?? schemas[0] ?? 'public');
  const [newTable, setNewTable] = useState('');
  const [drafts, setDrafts] = useState<DbColumnDraft[]>([
    { name: 'id', type: 'text', nullable: false, primaryKey: true },
    emptyDraft(),
  ]);
  const [column, setColumn] = useState<DbColumnDraft>(emptyDraft());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      notify('err', result.message ?? 'failed');
      return;
    }
    notify('ok', okText);
    await onChanged();
  };

  if (creating) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{t('إنشاء جدول جديد', 'Create a table')}</p>
          <button type="button" onClick={onCancelCreate} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {t('إلغاء', 'Cancel')}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label>
            <span className="mb-0.5 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('المخطط', 'Schema')}</span>
            <select value={schema} onChange={(event) => setSchema(event.target.value)} className={input}>
              {schemas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-0.5 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('اسم الجدول (لاتيني)', 'Table name (latin)')}</span>
            <input value={newTable} onChange={(event) => setNewTable(event.target.value)} placeholder="inventory_notes" className={`${input} font-mono`} />
          </label>
        </div>

        <div className="space-y-1">
          {drafts.map((draft, index) => (
            <div key={index} className="grid items-end gap-1 sm:grid-cols-[1.2fr_0.9fr_0.5fr_0.5fr_auto]">
              <input value={draft.name} onChange={(event) => setDrafts((prev) => prev.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder={t('اسم العمود', 'column')} className={`${input} font-mono`} />
              <select value={draft.type} onChange={(event) => setDrafts((prev) => prev.map((item, i) => i === index ? { ...item, type: event.target.value as DbColumnType } : item))} className={input}>
                {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              {draft.type === 'varchar' ? (
                <input type="number" value={draft.length ?? ''} onChange={(event) => setDrafts((prev) => prev.map((item, i) => i === index ? { ...item, length: Number(event.target.value) || undefined } : item))} placeholder="255" className={input} />
              ) : <span className="text-[9px] text-slate-400">—</span>}
              <label className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                <input type="checkbox" checked={draft.nullable} onChange={(event) => setDrafts((prev) => prev.map((item, i) => i === index ? { ...item, nullable: event.target.checked } : item))} className="h-3 w-3" />
                NULL
              </label>
              <button type="button" onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))} className="rounded p-1 text-rose-500">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setDrafts((prev) => [...prev, emptyDraft()])} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <Plus className="h-3 w-3" /> {t('عمود', 'Column')}
          </button>
          <button
            type="button"
            disabled={!canDdl || busy || !newTable}
            onClick={() => void run(() => createTable({ schema, table: newTable, columns: drafts.filter((draft) => draft.name.trim()) }), t('تم إنشاء الجدول.', 'Table created.'))}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? t('جارٍ الإنشاء…', 'Creating…') : t('إنشاء الجدول', 'Create table')}
          </button>
        </div>
      </div>
    );
  }

  if (!table) return null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-right text-[10px]">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-2 py-1.5">{t('العمود', 'Column')}</th>
              <th className="px-2 py-1.5">{t('النوع', 'Type')}</th>
              <th className="px-2 py-1.5">{t('NULL', 'NULL')}</th>
              <th className="px-2 py-1.5">{t('افتراضي', 'Default')}</th>
              <th className="px-2 py-1.5">{t('حذف', 'Drop')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.columns.map((item) => (
              <tr key={item.name} className="text-slate-700 dark:text-slate-200">
                <td className="px-2 py-1 font-mono font-bold">
                  {item.name}
                  {item.isPrimaryKey && <KeyRound className="ms-1 inline h-3 w-3 text-amber-500" />}
                  {item.isIdentity && <span className="ms-1 text-[9px] text-slate-400">identity</span>}
                </td>
                <td className="px-2 py-1 font-mono">{item.dataType}{item.maxLength ? `(${item.maxLength})` : ''}</td>
                <td className="px-2 py-1">{item.nullable ? 'YES' : 'NO'}</td>
                <td className="px-2 py-1 font-mono text-[9px] text-slate-400">{item.defaultValue ?? '—'}</td>
                <td className="px-2 py-1">
                  {dropTarget === item.name ? (
                    <div className="flex items-center gap-1">
                      <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={`${table.name}.${item.name}`} className="w-32 rounded border border-rose-300 px-1 py-0.5 font-mono text-[9px]" />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => dropColumn({ schema: table.schema, table: table.name, column: item.name, confirm: confirmText }), t('تم حذف العمود.', 'Column dropped.'))}
                        className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white"
                      >
                        {t('تأكيد', 'Confirm')}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setDropTarget(item.name); setConfirmText(''); }} disabled={!canDdl} className="rounded p-1 text-rose-500 disabled:opacity-30">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-1 flex items-center gap-1 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
          <Plus className="h-3.5 w-3.5" /> {t('إضافة عمود', 'Add column')}
        </p>
        <div className="grid items-end gap-1 sm:grid-cols-[1.2fr_0.9fr_0.5fr_0.5fr_auto]">
          <input value={column.name} onChange={(event) => setColumn((prev) => ({ ...prev, name: event.target.value }))} placeholder={t('اسم العمود', 'column')} className={`${input} font-mono`} />
          <select value={column.type} onChange={(event) => setColumn((prev) => ({ ...prev, type: event.target.value as DbColumnType }))} className={input}>
            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          {column.type === 'varchar' ? (
            <input type="number" value={column.length ?? ''} onChange={(event) => setColumn((prev) => ({ ...prev, length: Number(event.target.value) || undefined }))} placeholder="255" className={input} />
          ) : <span className="text-[9px] text-slate-400">—</span>}
          <label className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={column.nullable} onChange={(event) => setColumn((prev) => ({ ...prev, nullable: event.target.checked }))} className="h-3 w-3" />
            NULL
          </label>
          <button
            type="button"
            disabled={!canDdl || busy || !column.name}
            onClick={() => void run(() => addColumn({ schema: table.schema, table: table.name, column }), t('تمت إضافة العمود.', 'Column added.'))}
            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {t('إضافة', 'Add')}
          </button>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" /> {t('عمليات البنية تُسجَّل في db_admin_audit وتؤثر على قاعدة البيانات مباشرة.', 'DDL is audited and applies to the database immediately.')}
        </p>
      </div>
    </div>
  );
};
