import { neon } from '@neondatabase/serverless';

/**
 * Record-level synchronisation (مزامنة على مستوى السجل).
 *
 * The old model uploaded a WHOLE dataset (e.g. all 22,980 customers) whenever anything
 * changed, so two users editing different records overwrote each other. This module
 * works per record instead:
 *   - push: only the records whose content changed, and soft-deletes for removed ones
 *   - pull: only the records changed since a cursor, merged by id + updated_at
 * so concurrent users cannot destroy each other's work.
 */

export interface SyncRecord {
  id: string;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

const getClient = (connectionString: string) => neon(connectionString.trim());

const recordId = (record: any, index: number, docKey: string): string =>
  String(record?.id ?? `${docKey}-${index}`);

/** Records whose content differs from the previously synced version. */
export function diffRecords(previous: any[], current: any[], docKey: string): {
  upserts: any[];
  deletes: string[];
} {
  const previousById = new Map<string, string>();
  previous.forEach((record, index) => {
    previousById.set(recordId(record, index, docKey), JSON.stringify(record ?? null));
  });
  const upserts: any[] = [];
  const currentIds = new Set<string>();
  current.forEach((record, index) => {
    const id = recordId(record, index, docKey);
    currentIds.add(id);
    if (previousById.get(id) !== JSON.stringify(record ?? null)) upserts.push(record);
  });
  const deletes = [...previousById.keys()].filter((id) => !currentIds.has(id));
  return { upserts, deletes };
}

/** Uploads only the changed records and soft-deletes the removed ones. */
export async function pushRecordChanges(
  connectionString: string,
  tenantId: string,
  docKey: string,
  previous: any[],
  current: any[],
  actor?: string
): Promise<{ pushed: number; deleted: number; error?: string }> {
  const { upserts, deletes } = diffRecords(previous, current, docKey);
  if (upserts.length === 0 && deletes.length === 0) return { pushed: 0, deleted: 0 };
  try {
    const sql = getClient(connectionString);
    let pushed = 0;
    const BATCH = 500;
    for (let start = 0; start < upserts.length; start += BATCH) {
      const slice = upserts.slice(start, start + BATCH);
      const rows: any = await sql.query(
        `SELECT fn_upsert_records($1, $2, $3::jsonb, $4) AS n`,
        [tenantId, docKey, JSON.stringify(slice), actor || 'app']
      );
      pushed += Number(rows?.[0]?.n || 0);
    }
    let deleted = 0;
    if (deletes.length > 0) {
      const rows: any = await sql.query(
        `SELECT fn_soft_delete_records($1, $2, $3::jsonb, $4) AS n`,
        [tenantId, docKey, JSON.stringify(deletes), actor || 'app']
      );
      deleted = Number(rows?.[0]?.n || 0);
    }
    return { pushed, deleted };
  } catch (error: any) {
    return { pushed: 0, deleted: 0, error: error?.message || String(error) };
  }
}

/** Records changed in Neon after the given cursor (includes soft-deleted ones). */
export async function pullChangedRecords(
  connectionString: string,
  tenantId: string,
  docKey: string,
  since: string
): Promise<{ records: SyncRecord[]; deletedIds: string[]; nextCursor: string; error?: string }> {
  try {
    const sql = getClient(connectionString);
    const rows: any = await sql.query(
      `SELECT record_id, payload, updated_at, deleted_at FROM fn_changed_records($1, $2, $3::timestamptz)`,
      [tenantId, docKey, since]
    );
    const records: SyncRecord[] = [];
    const deletedIds: string[] = [];
    let nextCursor = since;
    (rows as any[]).forEach((row) => {
      const stamp = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
      if (stamp > nextCursor) nextCursor = stamp;
      if (row.deleted_at) {
        deletedIds.push(String(row.record_id));
        return;
      }
      records.push({ ...(row.payload || {}), id: String(row.record_id) });
    });
    return { records, deletedIds, nextCursor };
  } catch (error: any) {
    return { records: [], deletedIds: [], nextCursor: since, error: error?.message || String(error) };
  }
}

/**
 * Merges records coming from the server into the local array.
 * Newest `updated_at` wins; soft-deleted records are removed; local-only records survive.
 */
export function mergeRecords(local: any[], incoming: SyncRecord[], deletedIds: string[]): any[] {
  const byId = new Map<string, any>();
  local.forEach((record, index) => byId.set(recordId(record, index, 'local'), record));
  deletedIds.forEach((id) => byId.delete(id));
  incoming.forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing || String(record.updated_at || '') >= String(existing.updated_at || '')) {
      byId.set(record.id, record);
    }
  });
  return [...byId.values()];
}

/**
 * Offline outbox (طابور العمليات).
 * Because the sync path diffs the CURRENT state against the last synced state, every
 * offline edit is still pending when connectivity returns and is pushed automatically:
 * the diff itself is the outbox, so nothing is lost while offline.
 */
export const OUTBOX_NOTE =
  'Updates made offline stay in the local state and are pushed automatically once the connection returns.';

/**
 * Reads the LIVE records of a dataset from the database (soft-deleted ones excluded),
 * using keyset pagination so a dataset with tens of thousands of records never exceeds
 * the HTTP response limit.
 *
 * This is what the app must load on startup: reading the whole-dataset snapshot from
 * `app_documents` would resurrect records that were deleted (the deletion is recorded
 * per record in `app_records`, not in the snapshot).
 */
export async function fetchLiveRecords(
  connectionString: string,
  tenantId: string,
  docKey: string,
  onProgress?: (loaded: number) => void
): Promise<{ records: any[]; error?: string }> {
  const PAGE = 2000;
  const records: any[] = [];
  let lastId: string | null = null;
  try {
    const sql = getClient(connectionString);
    for (;;) {
      const rows: any = lastId === null
        ? await sql.query(
            `SELECT record_id, payload FROM app_records
              WHERE tenant_id = $1 AND doc_key = $2 AND deleted_at IS NULL
              ORDER BY record_id LIMIT $3`,
            [tenantId, docKey, PAGE]
          )
        : await sql.query(
            `SELECT record_id, payload FROM app_records
              WHERE tenant_id = $1 AND doc_key = $2 AND deleted_at IS NULL AND record_id > $3
              ORDER BY record_id LIMIT $4`,
            [tenantId, docKey, lastId, PAGE]
          );
      const list = rows as any[];
      if (list.length === 0) break;
      list.forEach((row) => records.push({ ...(row.payload || {}), id: String(row.record_id) }));
      lastId = String(list[list.length - 1].record_id);
      if (onProgress) onProgress(records.length);
      if (list.length < PAGE) break;
    }
    return { records };
  } catch (error: any) {
    return { records, error: error?.message || String(error) };
  }
}
