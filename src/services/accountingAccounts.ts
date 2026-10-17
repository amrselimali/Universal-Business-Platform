/**
 * اختيار الحساب من دليل الحسابات (Account resolution)
 * ---------------------------------------------------------------------------
 * فُصل من `accountingEngine.ts` (711 سطراً) التزاماً بحد 300 سطر ولأن هذا
 * المنطق هو نقطة الخطر المحاسبية: اختيار حساب خطأ يعني قيداً في غير موضعه.
 *
 * القاعدة الحاكمة: لا سقوط صامت إلى "أول حساب في الدليل"؛ غياب أي مطابقة
 * = خطأ صريح يُعرض للمستخدم ويُصلح من شاشة «ربط العمليات بالقيود».
 *
 * ملاحظة معمارية: المصدر النهائي للحساب هو قواعد الترحيل في
 * `accounting_posting_rules` عبر `fn_post_document`. هذه الدالة تخدم المسارات
 * القديمة أثناء الترحيل التدريجي، ولا تُستخدم في المسار الجديد.
 */

import type { Account } from '../types';

export function resolveAccount(
  accounts: Account[],
  preferredAccountId?: string,
  fallbackCode?: string,
  fallbackType?: 'Asset' | 'Liability' | 'Revenue' | 'Expense'
): Account {
  if (preferredAccountId) {
    const found = accounts.find((a) => a.id === preferredAccountId);
    if (found) return found;
  }
  if (fallbackCode) {
    const foundCode = accounts.find((a) => a.code === fallbackCode || a.code.startsWith(fallbackCode));
    if (foundCode) return foundCode;
  }
  if (fallbackType) {
    const foundType = accounts.find((a) => a.type === fallbackType);
    if (foundType) return foundType;
  }
  throw new Error(
    `تعذر تحديد الحساب المحاسبي (${fallbackCode ?? fallbackType ?? 'بدون مرجع'}) — ` +
      'اربط الخلية بقاعدة ترحيل من شاشة «ربط العمليات بالقيود».'
  );
}
