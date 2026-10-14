import { describe, expect, it } from 'vitest';
import { diffRecords, hasVersionConflict, mergeRecords } from '../recordSync';

describe('mergeRecords — التزامن المتفائل', () => {
  it('يرجّح الإصدار الأكبر رقماً (وليس الأحدث زمنياً)', () => {
    const local = [{ id: 'b1', name: 'الاسم المحلي', version: 5, updated_at: '2020-01-01T00:00:00Z' }];
    const incoming = [
      { id: 'b1', name: 'الاسم من الخادم', version: 3, updated_at: '2030-01-01T00:00:00Z' },
    ];

    const merged = mergeRecords(local, incoming, []);

    // الإصدار 5 أحدث من 3، حتى لو كان طابعه الزمني أقدم.
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('الاسم المحلي');
    expect(merged[0].version).toBe(5);
  });

  it('يقبل تعديل الخادم عندما يكون إصداره أكبر', () => {
    const local = [{ id: 'b1', name: 'قديم', version: 2 }];
    const incoming = [{ id: 'b1', name: 'جديد', version: 7 }];

    const merged = mergeRecords(local, incoming, []);
    expect(merged[0].name).toBe('جديد');
    expect(merged[0].version).toBe(7);
  });

  it('يرجع للطابع الزمني فقط عند غياب version (بيانات قديمة)', () => {
    const local = [{ id: 'b1', name: 'قديم', updated_at: '2026-01-01T00:00:00Z' }];
    const incoming = [{ id: 'b1', name: 'أحدث', updated_at: '2026-06-01T00:00:00Z' }];

    const merged = mergeRecords(local, incoming, []);
    expect(merged[0].name).toBe('أحدث');
  });

  it('يحتفظ بالسجل المحلي إذا كان طابعه الزمني أحدث (بيانات قديمة بدون version)', () => {
    const local = [{ id: 'b1', name: 'محلي أحدث', updated_at: '2026-09-01T00:00:00Z' }];
    const incoming = [{ id: 'b1', name: 'خادم أقدم', updated_at: '2026-02-01T00:00:00Z' }];

    const merged = mergeRecords(local, incoming, []);
    expect(merged[0].name).toBe('محلي أحدث');
  });

  it('يزيل السجلات المحذوفة ويضيف السجلات الجديدة', () => {
    const local = [
      { id: 'b1', name: 'سيُحذف' },
      { id: 'b2', name: 'يبقى' },
    ];
    const incoming = [{ id: 'b3', name: 'جديد من الخادم', version: 1 }];

    const merged = mergeRecords(local, incoming, ['b1']);
    const ids = merged.map((r) => r.id).sort();

    expect(ids).toEqual(['b2', 'b3']);
  });

  it('لا يفقد السجلات المحلية التي لم يصل لها أي تحديث', () => {
    const local = [{ id: 'local-only', name: 'محلي فقط' }];
    const merged = mergeRecords(local, [], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('local-only');
  });
});

describe('hasVersionConflict', () => {
  it('يكشف أن إصدار الخادم أحدث', () => {
    expect(hasVersionConflict({ id: 'b1', version: 2 }, { id: 'b1', version: 5 })).toBe(true);
  });

  it('لا يعتبر الإصدار المتساوي تعارضاً', () => {
    expect(hasVersionConflict({ id: 'b1', version: 5 }, { id: 'b1', version: 5 })).toBe(false);
  });

  it('لا يعتبر الإصدار المحلي الأحدث تعارضاً', () => {
    expect(hasVersionConflict({ id: 'b1', version: 9 }, { id: 'b1', version: 4 })).toBe(false);
  });

  it('يرجع false عند غياب إصدار على أي طرف', () => {
    expect(hasVersionConflict({ id: 'b1' }, { id: 'b1', version: 3 })).toBe(false);
    expect(hasVersionConflict({ id: 'b1', version: 3 }, undefined)).toBe(false);
  });
});

describe('diffRecords', () => {
  it('يرصد السجلات المتغيّرة فقط', () => {
    const previous = [
      { id: 'a', name: 'ثابت' },
      { id: 'b', name: 'قديم' },
    ];
    const current = [
      { id: 'a', name: 'ثابت' },
      { id: 'b', name: 'جديد' },
    ];

    const { upserts, deletes } = diffRecords(previous, current, 'erp_test');

    expect(upserts).toHaveLength(1);
    expect(upserts[0].id).toBe('b');
    expect(deletes).toEqual([]);
  });

  it('يرصد السجلات المحذوفة', () => {
    const previous = [{ id: 'a' }, { id: 'b' }];
    const current = [{ id: 'a' }];

    const { upserts, deletes } = diffRecords(previous, current, 'erp_test');

    expect(upserts).toEqual([]);
    expect(deletes).toEqual(['b']);
  });

  it('لا يرصد أي تغيير عندما تكون البيانات متطابقة', () => {
    const data = [{ id: 'a', name: 'س' }];
    const { upserts, deletes } = diffRecords(data, structuredClone(data), 'erp_test');
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });
});
