/**
 * جدول عرض الصفوف — يُعرض كمرآة للجدول الحقيقي
 * ---------------------------------------------------------------------------
 * فُصل من `TableGrid.tsx` التزاماً بحد 300 سطر: عرض الخلايا + نافذة فحص القيمة
 * (JSON كامل) + أزرار التعديل/الحذف. لا منطق بيانات هنا.
 */

import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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

  return (
    <>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={gridColumns.length + 1} className="px-3 py-8 text-center text-[11px] text-slate-400">
                  {t('لا توجد صفوف مطابقة.', 'No matching rows.')}
                </td>
              </tr>
            )}
            {rows.map((row, index) => {
              const key = rowKey(row, index);
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
                          {t('تأكيد الحذف', 'Confirm delete')}
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};
