import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_POSTING_RULES } from '../../data/postingRuleDefaults';
import { REQUIRED_FIELDS } from '../../data/accountingOperations';

/**
 * اختبارات تطابق القواعد الافتراضية.
 *
 * سبب وجودها: القواعد موجودة في مكانين — بذور SQL للتركيب من الخارج، وقائمة
 * TypeScript لزر «تهيئة القواعد» داخل الشاشة. أي انحراف بينهما يعني أن منشأة
 * جديدة تُهيَّأ بقواعد مختلفة عن منشأة أُنشئت بالسكربت. الاختبار يمنع ذلك.
 */

describe('القواعد الافتراضية', () => {
  it('لا تكرار في (العملية، الخلية، المُحدِّد)', () => {
    const keys = DEFAULT_POSTING_RULES.map(
      (rule) => `${rule.transactionType}|${rule.fieldKey}|${rule.selectorKey}`
    );
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicates, `مفاتيح مكررة: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('كل قاعدة لها اتجاه صحيح وحساب بصيغة كود', () => {
    const invalid = DEFAULT_POSTING_RULES.filter(
      (rule) => !['debit', 'credit'].includes(rule.direction) || !/^\d{3,6}$/.test(rule.accountCode)
    );
    expect(invalid).toEqual([]);
  });

  it('تُغطي كل الحقول الإلزامية في الكتالوج', () => {
    const covered = new Set(
      DEFAULT_POSTING_RULES.filter((rule) => rule.selectorKey === 'default').map(
        (rule) => `${rule.transactionType}|${rule.fieldKey}`
      )
    );
    // استثناء موثّق: الإهلاك يحتاج حساب «مجمع إهلاك» غير موجود في الدليل القياسي،
    // فبياناته تبقى فجوة ظاهرة حتى ينشئ المالك الحساب ويربطه من الشاشة.
    const documentedGaps = new Set([
      'asset_depreciation|depreciation_expense',
      'asset_depreciation|accumulated_depreciation',
    ]);

    const missing = REQUIRED_FIELDS.filter(
      (required) =>
        !covered.has(`${required.type}|${required.field}`) &&
        !documentedGaps.has(`${required.type}|${required.field}`)
    ).map((required) => `${required.type}.${required.field}`);

    expect(missing, `حقول إلزامية بلا قاعدة افتراضية: ${missing.join(', ')}`).toEqual([]);
  });

  it('مطابقة لبذور SQL (منع انحراف المصدرين)', () => {
    const seedPath = join(process.cwd(), 'scripts', 'neon_posting_rules_seed.sql');
    const sql = readFileSync(seedPath, 'utf8');
    const rows = [...sql.matchAll(/\(\s*'([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z:_]+)',\s*'(debit|credit)',\s*'([0-9]+)'\s*\)/g)].map(
      (match) => `${match[1]}|${match[2]}|${match[3]}|${match[4]}|${match[5]}`
    );

    const current = DEFAULT_POSTING_RULES.map(
      (rule) => `${rule.transactionType}|${rule.fieldKey}|${rule.selectorKey}|${rule.direction}|${rule.accountCode}`
    );

    expect([...rows].sort()).toEqual([...current].sort());
  });
});
