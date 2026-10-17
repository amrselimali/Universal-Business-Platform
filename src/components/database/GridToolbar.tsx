/**
 * شريط أدوات شبكة البيانات (عدد الصفوف · حجم الصفحة · فك JSON · التصفية · التنقل)
 * ---------------------------------------------------------------------------
 * فُصل من TableGrid التزاماً بحد 300 سطر. عرض فقط + أحداث للأب.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { DbRowPage } from '../../types/databaseExplorer';

interface Props {
  t: (ar: string, en: string) => string;
  page: DbRowPage;
  isAll: boolean;
  filteredCount: number;
  columnCount: number;
  hasPk: boolean;
  hasPayload: boolean;
  unpackPayload: boolean;
  filterText: string;
  busy: boolean;
  canWrite: boolean;
  isView: boolean;
  onUnpackChange: (value: boolean) => void;
  onFilterChange: (value: string) => void;
  onPage: (offset: number, limit?: number) => void;
  onNewRow: () => void;
}

export const GridToolbar: React.FC<Props> = ({
  t, page, isAll, filteredCount, columnCount, hasPk, hasPayload, unpackPayload, filterText,
  busy, canWrite, isView, onUnpackChange, onFilterChange, onPage, onNewRow,
}) => (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {isAll
              ? t(`كل الصفوف: ${filteredCount} من ${page.total}`, `All rows: ${filteredCount} of ${page.total}`)
              : t(
                  `الصفوف: ${filteredCount} من ${page.total} · الصفحة ${Math.floor(page.offset / Math.max(page.limit, 1)) + 1}`,
                  `Rows: ${filteredCount} of ${page.total} · page ${Math.floor(page.offset / Math.max(page.limit, 1)) + 1}`
                )}
            <span className="ms-2 font-mono text-[9px] text-slate-400">
              ({columnCount} {t('عمود', 'columns')})
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
                onChange={(e) => onUnpackChange(e.target.checked)}
                className="h-3 w-3 rounded text-indigo-600"
              />
              <span>{t('فك حقول JSON كأعمدة', 'Unpack JSON columns')}</span>
            </label>
          )}

          <div className="flex items-center rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
            <input
              type="text"
              value={filterText}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={t('تصفية الصفوف…', 'Filter rows…')}
              className="w-28 bg-transparent outline-none dark:text-slate-100"
            />
            {filterText && (
              <button type="button" onClick={() => onFilterChange('')} className="text-slate-400 hover:text-slate-600">
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
            onClick={onNewRow}
            disabled={!canWrite || isView}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> {t('صف جديد', 'New row')}
          </button>
        </div>
      </div>
);
