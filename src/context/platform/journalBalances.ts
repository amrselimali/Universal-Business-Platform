/**
 * أرصدة الحسابات وقيود اليومية — منطق نقي
 * ---------------------------------------------------------------------------
 * فُصل من `PlatformContext.tsx` (12,300 سطر) كخطوة ثانية في تقسيمه.
 *
 * القاعدة المحاسبية التي يحرسها هذا الملف:
 *   رصيد الحساب = مجموع (مدين − دائن) للحسابات المدينة الطبيعة،
 *   و(دائن − مدين) للحسابات الدائنة الطبيعة. والعكس يقلب الإشارة.
 *
 * كون الدوال نقية (لا تلمس React ولا الشبكة) يجعلها قابلة للاختبار مباشرة،
 * وهو ما كان مستحيلاً وهي داخل ملف بحجم 12,300 سطر.
 */

import type { Account, JournalLine } from '../../types';

/** يحسب أثر سطر قيد واحد على رصيد حساب حسب طبيعته. */
export const lineDeltaForAccount = (line: JournalLine, account: Account): number => {
  const debit = Number(line.debit) || 0;
  const credit = Number(line.credit) || 0;
  return account.isDebitNormal ? debit - credit : credit - debit;
};

/** هل السطر يخص هذا الحساب؟ */
export const lineBelongsToAccount = (line: JournalLine, account: Account): boolean =>
  line.accountId === account.id;

/**
 * يُعيد مصفوفة حسابات جديدة بعد تطبيق أسطر قيد عليها.
 * لا يُعدّل المصفوفة الأصلية (Immutable) — شرط أساسي لعمل React بشكل صحيح.
 *
 * @param reverse عكس الأثر — يُستخدم عند حذف قيد مرحَّل أو عمل قيد عكسي.
 */
export const applyJournalLinesToAccounts = (
  accounts: Account[],
  lines: JournalLine[],
  reverse = false
): Account[] => {
  if (!lines || lines.length === 0) return accounts;

  // تجميع الأثر مسبقاً لكل حساب بدل تكرار الفلترة داخل الحلقة.
  const deltaByAccount = new Map<string, number>();
  for (const line of lines) {
    const accountId = String(line.accountId ?? '');
    if (!accountId) continue;
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    deltaByAccount.set(accountId, (deltaByAccount.get(accountId) ?? 0) + (debit - credit));
  }

  if (deltaByAccount.size === 0) return accounts;

  let changed = false;
  const next = accounts.map((account) => {
    const netDebitMinusCredit = deltaByAccount.get(account.id);
    if (netDebitMinusCredit === undefined) return account;

    // الحساب الدائن الطبيعة يزيد بالدائن لا بالمدين.
    let delta = account.isDebitNormal ? netDebitMinusCredit : -netDebitMinusCredit;
    if (reverse) delta = -delta;

    changed = true;
    return {
      ...account,
      balance: Number(((Number(account.balance) || 0) + delta).toFixed(2)),
    };
  });

  return changed ? next : accounts;
};

/** إجمالي المدين والدائن لأسطر قيد — يُستخدم للتحقق من التوازن. */
export const sumJournalLines = (lines: JournalLine[]): { debit: number; credit: number } =>
  (lines || []).reduce(
    (acc, line) => ({
      debit: acc.debit + (Number(line.debit) || 0),
      credit: acc.credit + (Number(line.credit) || 0),
    }),
    { debit: 0, credit: 0 }
  );

/** هل القيد متوازن؟ (الفرق أقل من نصف قرش لتجنّب أخطاء الفاصلة العائمة) */
export const isJournalBalanced = (lines: JournalLine[]): boolean => {
  const { debit, credit } = sumJournalLines(lines);
  return Math.abs(debit - credit) < 0.005;
};

/** رصيد حساب واحد بعد تطبيق مجموعة أسطر (بلا تعديل الأصل). */
export const balanceAfterLines = (
  account: Account,
  lines: JournalLine[],
  reverse = false
): number => {
  const updated = applyJournalLinesToAccounts([account], lines, reverse);
  return updated[0]?.balance ?? account.balance;
};
