/**
 * قائمة العملاء بالصفحات من السيرفر (بدل تحميل الكل ثم القص)
 * ---------------------------------------------------------------------------
 * يحافظ على نفس واجهة الشاشة (صفحة/عدد لكل صفحة) لكن يجلب صفحة واحدة فقط،
 * ويُرجع العدّاد الكلي المطابق للفلاتر. نفس فلاتر الشاشة تُنفَّذ في SQL:
 * البحث النصي · الحالة (مفعل/مؤرشف) · الرصيد · الفرع (branchId أو branchIds).
 */

import { neon } from '@neondatabase/serverless';
import { getActiveDbConnection } from './commands';
import type { Party } from '../types';

export type PartyStatusFilter = 'all' | 'active' | 'archived';
export type PartyBalanceFilter = 'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE';

export interface PartiesPageQuery {
  tenantId: string;
  search?: string;
  status?: PartyStatusFilter;
  balance?: PartyBalanceFilter;
  /** مفاتيح الفرع المقبولة (id أو الاسم أو الكود). */
  branchKeys?: string[];
  /** تطبيق شرط «الفرع الافتراضي» لمن لا فرع له. */
  fallbackBranch?: boolean;
  limit?: number;
  offset?: number;
}

export interface PartiesPageResult {
  rows: Party[];
  total: number;
  error?: string;
}

const SEARCH_KEYS = ['name', 'nameEn', 'phone', 'customerCode', 'code', 'systemCode', 'paperCode', 'fileCode', 'fileNumber'];

const toParty = (row: any): Party => ({
  ...(row.payload ?? {}),
  id: String(row.id ?? row.payload?.id ?? ''),
});

