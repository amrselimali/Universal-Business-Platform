import { describe, expect, it } from 'vitest';
import {
  ACCOUNTING_OPERATIONS,
  REQUIRED_FIELDS,
  SELECTOR_OPTIONS,
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

  it('كل مُحدِّد مستخدم له خيارات معرّفة', () => {
    const missing: string[] = [];
    for (const op of ACCOUNTING_OPERATIONS) {
      for (const field of op.fields) {
        if (field.selector && !SELECTOR_OPTIONS[field.selector]?.length) {
          missing.push(`${op.type}.${field.key}`);
        }
      }
    }
    expect(missing).toEqual([]);
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
