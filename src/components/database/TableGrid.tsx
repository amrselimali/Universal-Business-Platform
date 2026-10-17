/**
 * شبكة صفوف جدول — عرض/تعديل/حذف مباشر
 * ---------------------------------------------------------------------------
 * التعديل والحذف يتطلبان مفتاحاً أساسياً (وإلا يُعطَّلان لمنع كتابة عشوائية).
 * الحذف بخطوتين (تأكيد) ويتحقق من عدد الصفوف المتأثرة.
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { fetchTableRows } from '../../services/databaseExplorerApi';
import { deleteRow, insertRow, updateRow } from '../../services/databaseRowsApi';
import type { DbRowPage, DbTable } from '../../types/databaseExplorer';
import { RowEditor } from './RowEditor';
import { GridTable } from './GridTable';
import { JournalVoucherBanners } from './JournalVoucherBanners';
import { GridToolbar } from './GridToolbar';

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
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 400);
  return String(value).slice(0, 300);
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
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [unpackPayload, setUnpackPayload] = useState(true);

  const hasPk = table.primaryKey.length > 0;
  const isView = table.kind === 'view';
  const isAll = page.limit === 0;

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
      <JournalVoucherBanners t={t} tableName={table.name} total={page.total} onSelectTable={onSelectTable} />

      <GridToolbar
        t={t}
        page={page}
        isAll={isAll}
        filteredCount={filteredRows.length}
        columnCount={gridColumns.length}
        hasPk={hasPk}
        hasPayload={hasPayload}
        unpackPayload={unpackPayload}
        filterText={filterText}
        busy={busy}
        canWrite={canWrite}
        isView={isView}
        onUnpackChange={setUnpackPayload}
        onFilterChange={setFilterText}
        onPage={onPage}
        onNewRow={() => setEditor({ mode: 'insert' })}
      />

      {page.truncated && (
        <p className="rounded-xl bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('عُرض أول 5000 صف فقط — استخدم التصفية أو اختر حجماً أصغر لرؤية الباقي.', 'Showing the first 5000 rows only — use the filter or a smaller page size.')}
        </p>
      )}

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

      <GridTable
        t={t}
        table={table}
        gridColumns={gridColumns}
        rows={filteredRows}
        getCellValue={getCellValue}
        cellText={cellText}
        canWrite={canWrite}
        canDelete={canDelete}
        hasPk={hasPk}
        isView={isView}
        confirmKey={confirmKey}
        saving={saving}
        onEdit={(row) => setEditor({ mode: 'edit', row })}
        onDelete={(row) => void remove(row)}
        onConfirm={setConfirmKey}
        rowKey={(row, index) => rowKey(table, row, index)}
      />
    </div>
  );
};
