import { beforeEach, describe, expect, it } from 'vitest';
import {
  getEffectiveNeonConnectionString,
  hasNeonConnection,
  isNeonPlaceholder,
} from '../neonConfig';

/**
 * اختبارات إعدادات اتصال Neon — الملف الأمني الحرج.
 *
 * السياق الحقيقي: كان رابط اتصال بدور **المالك** (`neondb_owner`) مكتوباً
 * داخل هذا الملف على مستودع **عام** — أي أن صلاحيات كاملة على قاعدة البيانات
 * كانت مكشوفة للعالم، ومُحزَّمة أيضاً داخل الموقع المنشور.
 *
 * هذه الاختبارات تمنع تكرار ذلك: **لا يجوز أن يوجد أي رابط افتراضي في الكود**.
 */

const installFakeStorage = (initial: Record<string, string> = {}): Map<string, string> => {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as unknown as { localStorage: Partial<Storage> }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  return store;
};

describe('الأمان: لا أسرار في الكود', () => {
  it('الملف لا يحتوي أي رابط اتصال مكتوب', () => {
    // فحص مباشر للمصدر — أهم اختبار أمني في المشروع
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/services/neonConfig.ts'),
      'utf8'
    );

    const hardcoded = source.match(/['"`]postgres(ql)?:\/\/[^'"`\s]+['"`]/g) ?? [];
    expect(
      hardcoded,
      `رابط اتصال مكتوب في الكود — خطر أمني!\n${hardcoded.join('\n')}`
    ).toEqual([]);
  });

  it('الملف لا يحتوي كلمة مرور أو اسم مستخدم مالك', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/services/neonConfig.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/npg_[A-Za-z0-9]+/); // كلمة مرور Neon
    expect(source).not.toContain('neondb_owner');
  });
});

describe('isNeonPlaceholder', () => {
  it('يعتبر الفارغ والقيم الوهمية غير صالحة', () => {
    expect(isNeonPlaceholder('')).toBe(true);
    expect(isNeonPlaceholder(undefined)).toBe(true);
    expect(isNeonPlaceholder(null)).toBe(true);
    expect(isNeonPlaceholder('   ')).toBe(true);
  });

  it('يرفض القيم الوهمية المعروفة', () => {
    expect(isNeonPlaceholder('postgres://user:pass@host/db')).toBe(true);
    expect(isNeonPlaceholder('postgresql://x@ep-cool-snowflake-12345.neon.tech/db')).toBe(true);
    expect(isNeonPlaceholder('postgresql://x@ep-cool-12345.neon.tech/db')).toBe(true);
    expect(isNeonPlaceholder('postgresql://MY_NEON_URL')).toBe(true);
    expect(isNeonPlaceholder('postgresql://CHANGE_ME')).toBe(true);
  });

  it('يقبل الرابط الحقيقي', () => {
    expect(
      isNeonPlaceholder('postgresql://app_api:secret@ep-real-1.eu-central-1.aws.neon.tech/neondb')
    ).toBe(false);
  });
});

describe('getEffectiveNeonConnectionString', () => {
  beforeEach(() => {
    installFakeStorage();
  });

  it('يرجع نصاً فارغاً عند عدم وجود أي إعداد (لا قيمة افتراضية)', () => {
    expect(getEffectiveNeonConnectionString()).toBe('');
    expect(hasNeonConnection()).toBe(false);
  });

  it('يقرأ الرابط من إعدادات المستخدم', () => {
    const url = 'postgresql://app_api:pw@ep-real.eu-central-1.aws.neon.tech/neondb';
    localStorage.setItem('erp_neon_cfg', JSON.stringify({ connectionString: url }));
    expect(getEffectiveNeonConnectionString()).toBe(url);
    expect(hasNeonConnection()).toBe(true);
  });

  it('يتجاهل الرابط المحفوظ إن كان وهمياً', () => {
    localStorage.setItem(
      'erp_neon_cfg',
      JSON.stringify({ connectionString: 'postgresql://user:pass@ep-cool-snowflake-12345.neon.tech/db' })
    );
    expect(getEffectiveNeonConnectionString()).toBe('');
  });

  it('يتجاهل الروابط غير الصحيحة (https مثلاً)', () => {
    localStorage.setItem('erp_neon_cfg', JSON.stringify({ connectionString: 'https://api.example.com' }));
    expect(getEffectiveNeonConnectionString()).toBe('');
  });

  it('يتعامل مع JSON تالف بهدوء', () => {
    localStorage.setItem('erp_neon_cfg', '{ not valid json');
    expect(getEffectiveNeonConnectionString()).toBe('');
  });

  it('يتعامل مع إعدادات بلا حقل connectionString', () => {
    localStorage.setItem('erp_neon_cfg', JSON.stringify({ other: 1 }));
    expect(getEffectiveNeonConnectionString()).toBe('');
  });
});
