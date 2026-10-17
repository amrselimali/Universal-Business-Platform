/**
 * جدول بنوافذ افتراضية (Windowed Table) — لعرض آلاف الصفوف بسلاسة
 * ---------------------------------------------------------------------------
 * لا يرسم إلا الصفوف الظاهرة داخل نافذة التمرير (+هامش)، ويحفظ ارتفاع القائمة
 * كاملاً بفواصل علوية/سفلية. مناسب لهذا التطبيق لأنه لا يضيف مكتبة خارجية.
 */

import React, { useMemo, useRef, useState } from 'react';

export interface WindowColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'start' | 'end';
  mono?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  t: (ar: string, en: string) => string;
  columns: WindowColumn<T>[];
  rows: T[];
  rowHeight?: number;
  height?: number;
  loading?: boolean;
  emptyLabel?: string;
  onEndReached?: () => void;
}

export function WindowedTable<T>({
  t, columns, rows, rowHeight = 38, height = 460, loading, emptyLabel, onEndReached,
}: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const lastEndRef = useRef(0);
  const overscan = 8;
  const visibleCount = Math.ceil(height / rowHeight);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rows.length, start + visibleCount + overscan * 2);
  const slice = useMemo(() => rows.slice(start, end), [rows, start, end]);
  const gridTemplate = columns.map((column) => column.width ?? '1fr').join(' ');

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    setScrollTop(element.scrollTop);
    lastEndRef.current = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (onEndReached && lastEndRef.current < rowHeight * 4) onEndReached();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div
        className="grid items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((column) => (
          <span key={column.key} className={column.align === 'end' ? 'text-end' : 'text-start'}>
            {column.label}
          </span>
        ))}
      </div>

      <div className="overflow-auto" style={{ height }} onScroll={handleScroll}>
        {rows.length === 0 && !loading && (
          <p className="py-10 text-center text-[11px] text-slate-400">{emptyLabel ?? t('لا بيانات.', 'No data.')}</p>
        )}

        <div style={{ height: start * rowHeight }} />
        {slice.map((row, index) => (
          <div
            key={(row as { id?: string }).id ?? `${start + index}`}
            className="grid items-center gap-2 border-b border-slate-100 px-3 text-[10px] text-slate-700 dark:border-slate-800 dark:text-slate-200"
            style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
          >
            {columns.map((column) => (
              <span
                key={column.key}
                className={`truncate ${column.align === 'end' ? 'text-end' : 'text-start'} ${column.mono ? 'font-mono' : ''}`}
                title={column.render ? undefined : String((row as Record<string, unknown>)[column.key] ?? '')}
              >
                {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '—')}
              </span>
            ))}
          </div>
        ))}
        <div style={{ height: Math.max(0, (rows.length - end) * rowHeight) }} />

        {loading && (
          <p className="py-3 text-center text-[10px] font-bold text-slate-400">{t('جارٍ التحميل…', 'Loading…')}</p>
        )}
      </div>
    </div>
  );
}
