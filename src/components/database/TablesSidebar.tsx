/**
 * قائمة جداول قاعدة البيانات (مرآة البنية)
 */

import React, { useMemo, useState } from 'react';
import { Search, Table2, Plus } from 'lucide-react';
import type { DbTable } from '../../types/databaseExplorer';

interface Props {
  t: (ar: string, en: string) => string;
  isArabic: boolean;
  tables: DbTable[];
  schemas: string[];
  selectedKey?: string;
  onSelect: (table: DbTable) => void;
  onCreate: () => void;
  canDdl: boolean;
  busy?: boolean;
}

export const TablesSidebar: React.FC<Props> = ({
  t, isArabic, tables, schemas, selectedKey, onSelect, onCreate, canDdl, busy,
}) => {
  const [schema, setSchema] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tables.filter((table) => {
      if (schema !== 'all' && table.schema !== schema) return false;
      if (!term) return true;
      return `${table.schema}.${table.name}`.toLowerCase().includes(term);
    });
  }, [tables, schema, search]);

  return (
    <div className="flex max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-2 border-b border-slate-100 p-2 dark:border-slate-800">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('بحث في الجداول…', 'Search tables…')}
            className="w-full bg-transparent py-1.5 text-[11px] outline-none dark:text-slate-100"
          />
        </div>
        <div className="flex gap-1">
          <select
            value={schema}
            onChange={(event) => setSchema(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">{t('كل المخططات', 'All schemas')}</option>
            {schemas.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCreate}
            disabled={!canDdl}
            title={t('إنشاء جدول جديد', 'Create a new table')}
            className="rounded-lg bg-indigo-600 px-2 text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-auto p-1.5">
        {busy && <p className="p-2 text-center text-[10px] text-slate-400">{t('جارٍ التحميل…', 'Loading…')}</p>}
        {!busy && filtered.length === 0 && (
          <p className="p-2 text-center text-[10px] text-slate-400">{t('لا جداول مطابقة.', 'No matching tables.')}</p>
        )}
        {filtered.map((table) => {
          const key = `${table.schema}.${table.name}`;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(table)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right transition-colors ${
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Table2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[10px] font-bold">{table.name}</span>
                  <span className={`block text-[9px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {table.schema} · {table.kind === 'view' ? t('عرض', 'view') : t('جدول', 'table')}
                  </span>
                </span>
              </span>
              <span className={`shrink-0 rounded px-1 text-[9px] font-bold ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                ≈ {table.estimatedRows}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
