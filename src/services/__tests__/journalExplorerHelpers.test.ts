import { describe, expect, it } from 'vitest';
import {
  filterJournals,
  summarizeJournals,
  toJournalEntryView,
} from '../journalExplorerHelpers';

/**
 * اختبارات مستكشف القيود (قراءة فقط).
 *
 * الأهمية: الشاشة تعرض أرقاماً مالية حقيقية. أي خطأ في قراءة السطور (تسمية
 * camelCase مقابل snake_case) أو في حساب التوازن يعطي انطباعاً كاذباً عن الدفاتر.
 */

const row = {
  id: 'je-1',
  entry_number: 'JV-0001',
  entry_date: '2026-10-01T00:00:00',
  description: 'تحصيل من عميل',
  is_posted: true,
  version: 2,
  updated_by: 'admin',
  payload: {
    sourceDocument: 'إيصال 55',
    lines: [
      { accountCode: '1111', accountNameAr: 'الخزينة', memo: 'قبض', debit: 100, credit: 0 },
      { accountId: 'a2', account_code: '1120', account_name_ar: 'العملاء', memo: 'سداد', debit: 0, credit: 100 },
    ],
  },
};

describe('toJournalEntryView', () => {
  it('يقرأ السطور بأي تسمية (camelCase و snake_case)', () => {
    const entry = toJournalEntryView(row, ['customer_collection.collected_amount.cash']);
    expect(entry.lines).toHaveLength(2);
    expect(entry.lines[1].accountCode).toBe('1120');
    expect(entry.lines[1].accountName).toBe('العملاء');
    expect(entry.totalDebit).toBe(100);
    expect(entry.totalCredit).toBe(100);
    expect(entry.isBalanced).toBe(true);
    expect(entry.ruleCodes).toEqual(['customer_collection.collected_amount.cash']);
    expect(entry.entryDate).toBe('2026-10-01');
    expect(entry.sourceDocument).toBe('إيصال 55');
  });

  it('يكشف القيد غير المتوازن', () => {
    const broken = { ...row, payload: { lines: [{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }] } };
    const entry = toJournalEntryView(broken);
    expect(entry.isBalanced).toBe(false);
  });

  it('يتحمل قيداً بلا سطور دون انهيار', () => {
    const entry = toJournalEntryView({ id: 'x', payload: {} });
    expect(entry.lines).toEqual([]);
    expect(entry.totalDebit).toBe(0);
    expect(entry.isBalanced).toBe(true);
  });
});

describe('filterJournals', () => {
  const entries = [
    toJournalEntryView(row),
    toJournalEntryView({ ...row, id: 'je-2', entry_number: 'JV-0002', entry_date: '2026-09-01', description: 'مصروف إيجار' }),
  ];

  it('يفلتر بالبحث النصي في البيان والحساب', () => {
    expect(filterJournals(entries, { search: 'إيجار', dateFrom: '', dateTo: '' })).toHaveLength(1);
    expect(filterJournals(entries, { search: '1120', dateFrom: '', dateTo: '' })).toHaveLength(2);
  });

  it('يفلتر بنطاق التاريخ', () => {
    const filtered = filterJournals(entries, { search: '', dateFrom: '2026-09-15', dateTo: '' });
    expect(filtered.map((entry) => entry.id)).toEqual(['je-1']);
  });

  it('بلا فلاتر يعيد الكل', () => {
    expect(filterJournals(entries, { search: '', dateFrom: '', dateTo: '' })).toHaveLength(2);
  });
});

describe('summarizeJournals', () => {
  it('يحسب الإجماليات وعدد غير المتوازن ونطاق التواريخ', () => {
    const entries = [
      toJournalEntryView(row),
      toJournalEntryView({ ...row, id: 'je-2', entry_number: 'JV-0002', entry_date: '2026-09-01' }),
    ];
    const summary = summarizeJournals(entries);
    expect(summary.count).toBe(2);
    expect(summary.totalDebit).toBe(200);
    expect(summary.totalCredit).toBe(200);
    expect(summary.unbalanced).toBe(0);
    expect(summary.earliest).toBe('2026-09-01');
    expect(summary.latest).toBe('2026-10-01');
  });
});
