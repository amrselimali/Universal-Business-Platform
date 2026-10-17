import { describe, expect, it } from 'vitest';
import {
  ACCOUNTING_OPERATIONS,
  REQUIRED_FIELDS,
  paymentSelectorChain,
  paymentSelectorOptions,
  selectorChainForValue,
  computeCoverage,
  findOperation,
} from '../../data/accountingOperations';

/**
 * اختبارات كتالوج الترحيل وفحص التغطية.
 *
 * الأهمية: الكتالوج هو "خريطة كل رقم في النظام". لو ظهرت عملية في الواجهة
 * وغير موجودة هنا، فلا يمكن ربط خلاياها بقاعدة — أي أن ترحيلها سيُرفض أو،
 * أسوأ، سيبقى بلا توجيه. هذه الاختبارات تحرس اتساق الخريطة نفسها.
 */

describe('كتالوج العمليات المحاسبية', () => {
  it('كل عملية لها معرّف فريد ونوع صحيح', () => {
    const types = ACCOUNTING_OPERATIONS.map((op) => op.type);
    expect(new Set(types).size).toBe(types.length);
    const invalid = types.filter((type) => !/^[a-z][a-z0-9_]*$/.test(type));
    expect(invalid).toEqual([]);
  });

  it('كل عملية لها اسم عربي/إنجليزي وشاشة مصدر', () => {
    const incomplete = ACCOUNTING_OPERATIONS.filter(
      (op) => !op.labelAr || !op.labelEn || !op.screenAr || !op.screenEn
    ).map((op) => op.type);
    expect(incomplete).toEqual([]);
  });

  it('لا تتكرر خلية داخل نفس العملية', () => {
    const duplicates: string[] = [];
    for (const op of ACCOUNTING_OPERATIONS) {
      const keys = op.fields.map((field) => field.key);
      keys.forEach((key, index) => {
        if (keys.indexOf(key) !== index) duplicates.push(`${op.type}.${key}`);
      });
    }
    expect(duplicates).toEqual([]);
  });

  it('كل عملية لها خليتان على الأقل (مدين ودائن)', () => {
    const thin = ACCOUNTING_OPERATIONS.filter((op) => op.fields.length < 2).map((op) => op.type);
    expect(thin).toEqual([]);
  });

  it('كل مُحدِّد مستخدم له نوع معروف', () => {
    const unknown = ACCOUNTING_OPERATIONS.flatMap((op) =>
      op.fields.filter((field) => field.selector && field.selector !== 'payment_method')
        .map((field) => `${op.type}.${field.key}`)
    );
    expect(unknown).toEqual([]);
  });

  it('سلسلة أولوية طريقة الدفع: الطريقة ← نوعها ← المجموعة ← الافتراضي', () => {
    expect(paymentSelectorChain({ id: 'pm-1', nameAr: 'خزينة', type: 'Cash' })).toEqual([
      'pm:pm-1', 'pmt:cash', 'cash', 'default',
    ]);
    expect(paymentSelectorChain({ id: 'pm-2', nameAr: 'بنك', type: 'Transfer' })).toEqual([
      'pm:pm-2', 'pmt:transfer', 'bank', 'default',
    ]);
    expect(paymentSelectorChain(null)).toEqual(['default']);
  });

  it('خيارات الشاشة تشمل كل طريقة فعلية + الأنواع + المجموعتين + الافتراضي', () => {
    const options = paymentSelectorOptions([
      { id: 'pm-1', nameAr: 'خزينة الفرع', type: 'Cash' },
      { id: 'pm-2', nameAr: 'بنك مصر', type: 'Transfer' },
      { id: 'pm-3', nameAr: 'محفظة', type: 'Wallet' },
    ]).map((option) => option.key);

    expect(options).toContain('default');
    expect(options).toContain('cash');
    expect(options).toContain('bank');
    expect(options).toContain('pmt:cash');
    expect(options).toContain('pmt:transfer');
    expect(options).toContain('pmt:wallet');
    expect(options).toContain('pm:pm-1');
    expect(options).toContain('pm:pm-2');
    expect(options).toContain('pm:pm-3');
  });

  it('تحويل اختيار الواجهة إلى سلسلة: طريقة محددة تُقدَّم على المجموعة', () => {
    const methods = [{ id: 'pm-9', nameAr: 'فيزا', type: 'Card' }];
    expect(selectorChainForValue('pm:pm-9', methods)).toEqual(['pm:pm-9', 'pmt:card', 'bank', 'default']);
    expect(selectorChainForValue('cash', methods)).toEqual(['cash', 'default']);
    expect(selectorChainForValue('', methods)).toEqual(['default']);
  });

  it('الحقول الإلزامية موجودة في الكتالوج وعددها منطقي', () => {
    expect(REQUIRED_FIELDS.length).toBeGreaterThanOrEqual(20);
    for (const required of REQUIRED_FIELDS) {
      const op = findOperation(required.type);
      expect(op, `عملية غير معروفة: ${required.type}`).toBeTruthy();
      expect(op!.fields.some((field) => field.key === required.field && field.required)).toBe(true);
    }
  });
});

describe('فحص التغطية', () => {
  it('بلا قواعد: كل الحقول الإلزامية فجوات', () => {
    const coverage = computeCoverage([]);
    expect(coverage.total).toBe(REQUIRED_FIELDS.length);
    expect(coverage.covered).toBe(0);
    expect(coverage.gaps).toHaveLength(REQUIRED_FIELDS.length);
  });

  it('بتغطية كاملة: لا فجوات', () => {
    const rules = REQUIRED_FIELDS.map((required) => ({
      transactionType: required.type,
      fieldKey: required.field,
      isActive: true,
    }));
    const coverage = computeCoverage(rules);
    expect(coverage.gaps).toEqual([]);
    expect(coverage.covered).toBe(coverage.total);
  });

  it('القاعدة المعطّلة لا تُحسب تغطية', () => {
    const rules = REQUIRED_FIELDS.map((required) => ({
      transactionType: required.type,
      fieldKey: required.field,
      isActive: false,
    }));
    const coverage = computeCoverage(rules);
    expect(coverage.covered).toBe(0);
  });

  it('قاعدة لخلية واحدة تكفيها فقط', () => {
    const target = REQUIRED_FIELDS[0];
    const coverage = computeCoverage([
      { transactionType: target.type, fieldKey: target.field, isActive: true },
    ]);
    expect(coverage.covered).toBe(1);
    expect(coverage.gaps.map((gap) => `${gap.type}.${gap.field}`)).not.toContain(
      `${target.type}.${target.field}`
    );
  });
});
