/**
 * فلتر متعدد الاختيار — مستخرج من PartiesView
 */

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export const MultiSelectFilter: React.FC<{
  label: string;
  selectAllLabel: string;
  clearLabel: string;
  emptyLabel: string;
  searchLabel: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
}> = ({ label, selectAllLabel, clearLabel, emptyLabel, searchLabel, options, selected, onChange }) => {
  const [search, setSearch] = useState('');
  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? options.filter((option) => option.label.toLocaleLowerCase().includes(query) || option.value.toLocaleLowerCase().includes(query)) : options;
  }, [options, search]);
  const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every((option) => selected.includes(option.value));

  return (
    <details className="relative min-w-0 text-xs">
      <summary className="cursor-pointer list-none truncate rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
        {label} ({selected.length || '—'})
      </summary>
      <div className="absolute z-20 mt-1 max-h-72 min-w-full overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 bg-white pb-1 dark:bg-slate-900">
          <div className="relative">
            <Search className="absolute start-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchLabel} className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 ps-7 pe-2 dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <button type="button" disabled={visibleOptions.length === 0} onClick={() => {
            const visibleValues = new Set(visibleOptions.map((option) => option.value));
            onChange(allVisibleSelected ? selected.filter((value) => !visibleValues.has(value)) : [...new Set([...selected, ...visibleValues])]);
          }} className="mt-1 w-full rounded px-2 py-1 text-start font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
            {allVisibleSelected ? clearLabel : selectAllLabel} ({visibleOptions.length})
          </button>
        </div>
        {visibleOptions.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} />
            <span>{option.label}</span>
          </label>
        ))}
        {visibleOptions.length === 0 && <p className="px-2 py-2 text-slate-500">{emptyLabel}</p>}
      </div>
    </details>
  );
};
