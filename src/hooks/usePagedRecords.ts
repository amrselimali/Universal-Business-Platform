/**
 * خطاف القراءة المُرَقَّمة — يجلب صفحة ويضيف عند الحاجة
 * ---------------------------------------------------------------------------
 * • `rows` تُضاف تدريجياً (incremental) بدل تحميل الجدول كاملاً.
 * • `reload` يعيد من أول مفتاح عند تغيير البحث/الفلاتر.
 * • `loadMore` يجلب الصفحة التالية باستخدام آخر مفتاح (Keyset).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPagedRecords, type PagedSource } from '../services/pagedRecords';

export interface PagedState {
  rows: Record<string, unknown>[];
  total: number;
  loading: boolean;
  error?: string;
  hasMore: boolean;
}

const EMPTY: PagedState = { rows: [], total: 0, loading: false, hasMore: false };

export function usePagedRecords(params: {
  tenantId: string;
  source: PagedSource;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
}) {
  const { tenantId, source, search = '', dateFrom = '', dateTo = '', pageSize = 100 } = params;
  const [state, setState] = useState<PagedState>(EMPTY);
  const afterRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    busyRef.current = true;
    afterRef.current = null;
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    const result = await loadPagedRecords(tenantId, { source, limit: pageSize, search, dateFrom, dateTo });
    busyRef.current = false;
    afterRef.current = result.nextAfter;
    setState({
      rows: result.rows,
      total: result.total,
      loading: false,
      error: result.error,
      hasMore: Boolean(result.nextAfter),
    });
  }, [tenantId, source, search, dateFrom, dateTo, pageSize]);

  const loadMore = useCallback(async () => {
    if (!tenantId || busyRef.current || !afterRef.current) return;
    busyRef.current = true;
    setState((prev) => ({ ...prev, loading: true }));
    const result = await loadPagedRecords(tenantId, {
      source,
      limit: pageSize,
      afterId: afterRef.current,
      search,
      dateFrom,
      dateTo,
    });
    busyRef.current = false;
    afterRef.current = result.nextAfter;
    setState((prev) => ({
      rows: [...prev.rows, ...result.rows],
      total: result.total || prev.total,
      loading: false,
      error: result.error,
      hasMore: Boolean(result.nextAfter),
    }));
  }, [tenantId, source, search, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, loadMore };
}
