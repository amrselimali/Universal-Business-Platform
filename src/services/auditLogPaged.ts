/**
 * قراءة سجل التدقيق بالصفحات (Keyset) — لسجلات تكبر بلا حد
 * ---------------------------------------------------------------------------
 * بدل تحميل كل سجلات التدقيق إلى المتصفح، نقرأ صفحة واحدة (`id < آخر مفتاح`)
 * مع عدّاد مطابق للفلاتر. تُستخدم في شاشة سجل التدقيق فقط.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
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
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) {
    return { rows: [], total: 0, nextAfter: null, error: 'no_database_connection' };
  }

  const sql = neon(connection.connectionString.trim());
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 300);
  const params: unknown[] = [query.tenantId];
  const filters: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];

  if (query.action && query.action !== 'All') {
    params.push(query.action);
    filters.push(`payload->>'actionType' = $${params.length}`);
  }
  if (query.entity && query.entity !== 'All') {
    params.push(query.entity);
    filters.push(`payload->>'entityType' = $${params.length}`);
  }
  if (query.userId && query.userId !== 'All') {
    params.push(query.userId);
    filters.push(`payload->>'performedById' = $${params.length}`);
  }
  if (query.search?.trim()) {
    params.push(`%${query.search.trim()}%`);
    const index = params.length;
    const expr = SEARCH_FIELDS.map((field) => `COALESCE(payload->>'${field}', '')`).join(" || ' ' || ");
    filters.push(`(${expr}) ILIKE $${index}`);
  }

  const where = filters.join(' AND ');
  const pageParams = [...params];
  let pageWhere = where;
  if (query.afterId) {
    pageParams.push(query.afterId);
    pageWhere += ` AND id < $${pageParams.length}`;
  }
  pageParams.push(limit);

  try {
    const [rows, counts] = await Promise.all([
      sql.query(
        `SELECT id, payload FROM audit_records WHERE ${pageWhere} ORDER BY id DESC LIMIT $${pageParams.length}`,
        pageParams
      ),
      sql.query(`SELECT count(*)::bigint AS total FROM audit_records WHERE ${where}`, params),
    ]);

    const list = (Array.isArray(rows) ? rows : []).map((row: any) => toRecord(row));
    return {
      rows: list,
      total: Number((Array.isArray(counts) ? counts[0] : counts)?.total ?? 0),
      nextAfter: list.length === limit ? String(list[list.length - 1].id) : null,
    };
  } catch (error: any) {
    return { rows: [], total: 0, nextAfter: null, error: error?.message || 'audit_page_failed' };
  }
}
