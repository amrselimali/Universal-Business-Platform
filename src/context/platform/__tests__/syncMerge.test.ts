import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SYNC_CURSOR,
  isDatabaseUrl,
  resolveCursor,
  syncDatasets,
  syncOneDataset,
  type PulledChanges,
} from '../syncMerge';

/**
 * اختبارات قرار المزامنة.
 *
 * هذه أهم نقطة في المزامنة: «هل تغيّرت هذه المجموعة على الخادم؟»
 *   • خطأ بإجابة «لا تغيير» ⇒ **فقدان تحديث** من مستخدم آخر.
 *   • خطأ بإجابة «تغيّرت» دائماً ⇒ طلبات وإعادة رسم بلا داعٍ.
 */

const pullReturning = (changes: PulledChanges) => vi.fn(async () => changes);
const nothingChanged = (): PulledChanges => ({
  records: [],
  deletedIds: [],
  nextCursor: DEFAULT_SYNC_CURSOR,
});

describe('resolveCursor', () => {
  it('يرجع المؤشر المحفوظ', () => {
    expect(resolveCursor(new Map([['erp_x', '2026-01-01T00:00:00Z']]), 'erp_x')).toBe(
      '2026-01-01T00:00:00Z'
    );
  });

  it('يرجع المؤشر الابتدائي لمجموعة جديدة', () => {
    expect(resolveCursor(new Map(), 'erp_new')).toBe(DEFAULT_SYNC_CURSOR);
  });
});

describe('isDatabaseUrl', () => {
  it('يقبل صيغتي postgres', () => {
    expect(isDatabaseUrl('postgres://u@h/db')).toBe(true);
    expect(isDatabaseUrl('postgresql://u@h/db')).toBe(true);
  });

  it('يرفض الفارغ والروابط غير الصحيحة', () => {
    expect(isDatabaseUrl('')).toBe(false);
    expect(isDatabaseUrl(undefined)).toBe(false);
    expect(isDatabaseUrl(null)).toBe(false);
    expect(isDatabaseUrl('https://example.com')).toBe(false);
    expect(isDatabaseUrl('  ')).toBe(false);
  });

  it('يتجاهل المسافات الزائدة', () => {
    expect(isDatabaseUrl('  postgresql://u@h/db  ')).toBe(true);
  });
});

describe('syncOneDataset', () => {
  it('يرجع null عند عدم وجود تغييرات (لا إعادة رسم بلا داعٍ)', async () => {
    const result = await syncOneDataset(
      { key: 'erp_x', payload: [{ id: '1' }] },
      DEFAULT_SYNC_CURSOR,
      pullReturning(nothingChanged())
    );
    expect(result).toBeNull();
  });

  it('يدمج السجلات الجديدة ويُرجع المؤشر الجديد', async () => {
    const pull = pullReturning({
      records: [{ id: '2', name: 'جديد' }],
      deletedIds: [],
      nextCursor: '2026-05-01T00:00:00Z',
    });

    const result = await syncOneDataset({ key: 'erp_x', payload: [{ id: '1' }] }, 'c1', pull);

    expect(result).not.toBeNull();
    expect('error' in result!).toBe(false);
    const ok = result as { key: string; merged: unknown[]; nextCursor: string };
    expect(ok.merged).toHaveLength(2);
    expect(ok.nextCursor).toBe('2026-05-01T00:00:00Z');
  });

  it('يطبّق الحذف الناعم القادم من الخادم', async () => {
    const pull = pullReturning({
      records: [],
      deletedIds: ['1'],
      nextCursor: '2026-05-01T00:00:00Z',
    });

    const result = await syncOneDataset(
      { key: 'erp_x', payload: [{ id: '1' }, { id: '2' }] },
      'c1',
      pull
    );

    const ok = result as { merged: { id: string }[] };
    expect(ok.merged.map((r) => r.id)).toEqual(['2']);
  });

  it('يعتبر الحذف وحده تغييراً (لا يُتجاهل)', async () => {
    const pull = pullReturning({ records: [], deletedIds: ['1'], nextCursor: 'c2' });
    const result = await syncOneDataset({ key: 'erp_x', payload: [{ id: '1' }] }, 'c1', pull);
    expect(result).not.toBeNull();
  });

  it('يُرجع الخطأ ولا يُكمل عند فشل السحب', async () => {
    const pull = pullReturning({
      records: [],
      deletedIds: [],
      nextCursor: 'c1',
      error: 'connection refused',
    });

    const result = await syncOneDataset({ key: 'erp_x', payload: [] }, 'c1', pull);
    expect(result).toEqual({ error: 'connection refused' });
  });

  it('يتعامل مع حمولة غير مصفوفة كقائمة فارغة', async () => {
    const pull = pullReturning({ records: [{ id: '1' }], deletedIds: [], nextCursor: 'c2' });
    const result = await syncOneDataset({ key: 'erp_x', payload: null }, 'c1', pull);
    const ok = result as { merged: unknown[] };
    expect(ok.merged).toHaveLength(1);
  });

  it('يمرّر مفتاح المجموعة والمؤشر لدالة السحب', async () => {
    const pull = pullReturning(nothingChanged());
    await syncOneDataset({ key: 'erp_parties_backup', payload: [] }, 'cursor-9', pull);
    expect(pull).toHaveBeenCalledWith('erp_parties_backup', 'cursor-9');
  });
});

