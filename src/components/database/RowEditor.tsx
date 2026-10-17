/**
 * محرّر صف — إضافة/تعديل مباشر في الجدول
 * ---------------------------------------------------------------------------
 * يعرض حقول الأعمدة الفعلية، ويحوّل النص الفارغ إلى NULL للأعمدة التي تقبل NULL.
 * لا يبني SQL: يمرّر القيم للخدمة التي تتحقق من الأسماء والأنواع.
 */

import React, { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { DbColumn, DbTable } from '../../types/databaseExplorer';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  table: DbTable;
  mode: 'insert' | 'edit';
  initial?: Record<string, unknown>;
  busy?: boolean;
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => void;
}

const isNumericType = (type: string): boolean => /int|numeric|decimal|real|double/.test(type);
const isBooleanType = (type: string): boolean => /bool/.test(type);

const toInputValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const RowEditor: React.FC<Props> = ({ t, isArabic, table, mode, initial, busy, onCancel, onSave }) => {
  const editableColumns = useMemo<DbColumn[]>(() => {
    if (mode === 'insert') {
      return table.columns.filter((column) => !column.isIdentity);
    }
    return table.columns.filter((column) => !table.primaryKey.includes(column.name));
  }, [table, mode]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    editableColumns.forEach((column) => {
      seed[column.name] = toInputValue(initial?.[column.name]);
    });
    return seed;
  });

  const save = () => {
    const payload: Record<string, unknown> = {};
    editableColumns.forEach((column) => {
      const raw = values[column.name] ?? '';
      if (raw === '') {
        payload[column.name] = column.nullable ? null : '';
        return;
      }
      if (isBooleanType(column.dataType)) {
        payload[column.name] = raw === 'true' || raw === '1';
        return;
      }
      if (isNumericType(column.dataType)) {
        const parsed = Number(raw);
        payload[column.name] = Number.isFinite(parsed) ? parsed : raw;
        return;
      }
      payload[column.name] = raw;
    });
    onSave(payload);
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-3 dark:border-indigo-900/40 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
          {mode === 'insert' ? t('إضافة صف', 'Insert row') : t('تعديل صف', 'Edit row')}
          <span className="ms-2 font-mono text-[10px] text-slate-400">{table.schema}.{table.name}</span>
        </p>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <X className="inline h-3 w-3" /> {t('إلغاء', 'Cancel')}
        </button>
      </div>

      {mode === 'edit' && table.primaryKey.length > 0 && (
        <p className="mt-1 font-mono text-[9px] text-slate-400">
          PK: {table.primaryKey.map((column) => `${column}=${toInputValue(initial?.[column])}`).join(' · ')}
        </p>
      )}

      <div className="mt-2 grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {editableColumns.map((column) => (
          <label key={column.name} className="min-w-0">
            <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300">
              <span className="truncate font-mono">{column.name}</span>
              <span className="shrink-0 text-[9px] font-normal text-slate-400">{column.dataType}</span>
              {!column.nullable && <span className="text-rose-500">*</span>}
            </span>
            {isBooleanType(column.dataType) ? (
              <select
                value={values[column.name] ?? ''}
                onChange={(event) => setValues((prev) => ({ ...prev, [column.name]: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('NULL', 'NULL')}</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                value={values[column.name] ?? ''}
                onChange={(event) => setValues((prev) => ({ ...prev, [column.name]: event.target.value }))}
                placeholder={column.nullable ? t('اتركه فارغاً = NULL', 'empty = NULL') : ''}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[9px] leading-4 text-slate-500 dark:text-slate-400">
          {isArabic ? 'الصفوف الفارغة في أعمدة NULL تُحفظ كـ NULL.' : 'Empty nullable fields are stored as NULL.'}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ', 'Save')}
        </button>
      </div>
    </div>
  );
};
