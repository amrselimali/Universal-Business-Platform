import { describe, expect, it } from 'vitest';
import { toEditableLine, validateEditLines, type EditableLine } from '../journalEditHelpers';

/**
 * اختبارات محرّر القيد: لا يُسمح بحفظ تعديل يُفسد الدفاتر.
 * القاعدة: قيد متوازن + سطر واحد الاتجاه + حسابات موجودة + مبالغ موجبة.
 */

const codes = new Set(['1111', '1120', '4100']);
const line = (patch: Partial<EditableLine>): EditableLine => ({
  accountCode: '1111',
  memo: '',
  debit: 0,
  credit: 0,
  ...patch,
});

describe('validateEditLines', () => {
  it('يقبل قيداً متوازناً بحسابين موجودين', () => {
    const result = validateEditLines(
      [line({ accountCode: '1111', debit: 100 }), line({ accountCode: '4100', credit: 100 })],
      codes
    );
    expect(result.ok).toBe(true);
    expect(result.totalDebit).toBe(100);
    expect(result.totalCredit).toBe(100);
  });

  it('يرفض القيد غير المتوازن', () => {
    const result = validateEditLines(
      [line({ accountCode: '1111', debit: 100 }), line({ accountCode: '4100', credit: 90 })],
      codes
    );
    expect(result.ok).toBe(false);
    expect(result.errorsAr.join(' ')).toContain('غير متوازن');
  });

  it('يرفض سطراً مديناً ودائناً معاً', () => {
    const result = validateEditLines(
      [line({ accountCode: '1111', debit: 100, credit: 100 }), line({ accountCode: '4100', credit: 100 })],
      codes
    );
    expect(result.ok).toBe(false);
    expect(result.errorsAr.join(' ')).toContain('مديناً ودائناً');
  });

  it('يرفض حساباً غير موجود في الدليل', () => {
    const result = validateEditLines(
      [line({ accountCode: '9999', debit: 100 }), line({ accountCode: '4100', credit: 100 })],
      codes
    );
    expect(result.ok).toBe(false);
    expect(result.errorsAr.join(' ')).toContain('9999');
  });

  it('يرفض القيم السالبة والسطور الفارغة', () => {
    const result = validateEditLines(
      [line({ accountCode: '1111', debit: -5 }), line({ accountCode: '4100', credit: 0 }), line({ accountCode: '1120', debit: 0, credit: 0 })],
      codes
    );
    expect(result.ok).toBe(false);
    expect(result.errorsAr.some((error) => error.includes('سالبة'))).toBe(true);
    expect(result.errorsAr.some((error) => error.includes('أدخل مبلغاً'))).toBe(true);
  });

  it('يرفض قيداً بأقل من سطرين', () => {
    const result = validateEditLines([line({ accountCode: '1111', debit: 100 })], codes);
    expect(result.ok).toBe(false);
    expect(result.errorsAr.join(' ')).toContain('سطرين');
  });

  it('يحوّل سطر القيد المعروض إلى سطر قابل للتعديل', () => {
    expect(toEditableLine({ accountCode: '1120', accountName: 'العملاء', memo: 'سداد', debit: 0, credit: 50 })).toEqual({
      accountCode: '1120',
      accountName: 'العملاء',
      memo: 'سداد',
      debit: 0,
      credit: 50,
    });
  });
});