export async function loadPartiesPage(query: PartiesPageQuery): Promise<PartiesPageResult> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString) return { rows: [], total: 0, error: 'no_database_connection' };

  const sql = neon(connection.connectionString.trim());
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const params: unknown[] = [query.tenantId];
  const filters: string[] = [
    'tenant_id = $1',
    'deleted_at IS NULL',
    "COALESCE(payload->>'type', '') IN ('Customer', 'Both')",
  ];

  const status = query.status ?? 'all';
  if (status === 'active') {
    filters.push("COALESCE(payload->>'isArchived', 'false') <> 'true'");
    filters.push("COALESCE(payload->>'mergedIntoPartyId', '') = ''");
  } else if (status === 'archived') {
    filters.push("(payload->>'isArchived' = 'true' OR COALESCE(payload->>'mergedIntoPartyId', '') <> '')");
  }

  const balance = query.balance ?? 'ALL';
  if (balance === 'WITH_BALANCE') filters.push("COALESCE((payload->>'balance')::numeric, 0) <> 0");
  if (balance === 'ZERO_BALANCE') filters.push("COALESCE((payload->>'balance')::numeric, 0) = 0");

  const branchKeys = (query.branchKeys ?? []).filter(Boolean);
  if (branchKeys.length > 0) {
    params.push(branchKeys);
    const keyIndex = params.length;
    const branchClause = `(
      payload->>'branchId' = ANY($${keyIndex}::text[])
      OR (jsonb_typeof(payload->'branchIds') = 'array' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(payload->'branchIds') AS b(value)
             WHERE b.value = ANY($${keyIndex}::text[])))
      ${query.fallbackBranch ? `OR (COALESCE(payload->>'branchId', '') = '' AND COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(payload->'branchIds') = 'array' THEN payload->'branchIds' ELSE '[]'::jsonb END), 0) = 0)` : ''}
    )`;
    filters.push(branchClause);
  }

  const search = (query.search ?? '').trim();
  if (search) {
    params.push(`%${search}%`);
    const index = params.length;
    const expr = SEARCH_KEYS.map((key) => `COALESCE(payload->>'${key}', '')`).join(" || ' ' || ");
    filters.push(`(${expr}) ILIKE $${index}`);
  }

  const where = filters.join(' AND ');
  try {
    const [rows, counts] = await Promise.all([
      sql.query(
        `SELECT id, payload FROM parties WHERE ${where}
         ORDER BY COALESCE(payload->>'name', ''), id LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      sql.query(`SELECT count(*)::bigint AS total FROM parties WHERE ${where}`, params),
    ]);
    return {
      rows: (Array.isArray(rows) ? rows : []).map(toParty),
      total: Number((Array.isArray(counts) ? counts[0] : counts)?.total ?? 0),
    };
  } catch (error: any) {
    return { rows: [], total: 0, error: error?.message || 'parties_page_failed' };
  }
}

export interface PartyCodeOptions {
  customerCodes: Array<{ value: string; label: string }>;
  systemCodes: Array<{ value: string; label: string }>;
  fileCodes: Array<{ value: string; label: string }>;
}

const EMPTY_CODE_OPTIONS: PartyCodeOptions = { customerCodes: [], systemCodes: [], fileCodes: [] };

/**
 * خيارات أكواد التكويد (عميل/سيستم/ملف) — من السيرفر بـ DISTINCT.
 * تُستخدم في قوائم فلترة التكويد بدل مسح كل العملاء في المتصفح.
 */
export async function loadPartyCodeOptions(query: {
  tenantId: string;
  statuses: string[];
  branchIds?: string[];
  language?: 'ar' | 'en';
}): Promise<PartyCodeOptions> {
  const connection = getActiveDbConnection();
  if (!connection?.connectionString || !query.tenantId) return EMPTY_CODE_OPTIONS;

  const sql = neon(connection.connectionString.trim());
  const params: unknown[] = [query.tenantId];
  const filters: string[] = [
    'tenant_id = $1',
    'deleted_at IS NULL',
    "COALESCE(payload->>'type', '') IN ('Customer', 'Both')",
  ];

  const statuses = query.statuses ?? [];
  if (statuses.length === 1 && statuses[0] === 'active') {
    filters.push("COALESCE(payload->>'isArchived', 'false') <> 'true'");
    filters.push("COALESCE(payload->>'mergedIntoPartyId', '') = ''");
  } else if (statuses.length === 1 && statuses[0] === 'archived') {
    filters.push("(payload->>'isArchived' = 'true' OR COALESCE(payload->>'mergedIntoPartyId', '') <> '')");
  }

  if (query.branchIds && query.branchIds.length > 0) {
    params.push(query.branchIds);
    const index = params.length;
    filters.push(`(payload->>'branchId' = ANY($${index}::text[])
      OR (jsonb_typeof(payload->'branchIds') = 'array' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(payload->'branchIds') AS b(value)
             WHERE b.value = ANY($${index}::text[]))))`);
  }

  const where = filters.join(' AND ');
  const expressions: Record<keyof PartyCodeOptions, string> = {
    customerCodes: "COALESCE(NULLIF(payload->>'customerCode', ''), NULLIF(payload->>'code', ''))",
    systemCodes: "COALESCE(NULLIF(payload->>'systemCode', ''), NULLIF(payload->>'paperCode', ''))",
    fileCodes: "COALESCE(NULLIF(payload->>'fileCode', ''), NULLIF(payload->>'fileNumber', ''))",
  };

  try {
    const results = await Promise.all(
      (Object.keys(expressions) as Array<keyof PartyCodeOptions>).map(async (key) => {
        const rows: any = await sql.query(
          `SELECT DISTINCT ${expressions[key]} AS value FROM parties
            WHERE ${where} AND ${expressions[key]} IS NOT NULL AND trim(${expressions[key]}) <> ''`,
          params
        );
        const values = (Array.isArray(rows) ? rows : [])
          .map((row: any) => String(row.value ?? ''))
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, query.language === 'en' ? 'en' : 'ar'));
        return [key, values.map((value: string) => ({ value, label: value }))] as const;
      })
    );

    const options: PartyCodeOptions = { customerCodes: [], systemCodes: [], fileCodes: [] };
    results.forEach(([key, value]) => { options[key] = value; });
    return options;
  } catch {
    return EMPTY_CODE_OPTIONS;
  }
}
