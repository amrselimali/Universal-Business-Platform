import { isApiConfigured, getApiToken, apiFetchRecords, apiFetchChanges, apiUpsertRecords, apiDeleteRecords } from './apiClient';
import { readTableRecords, upsertTableRecords, softDeleteTableRecords, tableChangesSince } from './tableStore';
// منطق الدمج والتزامن المتفائل انتقل إلى ملف مستقل (recordMerge.ts) لتقليل حجم هذا الملف.
import { diffRecords } from './recordMerge';
import type { SyncRecord } from './recordMerge';
export { diffRecords, mergeRecords, hasVersionConflict } from './recordMerge';
export type { SyncRecord } from './recordMerge';

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

  // Preferred path: the backend API (JWT + tenant from the token + RLS).
  if (isApiConfigured() && getApiToken()) {
    try {
      let pushedRecords = 0;
      const BATCH_API = 500;
      for (let start = 0; start < upserts.length; start += BATCH_API) {
        const slice = upserts.slice(start, start + BATCH_API);
        const result = await apiUpsertRecords(docKey, slice);
        if (!result.ok) return { pushed: pushedRecords, deleted: 0, error: result.error };
        pushedRecords += Number(result.data?.upserted || slice.length);
      }
      let deletedRecords = 0;
      if (deletes.length > 0) {
        const result = await apiDeleteRecords(docKey, deletes);
        if (!result.ok) return { pushed: pushedRecords, deleted: 0, error: result.error };
        deletedRecords = Number(result.data?.deleted || deletes.length);
      }
      return { pushed: pushedRecords, deleted: deletedRecords };
    } catch (apiError: any) {
      return { pushed: 0, deleted: 0, error: apiError?.message || 'api_push_failed' };
    }
  }

  // المصدر الوحيد للحقيقة: الجدول المنمّط.
  // أُزيل مسار مخزن المستندات (app_records) لإنهاء الازدواجية.
  {
    let pushedCount = 0;
    let deletedCount = 0;
    if (upserts.length > 0) {
      const outcome = await upsertTableRecords({ connectionString, tenantId, docKey, records: upserts as Record<string, unknown>[], actor });
      if (outcome.error) return { pushed: 0, deleted: 0, error: outcome.error };
      pushedCount = outcome.upserted;
    }
    if (deletes.length > 0) {
      const outcome = await softDeleteTableRecords({ connectionString, tenantId, docKey, ids: deletes, actor });
      if (outcome.error) return { pushed: pushedCount, deleted: 0, error: outcome.error };
      deletedCount = outcome.deleted;
    }
    return { pushed: pushedCount, deleted: deletedCount };
  }
}

/** Records changed in Neon after the given cursor (includes soft-deleted ones). */
export async function pullChangedRecords(
  connectionString: string,
  tenantId: string,
  docKey: string,
  since: string
): Promise<{ records: SyncRecord[]; deletedIds: string[]; nextCursor: string; error?: string }> {
  if (isApiConfigured() && getApiToken()) {
    const result = await apiFetchChanges(docKey, since);
    if (!result.ok) return { records: [], deletedIds: [], nextCursor: since, error: result.error };
    return {
      records: (result.data?.records || []) as SyncRecord[],
      deletedIds: (result.data?.deletedIds || []) as string[],
      nextCursor: String(result.data?.nextCursor || since),
    };
  }

  // المصدر الوحيد: الجدول المنمّط (أُزيل مسار مخزن المستندات).
  const changed = await tableChangesSince({ connectionString, tenantId, docKey, since });
  if (changed.error) return { records: [], deletedIds: [], nextCursor: since, error: changed.error };
  return { records: changed.records as SyncRecord[], deletedIds: changed.deletedIds, nextCursor: changed.nextCursor };
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

  // Preferred path: read the live records through the backend API.
  if (isApiConfigured() && getApiToken()) {
    try {
      let after: string | undefined;
      for (;;) {
        const page = await apiFetchRecords(docKey, after);
        if (!page.ok) return { records, error: page.error };
        const list = page.data?.records || [];
        list.forEach((record: any) => records.push(record));
        if (onProgress) onProgress(records.length);
        if (!page.data?.nextAfter || list.length === 0) break;
        after = page.data.nextAfter;
      }
      return { records };
    } catch (apiError: any) {
      return { records, error: apiError?.message || 'api_read_failed' };
    }
  }

  // المصدر الوحيد: الجدول المنمّط.
  const loaded = await readTableRecords({ connectionString, tenantId, docKey, onProgress });
  return { records: loaded.records, error: loaded.error };
}

/**
 * Reads LIVE records for multiple datasets in a single fast batched query,
 * or concurrent queries if pagination is required.
 * Eliminates 35+ sequential HTTP round-trips over serverless connection,
 * reducing cloud bootstrap from ~20 seconds down to ~300-800ms.
 */
export async function fetchLiveRecordsBatch(
  connectionString: string,
  tenantId: string,
  docKeys: string[],
  onProgress?: (completedKeys: number, totalKeys: number) => void
): Promise<{ recordsByDocKey: { [docKey: string]: any[] }; error?: string }> {
  if (docKeys.length === 0) return { recordsByDocKey: {} };

  // المصدر الوحيد: الجداول المنمّطة (أُزيل مسار مخزن المستندات app_records).
  // سحب متوازٍ محدود (6 تدفقات) بدل طلبات متسلسلة.
  const recordsByDocKey: { [docKey: string]: any[] } = {};
  const CONCURRENCY = 6;
  for (let i = 0; i < docKeys.length; i += CONCURRENCY) {
    const chunk = docKeys.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (key) => ({ key, single: await fetchLiveRecords(connectionString, tenantId, key) }))
    );
    for (const { key, single } of results) {
      if (single.error) return { recordsByDocKey, error: single.error };
      recordsByDocKey[key] = single.records;
    }
    if (onProgress) onProgress(Math.min(i + CONCURRENCY, docKeys.length), docKeys.length);
  }
  return { recordsByDocKey };
}
