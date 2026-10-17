import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Gauge, RefreshCw, Search, Zap } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { usePagedRecords } from '../hooks/usePagedRecords';
import { PAGED_SOURCES } from '../services/pagedRecords';
import { WindowedTable, type WindowColumn } from '../components/data/WindowedTable';

/**
 * الفواتير — عرض سريع مُرقَّم من السيرفر (Slice لبيانات عشرات الآلاف)
 * ---------------------------------------------------------------------------
 * يقرأ من `sales_invoices` صفحة واحدة (Keyset على id) + عدّاد مطابق، ويعرضها في
 * جدول بنوافذ افتراضية. لا يحمّل الجدول كاملاً إلى المتصفح.
 *
 * هذا المسار مستقل عن شاشة الفواتير الحالية (التي تعتمد على تحميل الكل) — لإثبات
 * النمط وقياسه قبل تعميمه على بقية الشاشات.
 */

export const InvoicesStreamView: React.FC = () => {
  const { t, language, tenant, formatMoney } = usePlatform();
  const isArabic = language === 'ar';
  const tenantId = tenant?.id || '';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastMs, setLastMs] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const source = useMemo(() => PAGED_SOURCES.invoices, []);
  const { rows, total, loading, error, hasMore, reload, loadMore } = usePagedRecords({
    tenantId,
    source,
    search: debounced,
    dateFrom,
    dateTo,
    pageSize: 100,
  });

  const measure = async () => {
    const started = performance.now();
    await reload();
    setLastMs(Math.round(performance.now() - started));
  };

  const columns = useMemo<WindowColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'invoiceNumber',
        label: t('رقم الفاتورة', 'Invoice'),
        width: '1.1fr',
        mono: true,
        render: (row) => <span className="font-mono">{String(row.invoiceNumber ?? row.id ?? '').slice(0, 18)}</span>,
      },
      {
        key: 'date',
        label: t('التاريخ', 'Date'),
        width: '0.8fr',
        mono: true,
        render: (row) => String(row.createdAt ?? row.invoiceDate ?? '').slice(0, 10) || '—',
      },
      {
        key: 'customerName',
        label: t('العميل', 'Customer'),
        width: '1.4fr',
        render: (row) => String(row.customerName ?? '—'),
      },
      {
        key: 'total',
        label: t('الإجمالي', 'Total'),
        width: '0.7fr',
        align: 'end',
        mono: true,
        render: (row) => formatMoney(Number(row.total ?? row.netAmount ?? 0)),
      },
      {
        key: 'status',
        label: t('الحالة', 'Status'),
        width: '0.6fr',
        render: (row) => String(row.status ?? '—'),
      },
    ],
    [t, formatMoney]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white">
              {t('الفواتير — عرض سريع (مُرقَّم)', 'Invoices — fast paged view')}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t('يُقرأ 100 صف لكل صفحة من قاعدة البيانات مباشرة — بلا تحميل الجدول كاملاً', 'Reads 100 rows per page straight from the database — no full-table load')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
          <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Gauge className="h-3 w-3" /> {t('الإجمالي في القاعدة:', 'Total in DB:')} {total.toLocaleString(isArabic ? 'ar-EG' : 'en-GB')}
          </span>
          <span className="rounded-xl bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t('محمَّل الآن:', 'Loaded:')} {rows.length}
          </span>
          {lastMs !== null && <span className="rounded-xl bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{lastMs} ms</span>}
          <button
            type="button"
            onClick={() => void measure()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> {t('قياس التحميل', 'Measure load')}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1.6fr_0.8fr_0.8fr] rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('ابحث برقم الفاتورة أو اسم العميل…', 'Search invoice no. or customer…')}
            className="w-full bg-transparent py-1.5 text-[11px] outline-none dark:text-slate-100"
          />
        </label>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900" />
      </div>

      {error && (
        <p className="flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}

      <WindowedTable
        t={t}
        columns={columns}
        rows={rows}
        loading={loading}
        onEndReached={() => { if (hasMore) void loadMore(); }}
        emptyLabel={t('لا فواتير مطابقة.', 'No matching invoices.')}
      />

      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>
          {t(`عُرض ${rows.length} من ${total}`, `Showing ${rows.length} of ${total}`)}
        </span>
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={!hasMore || loading}
          className="rounded-xl bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {hasMore ? t('تحميل المزيد', 'Load more') : t('وصلت للنهاية', 'End reached')}
        </button>
      </div>
    </div>
  );
};
