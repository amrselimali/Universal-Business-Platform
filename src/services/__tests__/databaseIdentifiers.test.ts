import { describe, expect, it } from 'vitest';
import {
  assertConfirmation,
  assertIdentifier,
  assertSchema,
  isProtectedTable,
  quoteIdentifier,
  quoteTable,
} from '../databaseIdentifiers';

/**
 * اختبارات حماية أسماء قاعدة البيانات.
 * أي ثغرة هنا = حقن SQL كامل من الواجهة، لذا القواعد صارمة ومختبرة.
 */

describe('assertIdentifier', () => {
  it('يقبل الأسماء اللاتينية الصغيرة والأرقام والشرطة السفلية', () => {
    expect(assertIdentifier('journal_entries')).toBe('journal_entries');
    expect(assertIdentifier('t1')).toBe('t1');
  });

  it('يرفض الحقن والمحارف الخطرة والمسافات', () => {
    for (const bad of ['a; DROP TABLE x', 'a"b', "a'b", 'A', '1abc', 'a-b', 'a b', '']) {
      expect(() => assertIdentifier(bad), bad).toThrow();
    }
  });

  it('يرفض الأسماء الأطول من 63 حرفاً', () => {
    expect(() => assertIdentifier('a'.repeat(64))).toThrow();
  });
});

describe('assertSchema', () => {
  it('يمنع مخططات النظام', () => {
    expect(() => assertSchema('pg_catalog')).toThrow();
    expect(() => assertSchema('information_schema')).toThrow();
    expect(() => assertSchema('pg_toast')).toThrow();
  });

  it('يقبل مخططات التطبيق', () => {
    expect(assertSchema('public')).toBe('public');
    expect(assertSchema('core')).toBe('core');
  });
});

describe('quoting', () => {
  it('يضيف علامات اقتباس مزدوجة', () => {
    expect(quoteIdentifier('accounts')).toBe('"accounts"');
    expect(quoteTable('public', 'accounts')).toBe('"public"."accounts"');
  });
});

describe('التأكيد والحماية', () => {
  it('يتطلب نص تأكيد مطابقاً تماماً', () => {
    expect(() => assertConfirmation('public.t', 'public.t')).not.toThrow();
    expect(() => assertConfirmation('public.t ', 'public.t')).not.toThrow();
    expect(() => assertConfirmation('drop table', 'public.t')).toThrow();
  });

  it('يعرف الجداول الحرجة', () => {
    expect(isProtectedTable('journal_entries')).toBe(true);
    expect(isProtectedTable('accounts')).toBe(true);
    expect(isProtectedTable('my_notes')).toBe(false);
  });
});
