import { describe, expect, it, beforeEach } from 'vitest';
import { loadMetadataFromDirectDb } from '../metadataDirectLoader';

/**
 * اختبارات مسار التحميل المباشر من قاعدة البيانات.
 *
 * السياق: هذه الثغرة كانت تمنع محرك الشاشات من العمل تماماً لمن يستخدم
 * الاتصال المباشر (الوضع الافتراضي) — كان يظل يرى «محرك الشاشات غير مهيأ بعد»
 * رغم تشغيل ملفات الـ SQL.
 */

/** localStorage وهمي بسيط — البيئة هنا node بلا متصفح. */
const installFakeStorage = (): void => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
};

describe('loadMetadataFromDirectDb', () => {
  beforeEach(() => {
    installFakeStorage();
  });

  it('يرجع null بهدوء عند عدم وجود اتصال مباشر مضبوط', async () => {
    const result = await loadMetadataFromDirectDb();
    expect(result).toBeNull();
  });

  it('يرجع null عند وجود رابط وهمي (يُرفض من طبقة الاتصال)', async () => {
    localStorage.setItem(
      'erp_neon_cfg',
      JSON.stringify({ connectionString: 'postgresql://user:pass@ep-cool-snowflake-12345.neon.tech/db' })
    );
    const result = await loadMetadataFromDirectDb();
    expect(result).toBeNull();
  });

  it('لا يرفع استثناء أبداً — الفشل يُعاد كـ null', async () => {
    // رابط صالح الشكل لكن غير قابل للوصول
    localStorage.setItem(
      'erp_neon_cfg',
      JSON.stringify({ connectionString: 'postgresql://u:p@127.0.0.1:1/none?sslmode=require' })
    );
    await expect(loadMetadataFromDirectDb()).resolves.toBeNull();
  });
});
