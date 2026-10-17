/**
 * جدول عرض صفوف قاعدة البيانات — يعتمد على الجدول الموحّد بنوافذ افتراضية
 * ---------------------------------------------------------------------------
 * لا يوجد هنا تنفيذ جدول خاص: نستخدم `WindowedTable` المشترك (يرسم الصفوف
 * الظاهرة فقط) لتسريع الجداول الكبيرة، مع فحص الخلية وتعديل/حذف الصف.
 */

import React, { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { WindowedTable, type WindowColumn } from '../data/WindowedTable';
import type { DbTable } from '../../types/databaseExplorer';
import type { GridColumn } from './TableGrid';

interface Props {
  t: (ar: string, en: string) => string;
  table: DbTable;
  gridColumns: GridColumn[];
  rows: Record<string, unknown>[];
  getCellValue: (row: Record<string, unknown>, column: GridColumn) => unknown;
  cellText: (value: unknown) => string;
  canWrite: boolean;
  canDelete: boolean;
  hasPk: boolean;
  isView: boolean;
  confirmKey: string | null;
  saving: boolean;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  onConfirm: (key: string) => void;
  rowKey: (row: Record<string, unknown>, index: number) => string;
}

export const GridTable: React.FC<Props> = ({
  t, gridColumns, rows, getCellValue, cellText, canWrite, canDelete, hasPk, isView,
  confirmKey, saving, onEdit, onDelete, onConfirm, rowKey,
}) => {
  const [cellModal, setCellModal] = useState<{ col: string; type: string; val: unknown } | null>(null);

  const columns = useMemo<WindowColumn<Record<string, unknown>>[]>(() => {
    const dataColumns: WindowColumn<Record<string, unknown>>[] = gridColumns.map((column) => ({
      key: column.name,
      label: `${column.label}${column.isPayloadField ? ' · JSON' : ''}`,
      width: '1fr',
      render: (row) => {
        const value = getCellValue(row, column);
        const fullText = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? 'NULL');
        return (
          <button
            type="button"
            title={fullText}
            onClick={() => setCellModal({ col: column.name, type: column.dataType, val: value })}
            className="w-full truncate text-start font-mono hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {cellText(value)}
          </button>
        );
      },
    }));

    dataColumns.push({
      key: '__actions',
      label: t('إجراءات', 'Actions'),
      width: '96px',
      render: (row, index) => {
        const key = rowKey(row, index);
        return (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(row)}
              disabled={!canWrite || !hasPk || isView}
              className="rounded border border-slate-200 p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
              title={t('تعديل الصف', 'Edit row')}
            >
              <Pencil className="h-3 w-3" />
            </button>
            {confirmKey === key ? (
              <button
                type="button"
                onClick={() => onDelete(row)}
                disabled={saving}
                className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white"
              >
                {t('تأكيد', 'Confirm')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onConfirm(key)}
                disabled={!canDelete || !hasPk || isView}
                className="rounded border border-slate-200 p-1 text-rose-500 disabled:opacity-30 dark:border-slate-700"
                title={t('حذف الصف', 'Delete row')}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      },
    });

    return dataColumns;
  }, [gridColumns, getCellValue, cellText, canWrite, canDelete, hasPk, isView, confirmKey, saving, onEdit, onDelete, onConfirm, rowKey, t]);

  return (
    <>
      <WindowedTable
        t={t}
        columns={columns}
        rows={rows}
        height={420}
        rowHeight={34}
        emptyLabel={t('لا توجد صفوف مطابقة.', 'No matching rows.')}
      />

      {cellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
              <div>
                <p className="font-mono text-[12px] font-bold text-slate-800 dark:text-slate-100">{cellModal.col}</p>
                <p className="text-[10px] text-slate-400">{cellModal.type}</p>
              </div>
              <button type="button" onClick={() => setCellModal(null)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                ✕ {t('إغلاق', 'Close')}
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-3">
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-slate-700 dark:text-slate-200">
                {typeof cellModal.val === 'object' && cellModal.val !== null ? JSON.stringify(cellModal.val, null, 2) : String(cellModal.val ?? 'NULL')}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
