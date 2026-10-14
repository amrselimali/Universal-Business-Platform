import React, { useMemo, useState } from 'react';
import { Search, Table2, AlertCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { PaginationControls } from '../components/PaginationControls';
import {
  getEntity,
  getGridColumns,
  getMetadataRegistry,
  type MetadataField,
} from '../services/metadataRegistry';

/**
 * الشاشة العامة (Dynamic Screen)
 * ---------------------------------------------------------------------------
 * تُولّد جدولاً كاملاً من تعريف الكيان في الـ Metadata — بلا كود مكتوب يدوياً
 * لكل حقل. إضافة حقل جديد = صف واحد في `erp_entity_fields` ويظهر فوراً هنا.
 *
 * هذا هو الفرق العملي بين «شاشة مكتوبة» و«شاشة موصوفة».
 */

interface DynamicScreenViewProps {
  /** رمز الكيان في الـ Metadata، مثال: parties أو products. */
  entityCode: string;
}

/** ربط رمز الكيان بمصدر بياناته في الـ PlatformContext. */
const resolveRows = (
  entityCode: string,
  ctx: ReturnType<typeof usePlatform>
): Record<string, unknown>[] => {
  const map: Record<string, Record<string, unknown>[]> = {
    parties: ctx.parties as unknown as Record<string, unknown>[],
    products: ctx.products as unknown as Record<string, unknown>[],
    branches: ctx.branches as unknown as Record<string, unknown>[],
    warehouses: ctx.warehouses as unknown as Record<string, unknown>[],
    payment_methods: ctx.paymentMethods as unknown as Record<string, unknown>[],
    accounts: ctx.accounts as unknown as Record<string, unknown>[],
    categories: ctx.categories as unknown as Record<string, unknown>[],
    staff_members: ctx.staffMembers as unknown as Record<string, unknown>[],
  };
  return map[entityCode] ?? [];
};

/** يُنسّق القيمة للعرض حسب نوعها المُعلَن في الـ Metadata. */
const formatCell = (
  value: unknown,
  field: MetadataField,
  formatMoney: (amount: number) => string
): React.ReactNode => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }

  switch (field.dataType) {
    case 'currency':
      return (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
          {formatMoney(Number(value) || 0)}
        </span>
      );
    case 'number':
      return <span className="font-mono">{String(value)}</span>;
    case 'boolean':
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            value
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {value ? 'نعم' : 'لا'}
        </span>
      );
    case 'badge':
      return (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
          {String(value)}
        </span>
      );
    default:
      return <span>{String(value)}</span>;
  }
};

export const DynamicScreenView: React.FC<DynamicScreenViewProps> = ({ entityCode }) => {
  const ctx = usePlatform();
  const { t, language, formatMoney } = ctx;

  const registry = getMetadataRegistry();
  const entity = getEntity(entityCode);
  const columns = useMemo(
    () => getGridColumns(entityCode),
    // نعيد الحساب عند تغيّر الكيان أو تحديث الـ Metadata من قاعدة البيانات
    [entityCode, registry.loadedAt]
  );
  const rows = useMemo(() => resolveRows(entityCode, ctx), [entityCode, ctx]);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      columns.some((col) => String(row[col.columnName] ?? '').toLowerCase().includes(term))
    );
  }, [rows, columns, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (!entity) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
          {t('الكيان غير مسجّل في محرك الشاشات', 'Entity not registered in the metadata engine')}
        </h2>
        <p className="max-w-lg text-xs text-slate-500 dark:text-slate-400">
          {t(
            'أضف الكيان إلى جدول erp_entities ثم أعد تحميل الصفحة، وسيظهر هنا تلقائياً.',
            'Add the entity to erp_entities and reload; it will appear here automatically.'
          )}
        </p>
        <code className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {entityCode}
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Table2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white">
              {language === 'ar' ? entity.displayNameAr : entity.displayNameEn}
            </h1>
            <p className="font-mono text-[11px] text-slate-400">
              {entity.tableName} · {columns.length} {t('عمود', 'columns')} · {filtered.length}{' '}
              {t('سجل', 'rows')}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('بحث…', 'Search…')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-xs font-semibold outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-64"
          />
        </div>
      </div>

      {/* الجدول المولّد من الـ Metadata */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.columnName}
                    style={{ minWidth: col.width }}
                    className="border-b border-slate-200 px-3 py-2.5 font-extrabold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {language === 'ar' ? col.labelAr : col.labelEn}
                    {col.isRequired && <span className="text-rose-500"> *</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, columns.length)}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    {t('لا توجد سجلات', 'No records')}
                  </td>
                </tr>
              ) : (
                paged.map((row, index) => (
                  <tr
                    key={String(row.id ?? index)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.columnName}
                        className="px-3 py-2.5 text-slate-700 dark:text-slate-200"
                      >
                        {formatCell(row[col.columnName], col, formatMoney)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={page}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          language={language}
        />
      </div>
    </div>
  );
};
