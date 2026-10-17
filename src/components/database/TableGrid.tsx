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
  onPage: (offset: number, limit?: number) => void;
  onCatalogChanged: () => void | Promise<void>;
  onSelectTable?: (tableName: string) => void;
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

export interface GridColumn {
  name: string;
  label: string;
  dataType: string;
  isPrimaryKey: boolean;
  isPayloadField?: boolean;
  payloadKey?: string;
}

export const TableGrid: React.FC<Props> = ({
  t, isArabic, table, page, busy, canWrite, canDelete, notify, reload, onPage, onCatalogChanged, onSelectTable,
}) => {
  const [editor, setEditor] = useState<{ mode: 'insert' | 'edit'; row?: Record<string, unknown> } | null>(null);
  const [cellModal, setCellModal] = useState<{ col: string; type: string; val: unknown } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [unpackPayload, setUnpackPayload] = useState(true);

  const hasPk = table.primaryKey.length > 0;
  const isView = table.kind === 'view';
  const isAll = page.limit === 0 || page.limit >= 50000;

  const hasPayload = useMemo(() => {
    return (
      (table.columns || []).some((c) => c.name === 'payload') ||
      page.rows.some((r) => r && typeof r === 'object' && 'payload' in r && r.payload && typeof r.payload === 'object')
    );
  }, [table.columns, page.rows]);

  // دمج كافة الأعمدة: أعمدة الكتالوج + أعمدة الداتابيز الحية + أي حقول في الصفوف + فك الـ payload
  const gridColumns = useMemo<GridColumn[]>(() => {
    const list: GridColumn[] = [];
    const seen = new Set<string>();

    const baseCols = page.columns && page.columns.length > 0 ? page.columns : table.columns || [];
    baseCols.forEach((c) => {
      seen.add(c.name);
      list.push({
        name: c.name,
        label: c.name,
        dataType: c.dataType,
        isPrimaryKey: c.isPrimaryKey,
      });
    });

    page.rows.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((k) => {
          if (!seen.has(k)) {
            seen.add(k);
            const val = (row as any)[k];
            list.push({
              name: k,
              label: k,
              dataType: typeof val === 'number' ? 'numeric' : typeof val === 'boolean' ? 'boolean' : typeof val === 'object' ? 'jsonb' : 'text',
              isPrimaryKey: k === 'id' || table.primaryKey.includes(k),
            });
          }
        });
      }
    });

    if (unpackPayload && hasPayload) {
      const payloadKeys = new Set<string>();
      page.rows.forEach((row) => {
        if (row && typeof row === 'object' && row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)) {
          Object.keys(row.payload as Record<string, unknown>).forEach((pk) => {
            if (!seen.has(pk)) {
              payloadKeys.add(pk);
            }
          });
        }
      });
      payloadKeys.forEach((pk) => {
        list.push({
          name: `payload.${pk}`,
          label: `${pk}`,
          dataType: 'json',
          isPrimaryKey: false,
          isPayloadField: true,
          payloadKey: pk,
        });
      });
    }

    return list;
  }, [table, page.columns, page.rows, unpackPayload, hasPayload]);

  const rawColumns = useMemo(
    () => gridColumns.filter((c) => !c.isPayloadField).map((c) => c.name),
    [gridColumns]
  );

  const getCellValue = (row: Record<string, unknown>, col: GridColumn): unknown => {
    if (col.isPayloadField && col.payloadKey) {
      const p = row.payload as Record<string, unknown> | undefined;
      return p ? p[col.payloadKey] : undefined;
    }
    return row[col.name];
  };

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return page.rows;
    const q = filterText.trim().toLowerCase();
    return page.rows.filter((row) => {
      return Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(q);
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [page.rows, filterText]);

  const save = async (values: Record<string, unknown>) => {
    if (!editor) return;
    setSaving(true);
    const result = editor.mode === 'insert'
      ? await insertRow({ schema: table.schema, table: table.name, values, columns: rawColumns })
      : await updateRow({
          schema: table.schema,
          table: table.name,
          values,
          columns: rawColumns,
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
      {/* تنبيه وشرح تفاعلي بين رؤوس القيود وسطورها */}
      {table.name === 'journal_entries' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/90 p-3 text-[11px] text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">
                {t('رؤوس القيود المحاسبية', 'Journal Vouchers')}
              </span>
              <span className="font-bold">
                {t(
                  `هذا الجدول يحتوي على رؤوس القيود المجمعة (${page.total} قيد).`,
                  `This table holds master journal voucher headers (${page.total} vouchers).`
                )}
              </span>
            </div>
            <p className="text-[10px] text-indigo-800 dark:text-indigo-300">
              {t(
                'كل قيد يحتوي على تفاصيل سطور المدين والدائن في حقل lines. إذا كنت تبحث عن سطور القيود المفردة (20 سطر بالمدين والدائن للحسابات)، اضغط الزر المجاور.',
                'Each entry holds debit/credit line items in the lines field. To view individual debit/credit rows, switch to v_journal_entry_lines.'
              )}
            </p>
          </div>
          {onSelectTable && (
            <button
              type="button"
              onClick={() => onSelectTable('v_journal_entry_lines')}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:bg-indigo-700"
            >
              {t('الانتقال إلى جدول سطور القيود (20 سطر)', 'Switch to Journal Lines (20 rows)')} →
            </button>
          )}
        </div>
      )}

      {table.name === 'v_journal_entry_lines' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-[11px] text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                {t('سطور القيود المفردة', 'Individual Journal Lines')}
              </span>
              <span className="font-bold">
                {t(
                  `يعرض هذا العرض جميع سطور القيود بالتفصيل (${page.total} سطر: مدين / دائن / حساب).`,
                  `This view displays every individual debit/credit line (${page.total} lines).`
                )}
              </span>
            </div>
            <p className="text-[10px] text-emerald-800 dark:text-emerald-300">
              {t('هنا تجد الـ 20 قيداً مفردة كما هي مسجلة في شجرة الحسابات.', 'Here you find the 20 individual entry lines matching the chart of accounts.')}
            </p>
          </div>
          {onSelectTable && (
            <button
              type="button"
              onClick={() => onSelectTable('journal_entries')}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:bg-emerald-700"
            >
              ← {t('الانتقال إلى جدول رؤوس القيود (10 قيود)', 'Switch to Journal Vouchers (10 rows)')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {isAll
              ? t(`كل الصفوف: ${filteredRows.length} من ${page.total}`, `All rows: ${filteredRows.length} of ${page.total}`)
              : t(
                  `الصفوف: ${filteredRows.length} من ${page.total} · الصفحة ${Math.floor(page.offset / Math.max(page.limit, 1)) + 1}`,
                  `Rows: ${filteredRows.length} of ${page.total} · page ${Math.floor(page.offset / Math.max(page.limit, 1)) + 1}`
                )}
            <span className="ms-2 font-mono text-[9px] text-slate-400">
              ({gridColumns.length} {t('عمود', 'columns')})
            </span>
            {!hasPk && <span className="ms-2 font-bold text-amber-600 dark:text-amber-400">{t('بلا مفتاح أساسي', 'No PK')}</span>}
          </p>

          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-400">{t('عرض:', 'Show:')}</span>
            <select
              value={isAll ? 0 : page.limit}
              onChange={(e) => onPage(0, Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={0}>{t('كل الصفوف', 'All rows')}</option>
            </select>
          </div>

          {hasPayload && (
            <label className="flex items-center gap-1 cursor-pointer select-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <input
                type="checkbox"
                checked={unpackPayload}
                onChange={(e) => setUnpackPayload(e.target.checked)}
                className="h-3 w-3 rounded text-indigo-600"
              />
              <span>{t('فك حقول JSON كأعمدة', 'Unpack JSON columns')}</span>
            </label>
          )}

          <div className="flex items-center rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t('تصفية الصفوف…', 'Filter rows…')}
              className="w-28 bg-transparent outline-none dark:text-slate-100"
            />
            {filterText && (
              <button type="button" onClick={() => setFilterText('')} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isAll && (
            <>
              <button
                type="button"
                onClick={() => onPage(Math.max(page.offset - page.limit, 0), page.limit)}
                disabled={page.offset === 0 || busy}
                className="rounded-lg border border-slate-200 p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onPage(page.offset + page.limit, page.limit)}
                disabled={page.offset + page.limit >= page.total || busy}
                className="rounded-lg border border-slate-200 p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
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

      {cellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
              <div>
                <p className="font-mono text-[12px] font-bold text-slate-800 dark:text-slate-100">{cellModal.col}</p>
                <p className="text-[10px] text-slate-400">{cellModal.type}</p>
              </div>
              <button
                type="button"
                onClick={() => setCellModal(null)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                ✕ {t('إغلاق', 'Close')}
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-3">
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-slate-700 dark:text-slate-200">
                {typeof cellModal.val === 'object' && cellModal.val !== null
                  ? JSON.stringify(cellModal.val, null, 2)
                  : String(cellModal.val ?? 'NULL')}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-[56vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-right">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              {gridColumns.map((column) => (
                <th key={column.name} className="whitespace-nowrap px-2 py-1.5 font-mono">
                  <span className="font-bold">{column.label}</span>
                  {column.isPrimaryKey && <span className="ms-1 text-amber-500" title="Primary Key">• PK</span>}
                  {column.isPayloadField ? (
                    <span className="ms-1 rounded bg-amber-100 px-1 py-0.2 text-[8px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">JSON</span>
                  ) : (
                    <span className="ms-1 text-[9px] font-normal text-slate-400">({column.dataType})</span>
                  )}
                </th>
              ))}
              <th className="px-2 py-1.5">{t('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={gridColumns.length + 1} className="px-3 py-8 text-center text-[11px] text-slate-400">
                  {t('لا توجد صفوف مطابقة.', 'No matching rows.')}
                </td>
              </tr>
            )}
            {filteredRows.map((row, index) => {
              const key = rowKey(table, row, index);
              return (
                <tr key={key} className="text-[10px] text-slate-700 hover:bg-slate-50/60 dark:text-slate-200 dark:hover:bg-slate-800/40">
                  {gridColumns.map((column) => {
                    const val = getCellValue(row, column);
                    const fullText = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? 'NULL');
                    return (
                      <td
                        key={column.name}
                        title={fullText}
                        onClick={() => setCellModal({ col: column.name, type: column.dataType, val })}
                        className="max-w-[220px] cursor-pointer truncate px-2 py-1 font-mono hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {cellText(val)}
                      </td>
                    );
                  })}
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
