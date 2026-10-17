/**
 * عميل سجل نشاط المستخدمين (Activity logs API client)
 * ---------------------------------------------------------------------------
 * **لا يتصل بقاعدة البيانات.** القراءة عبر `GET /activity-logs` (صفحة Keyset)
 * والـ tenant من التوكن داخل السيرفر مع RLS.
 */

import { apiRequest } from './apiClient';
import type { UserActivityLog } from '../types';

export interface ActivityPageQuery {
  tenantId: string;
  limit?: number;
  afterId?: string | null;
  userId?: string;
  userName?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface ActivityPageResult {
  rows: UserActivityLog[];
  total: number;
  nextAfter: string | null;
  error?: string;
}

const toLog = (row: any): UserActivityLog => ({
  ...(row.payload ?? {}),
  id: String(row.id ?? row.payload?.id ?? ''),
});

export async function loadActivityPage(query: ActivityPageQuery): Promise<ActivityPageResult> {
  const params = new URLSearchParams();
  if (query.limit) params.set('limit', String(query.limit));
  if (query.afterId) params.set('afterId', query.afterId);
  if (query.userId) params.set('userId', query.userId);
  if (query.userName) params.set('userName', query.userName);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);

  const result = await apiRequest<{ items?: any[]; nextAfterId?: string | null }>(`/activity-logs?${params.toString()}`);
  if (!result.ok) return { rows: [], total: 0, nextAfter: null, error: result.error };

  const items = Array.isArray(result.data?.items) ? result.data!.items! : [];
  return {
    rows: items.map(toLog),
    total: items.length,
    nextAfter: result.data?.nextAfterId ? String(result.data.nextAfterId) : null,
  };
}
