/**
 * قرار المزامنة لكل مجموعة بيانات — منطق نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` كخطوة في تقسيم بلوك المزامنة (~750 سطر).
 *
 * لماذا هذا الجزء بالذات؟
 *   لأنه **القرار الحاسم** في المزامنة: «هل تغيّرت هذه المجموعة على الخادم؟»
 *   خطأ هنا يعني إمّا **فقدان تحديث** (لم نرصده) أو **طلبات شبكة بلا داعٍ**
 *   (كل مجموعة تُسحب في كل مرة). عزله في دالة نقية يجعله قابلاً للاختبار
 *   بلا قاعدة بيانات ولا شبكة.
 *
 * الدالة لا تعرف كيف تُسحب البيانات — تُمرَّر لها دالة السحب (Dependency
 * Injection)، فيسهل اختبار كل الحالات: تغيير، حذف، لا تغيير، فشل.
 */

import { mergeRecords, type SyncRecord } from '../../services/recordMerge';

/** المؤشر الابتدائي: ما قبل أي تغيير معروف. */
export const DEFAULT_SYNC_CURSOR = '1970-01-01T00:00:00.000Z';

/** نتيجة سحب واحد من الخادم. */
export interface PulledChanges {
  records: SyncRecord[];
  deletedIds: string[];
  nextCursor: string;
  error?: string;
}

/** دالة السحب — تُمرَّر من الخارج (قاعدة البيانات / الـ API). */
export type PullFn = (docKey: string, cursor: string) => Promise<PulledChanges>;

export interface SyncDatasetResult {
  key: string;
  merged: unknown[];
  nextCursor: string;
}

export interface SyncDatasetError {
  error: string;
}

/** يُرجع مؤشر المزامنة المحفوظ لمجموعة، أو المؤشر الابتدائي. */
export const resolveCursor = (
  cursors: Map<string, string>,
  docKey: string
): string => cursors.get(docKey) || DEFAULT_SYNC_CURSOR;

/**
 * يزامن مجموعة بيانات **واحدة**.
 *
 * @returns
 *   • `SyncDatasetResult` — تغيّرت البيانات، وهذا المحتوى الجديد
 *   • `null` — لا تغيير (لا نُرسل طلب تحديث للواجهة)
 *   • `SyncDatasetError` — فشل السحب (يجب إيقاف المزامنة وإبلاغ المستخدم)
 */
export async function syncOneDataset(
  dataset: { key: string; payload: unknown },
  cursor: string,
  pull: PullFn
): Promise<SyncDatasetResult | null | SyncDatasetError> {
  const pulled = await pull(dataset.key, cursor);

  if (pulled.error) return { error: pulled.error };

  // لا سجلات جديدة ولا محذوفات ⇒ لا حاجة لتحديث الواجهة (توفير إعادة رسم كاملة)
  if (pulled.records.length === 0 && pulled.deletedIds.length === 0) return null;

  const current: unknown[] = Array.isArray(dataset.payload) ? dataset.payload : [];
  const merged = mergeRecords(current, pulled.records, pulled.deletedIds);

  return {
    key: dataset.key,
    merged,
    nextCursor: pulled.nextCursor,
  };
}

/** نتيجة مزامنة دفعة كاملة. */
export interface SyncBatchOutcome {
  /** المحتوى الجديد لكل مجموعة تغيّرت. */
  documents: Record<string, unknown[]>;
  /** مفاتيح المجموعات التي تغيّرت (للكاش والإحصاء). */
  changedKeys: string[];
  /** المؤشر الجديد لكل مجموعة تغيّرت. */
  cursors: Record<string, string>;
  /** أول خطأ يُصادف — إيقاف المزامنة فوراً. */
  error?: string;
}

/**
 * يزامن كل مجموعات البيانات بالتسلسل.
 * يتوقف عند أول خطأ (لا نُكمل على بيانات ناقصة).
 */
export async function syncDatasets(
  datasets: { key: string; payload: unknown }[],
  cursors: Map<string, string>,
  pull: PullFn
): Promise<SyncBatchOutcome> {
  const outcome: SyncBatchOutcome = { documents: {}, changedKeys: [], cursors: {} };

  for (const dataset of datasets) {
    const result = await syncOneDataset(dataset, resolveCursor(cursors, dataset.key), pull);

    if (result === null) continue; // لا تغيير

    if ('error' in result) {
      outcome.error = result.error;
      return outcome;
    }

    outcome.documents[result.key] = result.merged;
    outcome.changedKeys.push(result.key);
    outcome.cursors[result.key] = result.nextCursor;
  }

  return outcome;
}

/** هل الرابط صالح للاتصال بقاعدة البيانات؟ */
export const isDatabaseUrl = (connection: string | undefined | null): boolean => {
  const raw = String(connection || '').trim();
  return raw.startsWith('postgres://') || raw.startsWith('postgresql://');
};
