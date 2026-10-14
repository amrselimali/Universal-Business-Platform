import { describe, expect, it } from 'vitest';
import {
  buildPeriodLock,
  checkDateAgainstLocks,
  findLatestClosedPeriodDate,
  scopePeriodLocks,
  unlockPeriod,
  validatePeriodDate,
} from '../accountingPeriods';
import type { AccountingPeriodLock } from '../../../types';

const lock = (overrides: Partial<AccountingPeriodLock> = {}): AccountingPeriodLock =>
  ({
    id: 'lock-1',
    tenantId: 't1',
    branchId: 'all',
    lockDate: '2026-09-30',
    lockedAt: '2026-10-01T00:00:00.000Z',
    lockedBy: 'مدير النظام',
    reason: 'إقفال دوري',
    status: 'locked',
    ...overrides,
  }) as AccountingPeriodLock;

describe('scopePeriodLocks', () => {
  it('يحصر الأقفال على منشأة واحدة', () => {
    const locks = [lock({ id: 'a', tenantId: 't1' }), lock({ id: 'b', tenantId: 't2' })];
    const scoped = scopePeriodLocks(locks, 't1');
    expect(scoped).toHaveLength(1);
    expect(scoped[0].id).toBe('a');
  });

  it('يرجع الكل عند غياب المعرّف', () => {
    expect(scopePeriodLocks([lock(), lock({ id: 'x' })], undefined)).toHaveLength(2);
  });
});

describe('findLatestClosedPeriodDate', () => {
  it('يرجع null عند عدم وجود فترات مقفلة', () => {
    expect(findLatestClosedPeriodDate([])).toBeNull();
    expect(findLatestClosedPeriodDate([lock({ status: 'unlocked' })])).toBeNull();
  });

  it('يرجع أحدث تاريخ إقفال ساري', () => {
    const result = findLatestClosedPeriodDate([
      lock({ id: 'a', lockDate: '2026-03-31' }),
      lock({ id: 'b', lockDate: '2026-09-30' }),
      lock({ id: 'c', lockDate: '2026-06-30' }),
    ]);
    expect(result).toBe('2026-09-30');
  });

  it('يتجاهل الأقفال المفتوحة', () => {
    const result = findLatestClosedPeriodDate([
      lock({ id: 'a', lockDate: '2026-09-30', status: 'unlocked' }),
      lock({ id: 'b', lockDate: '2026-06-30' }),
    ]);
    expect(result).toBe('2026-06-30');
  });
});

describe('buildPeriodLock', () => {
  it('يبني قفلاً كامل السياق', () => {
    const built = buildPeriodLock('2026-09-30', undefined, {
      tenantId: 't1',
      branchId: 'b1',
      lockedBy: 'أحمد',
      now: '2026-10-14T10:00:00.000Z',
    });

    expect(built.tenantId).toBe('t1');
    expect(built.branchId).toBe('b1');
    expect(built.lockedBy).toBe('أحمد');
    expect(built.status).toBe('locked');
    expect(built.lockedAt).toBe('2026-10-14T10:00:00.000Z');
    expect(built.reason).toBe('إقفال دوري معتمد للحسابات');
  });

  it('يستخدم فرع «الكل» عند غياب الفرع', () => {
    const built = buildPeriodLock('2026-09-30', 'سبب', { tenantId: 't1', lockedBy: 'س' });
    expect(built.branchId).toBe('all');
  });

  it('يحتفظ بالسبب المُمرَّر', () => {
    const built = buildPeriodLock('2026-09-30', 'إقفال سنوي', { tenantId: 't1', lockedBy: 'س' });
    expect(built.reason).toBe('إقفال سنوي');
  });
});

describe('unlockPeriod', () => {
  it('يفتح القفل المطلوب فقط ولا يحذف السجل (أثر رقابي)', () => {
    const locks = [lock({ id: 'a' }), lock({ id: 'b' })];
    const result = unlockPeriod(locks, 'a');
    expect(result).toHaveLength(2);
    expect(result.find((l) => l.id === 'a')?.status).toBe('unlocked');
    expect(result.find((l) => l.id === 'b')?.status).toBe('locked');
  });

  it('لا يعدّل المصفوفة الأصلية', () => {
    const locks = [lock({ id: 'a' })];
    unlockPeriod(locks, 'a');
    expect(locks[0].status).toBe('locked');
  });
});

describe('validatePeriodDate', () => {
  it('يسمح عندما لا يوجد قفل', () => {
    expect(validatePeriodDate({ isLocked: false }, false)).toEqual({ allowed: true });
  });

  it('يرفض لمستخدم عادي داخل الفترة المقفلة', () => {
    const result = validatePeriodDate({ isLocked: true, lockInfo: { lockDate: '2026-09-30' } }, false);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('2026-09-30');
    expect(result.message).toContain('مقفلة');
  });

  it('يسمح للمدير العام مع إظهار سبب التجاوز', () => {
    const result = validatePeriodDate({ isLocked: true }, true);
    expect(result.allowed).toBe(true);
    expect(result.message).toContain('المدير العام');
  });

  it('يسمح بالتجاوز الصريح المطلوب من الواجهة', () => {
    expect(validatePeriodDate({ isLocked: true }, false, true).allowed).toBe(true);
  });
});

describe('checkDateAgainstLocks (تكامل مع محرك المحاسبة)', () => {
  const locks = [lock({ tenantId: 't1', lockDate: '2026-09-30', branchId: 'all' })];

  it('يعتبر التاريخ داخل الفترة المقفلة', () => {
    expect(checkDateAgainstLocks('2026-08-15', locks, 't1', 'b1').isLocked).toBe(true);
  });

  it('يعتبر تاريخ يوم الإقفال نفسه مقفلاً', () => {
    expect(checkDateAgainstLocks('2026-09-30', locks, 't1', 'b1').isLocked).toBe(true);
  });

  it('يسمح بتاريخ بعد الإقفال', () => {
    expect(checkDateAgainstLocks('2026-10-01', locks, 't1', 'b1').isLocked).toBe(false);
  });

  it('لا يطبّق قفل منشأة على منشأة أخرى', () => {
    expect(checkDateAgainstLocks('2026-08-15', locks, 't2', 'b1').isLocked).toBe(false);
  });

  it('يتعامل مع قائمة أقفال فارغة', () => {
    expect(checkDateAgainstLocks('2026-08-15', [], 't1').isLocked).toBe(false);
  });
});
