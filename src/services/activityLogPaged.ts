/**
 * قراءة سجل نشاط المستخدمين بالصفحات (Keyset)
 * ---------------------------------------------------------------------------
 * يُستخدم لإخراج `erp_activity_logs` من حِزمة الإقلاع: الشاشة وملف الموظف
 * يقرآن صفحة عند الطلب بدل تحميل كل السجل.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
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
  const connection = getActiveDbConnection();
  if (!connection?.connectionString || !query.tenantId) {
    return { rows: [], total: 0, nextAfter: null, error: 'no_database_connection' };
  }

  const sql = neon(connection.connectionString.trim());
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 300);
  const params: unknown[] = [query.tenantId];
  const filters: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];

  if (query.userId) {
    params.push(query.userId);
    filters.push(`payload->>'userId' = $${params.length}`);
  }
  if (query.userName?.trim()) {
    params.push(query.userName.trim());
    filters.push(`lower(COALESCE(payload->>'userName', '')) = lower($${params.length})`);
  }
  if (query.search?.trim()) {
    params.push(`%${query.search.trim()}%`);
    const index = params.length;
    filters.push(
      `(COALESCE(payload->>'userName', '') || ' ' || COALESCE(payload->>'details', '') || ' ' ||
        COALESCE(payload->>'screenName', '') || ' ' || COALESCE(payload->>'actionType', '')) ILIKE $${index}`
    );
  }
  if (query.from) {
    params.push(query.from);
    filters.push(`substr(COALESCE(payload->>'timestamp', ''), 1, 10) >= $${params.length}`);
  }
  if (query.to) {
    params.push(query.to);
    filters.push(`substr(COALESCE(payload->>'timestamp', ''), 1, 10) <= $${params.length}`);
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
        `SELECT id, payload FROM activity_logs WHERE ${pageWhere} ORDER BY id DESC LIMIT $${pageParams.length}`,
        pageParams
      ),
      sql.query(`SELECT count(*)::bigint AS total FROM activity_logs WHERE ${where}`, params),
    ]);
    const list = (Array.isArray(rows) ? rows : []).map((row: any) => toLog(row));
    return {
      rows: list,
      total: Number((Array.isArray(counts) ? counts[0] : counts)?.total ?? 0),
      nextAfter: list.length === limit ? String(list[list.length - 1].id) : null,
    };
  } catch (error: any) {
    return { rows: [], total: 0, nextAfter: null, error: error?.message || 'activity_page_failed' };
  }
}
