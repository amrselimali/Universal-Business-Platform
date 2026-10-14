import { describe, expect, it } from 'vitest';
import {
  applyJournalLinesToAccounts,
  balanceAfterLines,
  isJournalBalanced,
  lineBelongsToAccount,
  lineDeltaForAccount,
  sumJournalLines,
} from '../journalBalances';
import type { Account, JournalLine } from '../../../types';

const buildAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'acc-1',
    tenantId: 't1',
    code: '1000',
    nameAr: 'حساب',
    nameEn: 'Account',
    type: 'Asset',
    balance: 0,
    isDebitNormal: true,
    level: 1,
    ...overrides,
  }) as Account;

const buildLine = (overrides: Partial<JournalLine> = {}): JournalLine =>
  ({
    id: 'line-1',
    accountId: 'acc-1',
    accountCode: '1000',
    accountNameAr: 'حساب',
    accountNameEn: 'Account',
    debit: 0,
    credit: 0,
    ...overrides,
  }) as JournalLine;

describe('lineDeltaForAccount', () => {
  it('الحساب المدين الطبيعة يزيد بالمدين', () => {
    const acc = buildAccount({ isDebitNormal: true });
    expect(lineDeltaForAccount(buildLine({ debit: 100 }), acc)).toBe(100);
    expect(lineDeltaForAccount(buildLine({ credit: 40 }), acc)).toBe(-40);
  });

  it('الحساب الدائن الطبيعة يزيد بالدائن', () => {
    const acc = buildAccount({ isDebitNormal: false });
    expect(lineDeltaForAccount(buildLine({ credit: 100 }), acc)).toBe(100);
    expect(lineDeltaForAccount(buildLine({ debit: 40 }), acc)).toBe(-40);
  });

  it('يتعامل مع القيم غير الرقمية كصفر', () => {
    const acc = buildAccount();
    expect(lineDeltaForAccount(buildLine({ debit: undefined as any }), acc)).toBe(0);
  });
});

describe('lineBelongsToAccount', () => {
  it('يطابق بالمعرّف فقط', () => {
    const acc = buildAccount({ id: 'acc-9' });
    expect(lineBelongsToAccount(buildLine({ accountId: 'acc-9' }), acc)).toBe(true);
    expect(lineBelongsToAccount(buildLine({ accountId: 'acc-1' }), acc)).toBe(false);
  });
});

describe('applyJournalLinesToAccounts', () => {
  it('يطبّق المدين على حساب مدين الطبيعة', () => {
    const accounts = [buildAccount({ id: 'a', balance: 500, isDebitNormal: true })];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: 'a', debit: 250 }),
    ]);
    expect(result[0].balance).toBe(750);
  });

  it('يطبّق الدائن على حساب دائن الطبيعة (زيادة)', () => {
    const accounts = [buildAccount({ id: 'a', balance: 100, isDebitNormal: false })];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: 'a', credit: 300 }),
    ]);
    expect(result[0].balance).toBe(400);
  });

  it('لا يُعدّل الحسابات غير المرتبطة بالقيود', () => {
    const accounts = [
      buildAccount({ id: 'a', balance: 100 }),
      buildAccount({ id: 'b', balance: 999 }),
    ];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: 'a', debit: 50 }),
    ]);
    expect(result.find((x) => x.id === 'b')?.balance).toBe(999);
  });

  it('لا يُعدّل المصفوفة الأصلية (Immutability)', () => {
    const accounts = [buildAccount({ id: 'a', balance: 100 })];
    const snapshot = JSON.parse(JSON.stringify(accounts));
    applyJournalLinesToAccounts(accounts, [buildLine({ accountId: 'a', debit: 50 })]);
    expect(accounts).toEqual(snapshot);
  });

  it('يعكس الأثر عند reverse (لحذف قيد مرحَّل أو قيد عكسي)', () => {
    const accounts = [buildAccount({ id: 'a', balance: 750, isDebitNormal: true })];
    const result = applyJournalLinesToAccounts(
      accounts,
      [buildLine({ accountId: 'a', debit: 250 })],
      true
    );
    expect(result[0].balance).toBe(500);
  });
});

describe('applyJournalLinesToAccounts — حالات إضافية', () => {
  it('يجمع عدة أسطر على نفس الحساب', () => {
    const accounts = [buildAccount({ id: 'a', balance: 0 })];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: 'a', debit: 100 }),
      buildLine({ accountId: 'a', debit: 50 }),
      buildLine({ accountId: 'a', credit: 30 }),
    ]);
    expect(result[0].balance).toBe(120);
  });

  it('يتجاهل الأسطر بلا معرّف حساب', () => {
    const accounts = [buildAccount({ id: 'a', balance: 10 })];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: '', debit: 99 }),
    ]);
    expect(result[0].balance).toBe(10);
  });

  it('يرجع نفس المصفوفة عند عدم وجود أسطر (تحسين أداء)', () => {
    const accounts = [buildAccount()];
    expect(applyJournalLinesToAccounts(accounts, [])).toBe(accounts);
  });

  it('يرجع نفس المصفوفة عند عدم وجود أثر فعلي', () => {
    const accounts = [buildAccount({ id: 'a' })];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: 'other', debit: 10 }),
    ]);
    expect(result).toBe(accounts);
  });

  it('يقرّب الرصيد إلى قرشين (يمنع أخطاء الفاصلة العائمة)', () => {
    const accounts = [buildAccount({ id: 'a', balance: 0.1 })];
    const result = applyJournalLinesToAccounts(accounts, [
      buildLine({ accountId: 'a', debit: 0.2 }),
    ]);
    expect(result[0].balance).toBe(0.3);
  });
});

describe('sumJournalLines و isJournalBalanced', () => {
  it('يجمع المدين والدائن', () => {
    const lines = [buildLine({ debit: 100 }), buildLine({ credit: 60 }), buildLine({ credit: 40 })];
    expect(sumJournalLines(lines)).toEqual({ debit: 100, credit: 100 });
  });

  it('يعتبر القيد متوازناً عند التساوي', () => {
    expect(isJournalBalanced([buildLine({ debit: 100 }), buildLine({ credit: 100 })])).toBe(true);
  });

  it('يرفض القيد غير المتوازن', () => {
    expect(isJournalBalanced([buildLine({ debit: 100 }), buildLine({ credit: 90 })])).toBe(false);
  });

  it('يتسامح مع فروق أقل من نصف قرش', () => {
    expect(isJournalBalanced([buildLine({ debit: 100 }), buildLine({ credit: 99.999 })])).toBe(true);
  });

  it('يتعامل مع مصفوفة فارغة', () => {
    expect(sumJournalLines([])).toEqual({ debit: 0, credit: 0 });
    expect(isJournalBalanced([])).toBe(true);
  });
});

describe('balanceAfterLines', () => {
  it('يحسب الرصيد بلا تعديل الحساب الأصلي', () => {
    const account = buildAccount({ balance: 100 });
    expect(balanceAfterLines(account, [buildLine({ accountId: account.id, debit: 25 })])).toBe(125);
    expect(account.balance).toBe(100);
  });
});
