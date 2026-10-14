/**
 * سجل التدقيق ونشاط المستخدمين — منطق نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` (12,288 سطر) كخطوة ثالثة في تقسيمه.
 *
 * لماذا هذا المنطق بالذات؟
 *   لأن سجل التدقيق **دليل قانوني**. لو تلاعب أحدهم بالمستخدم المنفّذ أو
 *   بتوقيت الحركة، يسقط الدليل. عزله في دوال نقية يجعله قابلاً للاختبار
 *   ويضمن أن كل سجل يحمل: من نفّذ، وأي منشأة، وأي فرع، ومتى — دائماً.
 */

import type { AuditRecord, UserActivityLog } from '../../types';

/** سياق التنفيذ المطلوب لتسجيل أي حركة. */
export interface AuditContext {
  tenantId: string;
  branchId?: string;
  userId: string;
  userName: string;
  userRole?: string;
  /** لحظة التسجيل — تُمرَّر للاختبار، وإلا تُستخدم الساعة الحالية. */
  now?: string;
}

/** نوع الحركة بلا الحقول التي يولّدها النظام. */
export type AuditInput = Omit<
  AuditRecord,
  'id' | 'tenantId' | 'performedById' | 'performedByName' | 'timestamp'
>;

export interface ActivityInput {
  screenId: string;
  screenNameAr: string;
  screenNameEn: string;
  actionNameAr: string;
  actionNameEn: string;
  details: string;
}

/** معرّف فريد مقروء — الطابع الزمني + عشوائي يمنع التصادم عند التسجيل المتوازي. */
export const makeLogId = (prefix: string, seed: number = Date.now()): string =>
  `${prefix}-${seed}-${Math.random().toString(36).substring(2, 6)}`;

/** يُسجّل حركة تدقيق كاملة السياق (لا يقبل حقولاً ناقصة). */
export const buildAuditRecord = (input: AuditInput, ctx: AuditContext): AuditRecord => ({
  ...input,
  id: makeLogId('audit'),
  tenantId: ctx.tenantId,
  branchId: ctx.branchId,
  performedById: ctx.userId,
  performedByName: ctx.userName,
  timestamp: ctx.now ?? new Date().toISOString(),
});

/** يُسجّل نشاط مستخدم كامل السياق. */
export const buildActivityLog = (input: ActivityInput, ctx: AuditContext): UserActivityLog => ({
  id: makeLogId('log'),
  tenantId: ctx.tenantId,
  branchId: ctx.branchId,
  userId: ctx.userId,
  userName: ctx.userName,
  userRole: ctx.userRole || 'SuperAdmin',
  screenId: input.screenId,
  screenNameAr: input.screenNameAr,
  screenNameEn: input.screenNameEn,
  actionNameAr: input.actionNameAr,
  actionNameEn: input.actionNameEn,
  details: input.details,
  timestamp: ctx.now ?? new Date().toISOString(),
});

/** يحصر سجلات التدقيق على منشأة واحدة (عزل المستأجرين). */
export const scopeAuditRecords = (records: AuditRecord[], tenantId?: string): AuditRecord[] =>
  tenantId ? records.filter((r) => r.tenantId === tenantId) : records;

/** يحصر سجل النشاط على منشأة واحدة. */
export const scopeActivityLogs = (
  logs: UserActivityLog[],
  tenantId?: string
): UserActivityLog[] => (tenantId ? logs.filter((l) => l.tenantId === tenantId) : logs);

/**
 * يقصّ السجل لآخر N حركة (الأحدث أولاً).
 * سجل التدقيق ينمو بلا حد، وتحميله كاملاً في الواجهة يُبطئ التطبيق.
 */
export const takeRecent = <T extends { timestamp: string }>(items: T[], count: number): T[] =>
  [...items].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, count);
