/**
 * قفل الفترات المحاسبية — منطق نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` كخطوة رابعة في تقسيمه.
 *
 * القاعدة التي يحرسها هذا الملف:
 *   عند إقفال فترة محاسبية حتى تاريخ معيّن، **يُمنع** أي إضافة أو تعديل أو حذف
 *   بتاريخ يقع داخل الفترة المقفلة — إلا بصلاحية المدير العام.
 *   هذا شرط رقابي أساسي: بدونه يمكن تعديل دفاتر سنة مقفلة ومُراجَعة ضريبياً.
 */

import { isDateLockedInPeriod } from '../../services/accountingEngine';
import type { AccountingPeriodLock } from '../../types';

/** سياق إنشاء القفل. */
export interface PeriodLockContext {
  tenantId: string;
  branchId?: string;
  lockedBy: string;
  /** لحظة الإقفال — تُمرَّر للاختبار. */
  now?: string;
}

/** يحصر أقفال الفترات على منشأة واحدة. */
export const scopePeriodLocks = (
  locks: AccountingPeriodLock[],
  tenantId?: string
): AccountingPeriodLock[] => (tenantId ? locks.filter((l) => l.tenantId === tenantId) : locks);

/**
 * أحدث تاريخ إقفال ساري — أو null إن لم توجد فترة مقفلة.
 * الأقفال المتعددة تُحسم بالأحدث: لا معنى لقفل أقدم بعد فتح فترة أحدث.
 */
export const findLatestClosedPeriodDate = (locks: AccountingPeriodLock[]): string | null => {
  const active = locks.filter((l) => l.status === 'locked');
  if (active.length === 0) return null;
  return [...active].sort((a, b) => b.lockDate.localeCompare(a.lockDate))[0]?.lockDate ?? null;
};

/** يبني سجل قفل فترة جديد. */
export const buildPeriodLock = (
  lockDate: string,
  reason: string | undefined,
  ctx: PeriodLockContext
): AccountingPeriodLock => ({
  id: `lock-${Date.now()}`,
  tenantId: ctx.tenantId,
  branchId: ctx.branchId || 'all',
  lockDate,
  lockedAt: ctx.now ?? new Date().toISOString(),
  lockedBy: ctx.lockedBy,
  reason: reason || 'إقفال دوري معتمد للحسابات',
  status: 'locked',
});

/** يفتح قفلاً قائماً (يُبقي السجل للأثر الرقابي ولا يحذفه). */
export const unlockPeriod = (
  locks: AccountingPeriodLock[],
  lockId: string
): AccountingPeriodLock[] =>
  locks.map((l) => (l.id === lockId ? { ...l, status: 'unlocked' as const } : l));

export interface PeriodValidationResult {
  allowed: boolean;
  message?: string;
}

/**
 * هل يُسمح بعملية بتاريخ معيّن؟
 *
 * @param dateLocked نتيجة فحص القفل من محرك المحاسبة
 * @param isAdminUser هل المستخدم مدير عام؟
 * @param overrideAsAdmin تجاوز صريح مطلوب من الواجهة
 */
export const validatePeriodDate = (
  dateLocked: { isLocked: boolean; lockInfo?: { lockDate?: string } },
  isAdminUser: boolean,
  overrideAsAdmin = false
): PeriodValidationResult => {
  if (!dateLocked.isLocked) return { allowed: true };

  if (isAdminUser || overrideAsAdmin) {
    return { allowed: true, message: 'تم التجاوز بصلاحية المدير العام' };
  }

  return {
    allowed: false,
    message:
      `الفترة المحاسبية مقفلة حتى تاريخ (${dateLocked.lockInfo?.lockDate}). ` +
      'لا يمكن إجراء أي تعديل أو مسح أو إضافة بتاريخ يقع في الفترة المقفلة ' +
      'بدون موافقة وصلاحية الأدمن.',
  };
};

/** فحص مركّب: يحصر الأقفال ثم يتحقق من التاريخ. */
export const checkDateAgainstLocks = (
  date: string,
  locks: AccountingPeriodLock[],
  tenantId: string,
  branchId?: string
): { isLocked: boolean; lockInfo?: { lockDate?: string } } =>
  isDateLockedInPeriod(date, locks, tenantId, branchId);
