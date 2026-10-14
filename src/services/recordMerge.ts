/**
 * منطق الدمج والتزامن المتفائل (Record merge & optimistic concurrency).
 *
 * فُصل من `recordSync.ts` لأنه أكبر ملف في طبقة الخدمات، ولأن هذا المنطق
 * **نقي** (Pure) لا يعتمد على الشبكة ولا على قاعدة البيانات — فيسهل اختباره.
 *
 * قاعدة الحسم عند تعارض تعديلين على نفس السجل:
 *   1. عمود `version` الرقمي — إن وُجد على الطرفين. قرار قاطع لا يعتمد على
 *      ساعات الأجهزة ولا على دقّة التوقيت. الأكبر رقماً هو الأحدث.
 *   2. `updated_at` كاحتياطي فقط للبيانات القديمة التي لا تحمل إصداراً.
 */

export interface SyncRecord {
  id: string;
  version?: number;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

const recordId = (record: any, index: number, docKey: string): string =>
  String(record?.id ?? `${docKey}-${index}`);

/** السجلات التي تغيّر محتواها عن النسخة المتزامنة السابقة. */
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

/** يدمج سجلات الخادم في المصفوفة المحلية دون فقدان أي تعديل. */
export function mergeRecords(local: any[], incoming: SyncRecord[], deletedIds: string[]): any[] {
  const byId = new Map<string, any>();
  local.forEach((record, index) => byId.set(recordId(record, index, 'local'), record));
  deletedIds.forEach((id) => byId.delete(id));

  incoming.forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
      return;
    }

    // 1) المقارنة الحاسمة بالإصدار الرقمي
    const incomingVersion = Number(record.version);
    const existingVersion = Number(existing.version);
    if (Number.isFinite(incomingVersion) && Number.isFinite(existingVersion)) {
      if (incomingVersion >= existingVersion) byId.set(record.id, record);
      return;
    }

    // 2) احتياطي: المقارنة الزمنية للبيانات القديمة بدون version
    const incomingTime = String(record.updated_at || '');
    const existingTime = String(existing.updated_at || '');
    if (!existingTime || (incomingTime && incomingTime >= existingTime)) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()];
}

/**
 * هل التعديل المحلي أقدم من إصدار الخادم؟
 * يُستخدم لإظهار تحذير تعارض حقيقي للمستخدم بدل الكتابة فوق عمله بصمت.
 */
export function hasVersionConflict(
  localRecord: any,
  serverRecord: SyncRecord | undefined
): boolean {
  if (!serverRecord) return false;
  const localVersion = Number(localRecord?.version);
  const serverVersion = Number(serverRecord.version);
  if (!Number.isFinite(localVersion) || !Number.isFinite(serverVersion)) return false;
  return serverVersion > localVersion;
}
