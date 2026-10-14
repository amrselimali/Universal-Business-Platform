import { neon } from '@neondatabase/serverless';
import { NEON_SCHEMA_TABLES } from './neonSchema';

/**
 * Real-table store (مخزن الجداول الحقيقية).
 *
 * The app reads and writes the REAL typed tables instead of the composite text store.
 * Each dataset is mapped to its table (NEON_SCHEMA_TABLES); every row keeps the full
 * record in the `payload` column while the queryable columns stay indexed, so the
 * database can filter, sort, paginate and report without loading everything.
 * Soft delete (deleted_at) and updated_at keep the incremental sync and the
 * "deleted rows never come back" guarantee.
 */

const getClient = (connectionString: string) => neon(connectionString.trim());

const TABLE_BY_KEY: { [key: string]: string } = (() => {
  const map: { [key: string]: string } = {};
  NEON_SCHEMA_TABLES.forEach((schema) => { map[schema.sourceKey] = schema.table; });
  return map;
})();

const GLOBAL_TABLES = new Set<string>(['tenants']);

export const tableForKey = (docKey: string): string | undefined => TABLE_BY_KEY[docKey];

export interface TableRecord {
  id: string;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

/** Reads the live records of a dataset from its real table (keyset paginated). */
export async function readTableRecords(params: {
  connectionString: string;
  tenantId: string;
  docKey: string;
  after?: string;
  limit?: number;
  onProgress?: (loaded: number) => void;
}): Promise<{ records: TableRecord[]; nextAfter: string | null; error?: string }> {
  const table = tableForKey(params.docKey);
  if (!table) return { records: [], nextAfter: null, error: 'no_table_for_' + params.docKey };
  const isGlobal = GLOBAL_TABLES.has(table);
  const pageSize = Math.min(params.limit || 2000, 2000);
  const records: TableRecord[] = [];
  let cursor = params.after || '';
  try {
    const sql = getClient(params.connectionString);
    for (;;) {
      const rows: any = isGlobal
        ? await sql.query('SELECT id, payload FROM ' + table + " WHERE deleted_at IS NULL AND ($1 = '' OR id > $1) ORDER BY id LIMIT $2", [cursor, pageSize])
        : await sql.query('SELECT id, payload FROM ' + table + " WHERE tenant_id = $1 AND deleted_at IS NULL AND ($2 = '' OR id > $2) ORDER BY id LIMIT $3", [params.tenantId, cursor, pageSize]);
      const list = rows as any[];
      if (list.length === 0) break;
      list.forEach((row) => records.push({ ...(row.payload || {}), id: String(row.id) }));
      cursor = String(list[list.length - 1].id);
      if (params.onProgress) params.onProgress(records.length);
      if (list.length < pageSize) break;
    }
    return { records, nextAfter: null };
  } catch (error: any) {
    return { records, nextAfter: null, error: error?.message || String(error) };
  }
}

/** Inserts or updates records in the real table (payload + queryable columns). */
export async function upsertTableRecords(params: {
  connectionString: string;
  tenantId: string;
  docKey: string;
  records: Record<string, unknown>[];
  actor?: string;
}): Promise<{ upserted: number; error?: string }> {
  const table = tableForKey(params.docKey);
  if (!table) return { upserted: 0, error: 'no_table_for_' + params.docKey };
  if (params.records.length === 0) return { upserted: 0 };
  const isGlobal = GLOBAL_TABLES.has(table);
  let upserted = 0;
  try {
    const sql = getClient(params.connectionString);
    const BATCH = 250;
    for (let start = 0; start < params.records.length; start += BATCH) {
      const slice = params.records.slice(start, start + BATCH);
      const values: unknown[] = [];
      const tuples = slice.map(function (record) {
        const id = String((record as any).id || '');
        const idPos = values.push(id);
        if (isGlobal) {
          const payloadPos = values.push(JSON.stringify(record));
          return '($' + idPos + ', $' + payloadPos + '::jsonb, NOW(), $' + values.push(params.actor || null) + ') ';
        }
        const tenantPos = values.push(params.tenantId);
        const payloadPos = values.push(JSON.stringify(record));
        return '($' + idPos + ', $' + tenantPos + ', $' + payloadPos + '::jsonb, NOW(), $' + values.push(params.actor || null) + ') ';
      }).join(', ');
      const columns = isGlobal
        ? '(id, payload, updated_at, updated_by)'
        : '(id, tenant_id, payload, updated_at, updated_by)';
      await sql.query(
        'INSERT INTO ' + table + ' ' + columns + ' VALUES ' + tuples +
        ' ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW(), updated_by = EXCLUDED.updated_by, deleted_at = NULL',
        values
      );
      upserted += slice.length;
    }
    return { upserted };
  } catch (error: any) {
    return { upserted, error: error?.message || String(error) };
  }
}

/** Soft-deletes records (deleted_at) so they never come back. */
export async function softDeleteTableRecords(params: {
  connectionString: string;
  tenantId: string;
  docKey: string;
  ids: string[];
  actor?: string;
}): Promise<{ deleted: number; error?: string }> {
  const table = tableForKey(params.docKey);
  if (!table) return { deleted: 0, error: 'no_table_for_' + params.docKey };
  if (params.ids.length === 0) return { deleted: 0 };
  const isGlobal = GLOBAL_TABLES.has(table);
  try {
    const sql = getClient(params.connectionString);
    const rows: any = isGlobal
      ? await sql.query('UPDATE ' + table + ' SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2 WHERE id = ANY($1)', [params.ids, params.actor || null])
      : await sql.query('UPDATE ' + table + ' SET deleted_at = NOW(), updated_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND id = ANY($2)', [params.tenantId, params.ids, params.actor || null]);
    return { deleted: params.ids.length };
  } catch (error: any) {
    return { deleted: 0, error: error?.message || String(error) };
  }
}

/** Records of a dataset changed after a cursor (includes soft-deleted rows). */
export async function tableChangesSince(params: {
  connectionString: string;
  tenantId: string;
  docKey: string;
  since: string;
}): Promise<{ records: TableRecord[]; deletedIds: string[]; nextCursor: string; error?: string }> {
  const table = tableForKey(params.docKey);
  if (!table) return { records: [], deletedIds: [], nextCursor: params.since, error: 'no_table_for_' + params.docKey };
  const isGlobal = GLOBAL_TABLES.has(table);
  try {
    const sql = getClient(params.connectionString);
    const rows: any = isGlobal
      ? await sql.query('SELECT id, payload, updated_at, deleted_at FROM ' + table + ' WHERE updated_at > $1::timestamptz ORDER BY updated_at', [params.since])
      : await sql.query('SELECT id, payload, updated_at, deleted_at FROM ' + table + ' WHERE tenant_id = $1 AND updated_at > $2::timestamptz ORDER BY updated_at', [params.tenantId, params.since]);
    const records: TableRecord[] = [];
    const deletedIds: string[] = [];
    let nextCursor = params.since;
    (rows as any[]).forEach((row) => {
      const stamp = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
      if (stamp > nextCursor) nextCursor = stamp;
      if (row.deleted_at) deletedIds.push(String(row.id));
      else records.push({ ...(row.payload || {}), id: String(row.id), updated_at: stamp });
    });
    return { records, deletedIds, nextCursor };
  } catch (error: any) {
    return { records: [], deletedIds: [], nextCursor: params.since, error: error?.message || String(error) };
  }
}
