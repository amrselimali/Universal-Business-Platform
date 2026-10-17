/**
 * خطاف قائمة مُرقَّمة (Paged List) — تنفيذ واحد لكل الشاشات
 * ---------------------------------------------------------------------------
 * يحل مشكلة تكرار منطق «صفحة + عدّاد + تحميل المزيد» في كل شاشة:
 *   • يحمل الصفحة الأولى عند تغيّر الفلاتر (بعد تأجيل اختياري).
 *   • `loadMore` يجلب التالية باستخدام آخر مفتاح (Keyset).
 *   • يمنع الطلبات المتزاحمة ويحفظ المؤشر في ref.
 *
 * يُستخدم الآن في شاشة سجل التدقيق، وسيُستخدم في العملاء/المخزون بنفس الواجهة.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PagedPage<T> {
  rows: T[];
  total: number;
  nextAfter: string | null;
  error?: string;
}

export interface PagedListOptions<T, F> {
  /** دالة الجلب: تستقبل الفلاتر + المؤشر + حجم الصفحة. */
  fetchPage: (params: { filters: F; afterId: string | null; limit: number }) => Promise<PagedPage<T>>;
  filters: F;
  pageSize?: number;
  /** يعيد تحميل الصفحة الأولى عند تغيّر هذا المفتاح (مثلاً tenantId). */
  resetKey?: string;
  enabled?: boolean;
}

export function usePagedList<T, F>(options: PagedListOptions<T, F>) {
  const { fetchPage, filters, pageSize = 100, resetKey = '', enabled = true } = options;
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const afterRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const reload = useCallback(async () => {
    if (!enabled) return;
    if (busyRef.current) return;
    busyRef.current = true;
    afterRef.current = null;
    setLoading(true);
    const page = await fetchPage({ filters: filtersRef.current, afterId: null, limit: pageSize });
    busyRef.current = false;
    afterRef.current = page.nextAfter;
    setRows(page.rows);
    setTotal(page.total);
    setError(page.error);
    setHasMore(Boolean(page.nextAfter));
    setLoading(false);
  }, [enabled, fetchPage, pageSize, resetKey]);

  const loadMore = useCallback(async () => {
    if (!enabled || busyRef.current || !afterRef.current) return;
    busyRef.current = true;
    setLoading(true);
    const page = await fetchPage({ filters: filtersRef.current, afterId: afterRef.current, limit: pageSize });
    busyRef.current = false;
    afterRef.current = page.nextAfter;
    setRows((prev) => [...prev, ...page.rows]);
    setTotal(page.total || 0);
    setError(page.error);
    setHasMore(Boolean(page.nextAfter));
    setLoading(false);
  }, [enabled, fetchPage, pageSize, resetKey]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, JSON.stringify(filters)]);

  return { rows, total, loading, error, hasMore, reload, loadMore };
}
