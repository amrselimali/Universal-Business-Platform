/**
 * الإشعارات الفورية وقواعد التنبيه — منطق نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` كخطوة خامسة في تقسيمه.
 *
 * المنطق الحرج هنا هو **فلترة الإشعارات لكل مستخدم**:
 *   إشعار يخص فرعاً أو دوراً لا يجب أن يظهر لمستخدم آخر. أي خطأ في هذه
 *   الفلترة = تسريب معلومات تشغيلية (أرقام مبيعات، أرصدة، تنبيهات مخزون).
 */

import type { AppNotification, NotificationRule, UserRole } from '../../types';

/** الحد الأدنى من بيانات المستخدم المطلوب لفلترة الإشعارات. */
export interface NotificationAudience {
  id: string;
  role: UserRole | string;
  isAdmin?: boolean;
  allowedBranchIds?: string[];
}

/** يملأ الرموز `{key}` في نص القالب بقيم الحمولة. */
export const interpolateTemplate = (
  template: string,
  payload: Record<string, unknown>
): string => {
  if (!template) return '';
  return Object.keys(payload).reduce((text, key) => {
    const value = payload[key] === null || payload[key] === undefined ? '' : String(payload[key]);
    return text.split(`{${key}}`).join(value);
  }, template);
};

/**
 * هل يرى هذا المستخدم هذا الإشعار؟
 *
 * القواعد بالترتيب:
 *   1. المدير العام (SuperAdmin / isAdmin) يرى كل شيء.
 *   2. لو الإشعار مقيّد بفرع، يجب أن يكون ضمن فروع المستخدم (أو '*').
 *   3. لو الإشعار موجَّه لمستخدمين بالاسم، الظهور لهم حصراً + للأدوار المستهدفة.
 *   4. لو الإشعار موجَّه لأدوار، يجب أن يكون دور المستخدم ضمنها (أو '*').
 */
export const canUserSeeNotification = (
  notification: AppNotification,
  user: NotificationAudience
): boolean => {
  if (user.isAdmin || user.role === 'SuperAdmin') return true;

  // 1) قيد الفرع
  if (
    notification.branchId &&
    notification.branchId !== 'all' &&
    user.allowedBranchIds &&
    !user.allowedBranchIds.includes('*') &&
    !user.allowedBranchIds.includes(notification.branchId)
  ) {
    return false;
  }

  // 2) موجَّه لمستخدم بعينه
  if (
    notification.targetUserIds &&
    notification.targetUserIds.length > 0 &&
    notification.targetUserIds.includes(user.id)
  ) {
    return true;
  }

  // 3) موجَّه لدور
  if (notification.targetRoles && notification.targetRoles.length > 0) {
    return (
      notification.targetRoles.includes(user.role as UserRole) ||
      notification.targetRoles.includes('*' as UserRole)
    );
  }

  return true;
};

/** يحصر الإشعارات الظاهرة لمستخدم معيّن. */
export const filterNotificationsForUser = (
  notifications: AppNotification[],
  user: NotificationAudience | null | undefined
): AppNotification[] =>
  user ? notifications.filter((n) => canUserSeeNotification(n, user)) : notifications;

/** عدد الإشعارات غير المقروءة. */
export const countUnread = (notifications: AppNotification[]): number =>
  notifications.filter((n) => !n.isRead).length;

export interface NotificationContext {
  tenantId: string;
  branchId?: string;
  now?: string;
}

/** يبني إشعاراً كاملاً من قاعدة تنبيه + حمولة الأحداث. */
export const buildNotificationFromRule = (
  rule: NotificationRule,
  payload: Record<string, unknown>,
  ctx: NotificationContext
): AppNotification => ({
  id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  ruleCode: rule.code,
  category: rule.category,
  severity: rule.severity,
  titleAr: rule.nameAr,
  titleEn: rule.nameEn,
  messageAr: interpolateTemplate(rule.templateMessageAr, payload),
  messageEn: interpolateTemplate(rule.templateMessageEn, payload),
  timestamp: ctx.now ?? new Date().toISOString(),
  isRead: false,
  targetRoles: rule.targetRoles,
  targetUserIds: rule.targetUserIds,
  branchId: String(payload.branchId ?? rule.targetBranchId ?? ctx.branchId ?? ''),
  actionUrl: rule.actionUrl,
  metadata: payload,
});

/** هل تُشغِّل هذه القاعدة تنبيهاً صوتياً؟ */
export const rulePlaysSound = (rule: NotificationRule): boolean =>
  Boolean(rule.soundAlert) || rule.channels.includes('sound');

/** هل تُشغِّل هذه القاعدة نافذة منبثقة (Toast)؟ */
export const ruleShowsToast = (rule: NotificationRule): boolean => rule.channels.includes('popup');

// ---------------------------------------------------------------------------
// عمليات غير مُعدِّلة للمصفوفة (Immutable)
// ---------------------------------------------------------------------------

export const markOneRead = (
  notifications: AppNotification[],
  notificationId: string,
  now: string = new Date().toISOString()
): AppNotification[] =>
  notifications.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: now } : n));

export const markAllRead = (
  notifications: AppNotification[],
  now: string = new Date().toISOString()
): AppNotification[] => notifications.map((n) => ({ ...n, isRead: true, readAt: now }));

export const removeNotification = (
  notifications: AppNotification[],
  notificationId: string
): AppNotification[] => notifications.filter((n) => n.id !== notificationId);

/** يضيف إشعاراً جديداً في المقدمة. */
export const prependNotification = (
  notifications: AppNotification[],
  notification: AppNotification
): AppNotification[] => [notification, ...notifications];
