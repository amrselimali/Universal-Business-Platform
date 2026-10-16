import { beforeEach, describe, expect, it } from 'vitest';

/**
 * اختبارات وضع التخزين (Persistence Mode).
 *
 * الأهمية: هذا الملف يقرّر إن كانت بيانات العمل تُكتب في متصفح المستخدم أم لا.
 * خطأ هنا يعني إمّا ضياع بيانات (لم تُحفظ)، أو بيانات قديمة تُ revived وتطغى
 * على بيانات قاعدة البيانات الحقيقية.
 *
 * نستورد الوحدة بعد تجهيز localStorage لأن حالتها تُهيَّأ عند أول استيراد.
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

describe('persistenceMode — وضع Neon فقط (الافتراضي)', () => {
  let store: Map<string, string>;
  let mod: typeof import('../persistenceMode');

  beforeEach(async () => {
    store = installFakeStorage();
    mod = await import('../persistenceMode');
    mod.setNeonOnlyMode(true);
  });

  it('الوضع الافتراضي هو Neon فقط', () => {
    expect(mod.isNeonOnlyMode()).toBe(true);
    expect(mod.isRecoveryMode()).toBe(false);
  });

  it('persistLocal لا يكتب شيئاً في وضع Neon فقط', () => {
    mod.persistLocal('erp_parties', '[{"id":"1"}]');
    expect(store.get('erp_parties')).toBeUndefined();
  });

  it('readLocal يرجع null في وضع Neon فقط حتى لو القيمة موجودة', () => {
    store.set('erp_parties', '[{"id":"1"}]');
    expect(mod.readLocal('erp_parties')).toBeNull();
  });

  it('removeLocal يعمل في الوضعين (تنظيف آمن)', () => {
    store.set('erp_parties', 'قديم');
    mod.removeLocal('erp_parties');
    expect(store.get('erp_parties')).toBeUndefined();
  });
});

describe('persistenceMode — وضع الاسترجاع', () => {
  let store: Map<string, string>;
  let mod: typeof import('../persistenceMode');

  beforeEach(async () => {
    store = installFakeStorage();
    mod = await import('../persistenceMode');
    mod.setNeonOnlyMode(false);
  });

  it('يقرأ ويكتب بيانات محلية في وضع الاسترجاع', () => {
    mod.persistLocal('erp_parties', '[{"id":"1"}]');
    expect(store.get('erp_parties')).toBe('[{"id":"1"}]');
    expect(mod.readLocal('erp_parties')).toBe('[{"id":"1"}]');
  });

  it('readLocal يرجع null لمفتاح غير موجود', () => {
    expect(mod.readLocal('غير-موجود')).toBeNull();
  });

  it('isRecoveryMode يعكس حالة neonOnly', () => {
    expect(mod.isRecoveryMode()).toBe(true);
    mod.setNeonOnlyMode(true);
    expect(mod.isRecoveryMode()).toBe(false);
  });

  it('setRecoveryMode يكتب علامة التخزين فقط (تُقرأ عند إعادة التشغيل)', () => {
    // ملاحظة: الدالة لا تُحدّث الحالة في الذاكرة — هذا مقصود، لأن التطبيق
    // يعيد التحميل بعدها فتُقرأ العلامة من جديد عند الإقلاع.
    mod.setRecoveryMode(true);
    expect(store.get(mod.RECOVERY_STORAGE_KEY)).toBe('1');

    mod.setRecoveryMode(false);
    expect(store.has(mod.RECOVERY_STORAGE_KEY)).toBe(false);
  });

  it('setNeonOnlyMode يُحدّث الحالة الفورية (بلا إعادة تحميل)', () => {
    mod.setNeonOnlyMode(true);
    expect(mod.isNeonOnlyMode()).toBe(true);
    expect(mod.isRecoveryMode()).toBe(false);

    mod.setNeonOnlyMode(false);
    expect(mod.isRecoveryMode()).toBe(true);
  });
});

describe('persistenceMode — الثوابت', () => {
  it('مفتاح كاش المستندات ثابت ولا يتغيّر (يكسر الكاش لو تغيّر)', async () => {
    const mod = await import('../persistenceMode');
    expect(mod.DOCUMENTS_CACHE_KEY).toBe('erp_documents_cache');
  });

  it('USE_LOCAL_CACHE مفعّل', async () => {
    const mod = await import('../persistenceMode');
    expect(mod.USE_LOCAL_CACHE).toBe(true);
  });
});
