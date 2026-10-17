/**
 * قراءة مُرقَّمة بمفاتيح (Keyset Pagination) — لبيانات عشرات الآلاف
 * ---------------------------------------------------------------------------
 * الفرق عن القراءة الحالية: لا نجلب الجدول كاملاً إلى المتصفح. نجلب صفحة واحدة
 * (`LIMIT n` بعد آخر مفتاح) + عدّاد مطابق للفلاتر، والواجهة تطلب المزيد عند الحاجة.
 *
 * الأمان: أسماء الجداول/الأعمدة تأتي من كائن إعداد مُعرَّف في الكود (allowlist)
 * ويُتحقق منها بـ assertIdentifier قبل أي SQL.
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import { assertIdentifier } from './databaseIdentifiers';

export interface PagedSource {
  table: string;
  /** عمود التاريخ المستخدم للفلاتر (داخل payload عادةً). */
  dateKeys: string[];
  /** حقول تُستخدم في البحث النصي. */
  searchKeys: string[];
}

export interface PagedQuery {
  source: PagedSource;
  limit?: number;
  afterId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PagedResult {
  rows: Record<string, unknown>[];
  total: number;
  nextAfter: string | null;
  error?: string;
}

/** مصادر مسموحة صراحةً (لا SQL مبني من مدخلات المستخدم). */
export const PAGED_SOURCES = {
  invoices: {
    table: 'sales_invoices',
    dateKeys: ['createdAt', 'invoiceDate'],
    searchKeys: ['invoiceNumber', 'customerName', 'description', 'cashierName'],
  },
} satisfies Record<string, PagedSource>;

const quote = (value: string) => `"${assertIdentifier(value)}"`;

const buildFilters = (
  query: PagedQuery,
  params: unknown[]
): string => {
  const filters: string[] = [`tenant_id = $1`, `deleted_at IS NULL`];

  const search = (query.search ?? '').trim();
  if (search) {
    const keys = query.source.searchKeys.map((key) => assertIdentifier(key));
    const textExpr = keys
      .map((key) => `COALESCE(payload->>'${key}', '')`)
      .join(" || ' ' || ");
    params.push(`%${search}%`);
    filters.push(`(${textExpr}) ILIKE $${params.length}`);
  }

  const dateExpr = query.source.dateKeys
    .map((key) => `NULLIF(payload->>'${assertIdentifier(key)}', '')`)
    .join(', ');
  if (query.dateFrom) {
    params.push(query.dateFrom);
    filters.push(`substr(COALESCE(${dateExpr}), 1, 10) >= $${params.length}`);
  }
  if (query.dateTo) {
    params.push(query.dateTo);
    filters.push(`substr(COALESCE(${dateExpr}), 1, 10) <= $${params.length}`);
  }

  return filters.join(' AND ');
};

/** صفحة واحدة + العدد الكلي المطابق للفلاتر. */
export async function loadPagedRecords(tenantId: string, query: PagedQuery): Promise<PagedResult> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) {
    return { rows: [], total: 0, nextAfter: null, error: 'no_database_connection' };
  }
  if (!tenantId) return { rows: [], total: 0, nextAfter: null, error: 'missing_tenant' };

  const sql = neon(connection.connectionString.trim());
  const table = quote(query.source.table);
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

  try {
    const params: unknown[] = [tenantId];
    const where = buildFilters(query, params);
    const pageParams = [...params];
    let pageWhere = where;

    if (query.afterId) {
      pageParams.push(query.afterId);
      pageWhere += ` AND id > $${pageParams.length}`;
    }
    pageParams.push(limit);

    const [rows, counts] = await Promise.all([
      sql.query(
        `SELECT id, payload FROM ${table} WHERE ${pageWhere} ORDER BY id ASC LIMIT $${pageParams.length}`,
        pageParams
      ),
      sql.query(`SELECT count(*)::bigint AS total FROM ${table} WHERE ${where}`, params),
    ]);

    const list = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      ...(row.payload ?? {}),
      id: String(row.id),
    }));

    return {
      rows: list,
      total: Number((Array.isArray(counts) ? counts[0] : counts)?.total ?? 0),
      nextAfter: list.length === limit ? String(list[list.length - 1].id) : null,
    };
  } catch (error: any) {
    return { rows: [], total: 0, nextAfter: null, error: error?.message || 'paged_read_failed' };
  }
}