describe('syncDatasets — الدفعة الكاملة', () => {
  it('يجمع كل المجموعات المتغيّرة في نتيجة واحدة', async () => {
    const pull = vi.fn(async (key: string) =>
      key === 'erp_b'
        ? { records: [{ id: 'b2' }], deletedIds: [], nextCursor: 'cb' }
        : nothingChanged()
    );

    const outcome = await syncDatasets(
      [
        { key: 'erp_a', payload: [{ id: 'a1' }] },
        { key: 'erp_b', payload: [{ id: 'b1' }] },
        { key: 'erp_c', payload: [{ id: 'c1' }] },
      ],
      new Map(),
      pull
    );

    expect(outcome.changedKeys).toEqual(['erp_b']); // فقط المتغيّرة
    expect(Object.keys(outcome.documents)).toEqual(['erp_b']);
    expect(outcome.cursors.erp_b).toBe('cb');
    expect(outcome.error).toBeUndefined();
  });

  it('يتوقف عند أول خطأ ولا يُكمل على بيانات ناقصة', async () => {
    let calls = 0;
    const pull = vi.fn(async (key: string) => {
      calls += 1;
      if (key === 'erp_b') {
        return { records: [], deletedIds: [], nextCursor: 'x', error: 'unreachable' };
      }
      return nothingChanged();
    });

    const outcome = await syncDatasets(
      [{ key: 'erp_a', payload: [] }, { key: 'erp_b', payload: [] }, { key: 'erp_c', payload: [] }],
      new Map(),
      pull
    );

    expect(outcome.error).toBe('unreachable');
    expect(calls).toBe(2); // erp_c لم تُسحب بعد الفشل
  });

  it('قائمة فارغة تُرجع نتيجة فارغة بلا أخطاء', async () => {
    const outcome = await syncDatasets([], new Map(), vi.fn());
    expect(outcome).toEqual({ documents: {}, changedKeys: [], cursors: {} });
  });

  it('يستخدم المؤشرات المحفوظة لكل مجموعة', async () => {
    const pull = pullReturning(nothingChanged());
    await syncDatasets([{ key: 'erp_x', payload: [] }], new Map([['erp_x', 'saved-cursor']]), pull);
    expect(pull).toHaveBeenCalledWith('erp_x', 'saved-cursor');
  });

  it('لا تغييرات في أي مجموعة ⇒ نتيجة فارغة بلا خطأ', async () => {
    const outcome = await syncDatasets(
      [{ key: 'a', payload: [] }, { key: 'b', payload: [] }],
      new Map(),
      pullReturning(nothingChanged())
    );
    expect(outcome.changedKeys).toEqual([]);
    expect(outcome.error).toBeUndefined();
  });
});
