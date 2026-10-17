/**
 * قراءة سجل التدقيق بالصفحات (Keyset) — لسجلات تكبر بلا حد
 * ---------------------------------------------------------------------------
 * بدل تحميل كل سجلات التدقيق إلى المتصفح، نقرأ صفحة واحدة (`id < آخر مفتاح`)
 * مع عدّاد مطابق للفلاتر. تُستخدم في شاشة سجل التدقيق فقط.
 */

import { apiRequest } from './apiClient';
import type { AuditRecord } from '../types';

export interface AuditPageQuery {
  tenantId: string;
  limit?: number;
  afterId?: string | null;
  search?: string;
  action?: string;
  entity?: string;
  userId?: string;
}

export interface AuditPageResult {
  rows: AuditRecord[];
  total: number;
  nextAfter: string | null;
  error?: string;
}

const SEARCH_FIELDS = ['entityName', 'performedByName', 'reason', 'details', 'diffSummary'];

const toRecord = (row: Record<string, unknown>): AuditRecord => {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return { ...(payload as unknown as AuditRecord), id: String(row.id ?? payload.id ?? '') };
};

export async function loadAuditPage(query: AuditPageQuery): Promise<AuditPageResult> {
  const params = new URLSearchParams();
  if (query.limit) params.set('limit', String(query.limit));
  if (query.afterId) params.set('afterId', query.afterId);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.action && query.action !== 'All') params.set('action', query.action);
  if (query.entity && query.entity !== 'All') params.set('entity', query.entity);
  if (query.userId && query.userId !== 'All') params.set('userId', query.userId);

  const result = await apiRequest<{ items?: any[]; nextAfterId?: string | null }>(`/audit-records?${params.toString()}`);
  if (!result.ok) return { rows: [], total: 0, nextAfter: null, error: result.error };

  const items = Array.isArray(result.data?.items) ? result.data!.items! : [];
  return {
    rows: items.map(toRecord),
    total: items.length,
    nextAfter: result.data?.nextAfterId ? String(result.data.nextAfterId) : null,
  };
}
