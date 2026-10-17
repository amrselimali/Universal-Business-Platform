/**
 * شبكة صفوف جدول — عرض/تعديل/حذف مباشر
 * ---------------------------------------------------------------------------
 * التعديل والحذف يتطلبان مفتاحاً أساسياً (وإلا يُعطَّلان لمنع كتابة عشوائية).
 * الحذف بخطوتين (تأكيد) ويتحقق من عدد الصفوف المتأثرة.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteRow, fetchTableRows, insertRow, updateRow } from '../../services/databaseExplorerApi';
import type { DbRowPage, DbTable } from '../../types/databaseExplorer';
import { RowEditor } from './RowEditor';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  table: DbTable;
  page: DbRowPage;
  busy: boolean;
  canWrite: boolean;
  canDelete: boolean;
  notify: (type: 'ok' | 'err', text: string) => void;
  reload: () => void | Promise<void>;
  onPage: (offset: number) => void;
  onCatalogChanged: () => void | Promise<void>;
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 120);
};

const pkOf = (table: DbTable, row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(table.primaryKey.map((column) => [column, row[column]]));

const rowKey = (table: DbTable, row: Record<string, unknown>, index: number): string => {
  if (table.primaryKey.length === 0) return `row-${index}`;
  return table.primaryKey.map((column) => String(row[column])).join('|');
};

export const TableGrid: React.FC<Props> = ({
  t, isArabic, table, page, busy, canWrite, canDelete, notify, reload, onPage, onCatalogChanged,
}) => {
  const [editor, setEditor] = useState<{ mode: 'insert' | 'edit'; row?: Record<string, unknown> } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasPk = table.primaryKey.length > 0;
  const isView = table.kind === 'view';
  const columns = useMemo(() => table.columns, [table]);

  const save = async (values: Record<string, unknown>) => {
    if (!editor) return;
    setSaving(true);
    const result = editor.mode === 'insert'
      ? await insertRow({ schema: table.schema, table: table.name, values, columns: columns.map((column) => column.name) })
      : await updateRow({
          schema: table.schema,
          table: table.name,
          values,
          columns: columns.map((column) => column.name),
          pk: pkOf(table, editor.row ?? {}),
        });
    setSaving(false);

    if (!result.ok) {
      notify('err', result.message ?? 'failed');
      return;
    }
    notify('ok', editor.mode === 'insert' ? t('تمت إضافة الصف.', 'Row inserted.') : t('تم تعديل الصف.', 'Row updated.'));
    setEditor(null);
    await reload();
    await onCatalogChanged();
  };

  const remove = async (row: Record<string, unknown>) => {
    setSaving(true);
    const result = await deleteRow({ schema: table.schema, table: table.name, pk: pkOf(table, row) });
    setSaving(false);
    if (!result.ok) {
      notify('err', result.message ?? 'delete_failed');
      return;
    }
    notify('ok', t('تم حذف الصف.', 'Row deleted.'));
    setConfirmKey(null);
    await reload();
    await onCatalogChanged();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {t(
            `الصفوف: ${page.rows.length} من ${page.total} · الصفحة ${Math.floor(page.offset / Math.max(page.limit, 1)) + 1}`,
            `Rows: ${page.rows.length} of ${page.total} · page ${Math.floor(page.offset / Math.max(page.limit, 1)) + 1}`
          )}
          {!hasPk && <span className="ms-2 font-bold text-amber-600 dark:text-amber-400">{t('بلا مفتاح أساسي: التعديل/الحذف معطّل', 'No primary key: edit/delete disabled')}</span>}
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(Math.max(page.offset - page.limit, 0))}
            disabled={page.offset === 0 || busy}
            className="rounded-lg border border-slate-200 p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPage(page.offset + page.limit)}
            disabled={page.offset + page.limit >= page.total || busy}
            className="rounded-lg border border-slate-200 p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditor({ mode: 'insert' })}
            disabled={!canWrite || isView}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> {t('صف جديد', 'New row')}
          </button>
        </div>
      </div>

      {page.error && (
        <p className="flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="h-3 w-3" /> {page.error}
        </p>
      )}

      {editor && (
        <RowEditor
          t={t}
          isArabic={isArabic}
          table={table}
          mode={editor.mode}
          initial={editor.row}
          busy={saving}
          onCancel={() => setEditor(null)}
          onSave={(values) => void save(values)}
        />
      )}

      <div className="max-h-[52vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-right">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {columns.map((column) => (
                <th key={column.name} className="whitespace-nowrap px-2 py-1.5 font-mono">
                  {column.name}
                  {column.isPrimaryKey && <span className="ms-0.5 text-amber-500">•</span>}
                </th>
              ))}
              <th className="px-2 py-1.5">{t('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {page.rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-[11px] text-slate-400">
                  {t('لا صفوف.', 'No rows.')}
                </td>
              </tr>
            )}
            {page.rows.map((row, index) => {
              const key = rowKey(table, row, index);
              return (
                <tr key={key} className="text-[10px] text-slate-700 dark:text-slate-200">
                  {columns.map((column) => (
                    <td key={column.name} className="max-w-[220px] truncate px-2 py-1 font-mono">
                      {cellText(row[column.name])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditor({ mode: 'edit', row })}
                        disabled={!canWrite || !hasPk || isView}
                        className="rounded border border-slate-200 p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
                        title={t('تعديل الصف', 'Edit row')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {confirmKey === key ? (
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          disabled={saving}
                          className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white"
                        >
                          {t('تأكيد الحذف', 'Confirm delete')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmKey(key)}
                          disabled={!canDelete || !hasPk || isView}
                          className="rounded border border-slate-200 p-1 text-rose-500 disabled:opacity-30 dark:border-slate-700"
                          title={t('حذف الصف', 'Delete row')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
