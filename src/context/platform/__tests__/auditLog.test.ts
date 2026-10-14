import { describe, expect, it } from 'vitest';
import {
  buildActivityLog,
  buildAuditRecord,
  makeLogId,
  scopeActivityLogs,
  scopeAuditRecords,
  takeRecent,
  type AuditContext,
} from '../auditLog';
import type { AuditRecord, UserActivityLog } from '../../../types';

const ctx: AuditContext = {
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  userId: 'user-9',
  userName: 'مدير النظام',
  userRole: 'SuperAdmin',
  now: '2026-10-14T10:00:00.000Z',
};

describe('makeLogId', () => {
  it('ينتج معرّفات فريدة حتى بنفس البذرة (يمنع تصادم السجلات)', () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeLogId('audit', 1000)));
    expect(ids.size).toBe(200);
  });

  it('يحمل البادئة والبذرة', () => {
    expect(makeLogId('log', 42)).toMatch(/^log-42-/);
  });
});

describe('buildAuditRecord', () => {
  it('يملأ كل حقول السياق الإلزامية', () => {
    const record = buildAuditRecord(
      { entityType: 'Party', entityId: 'p1', entityName: 'عميل', actionType: 'CREATE' },
      ctx
    );

    expect(record.tenantId).toBe('tenant-1');
    expect(record.branchId).toBe('branch-1');
    expect(record.performedById).toBe('user-9');
    expect(record.performedByName).toBe('مدير النظام');
    expect(record.timestamp).toBe('2026-10-14T10:00:00.000Z');
    expect(record.id).toMatch(/^audit-/);
  });

  it('يحتفظ ببيانات الحركة الأصلية', () => {
    const record = buildAuditRecord(
      {
        entityType: 'Product',
        entityId: 'prod-1',
        entityName: 'منتج',
        actionType: 'UPDATE',
        diffSummary: 'تغيير السعر',
      },
      ctx
    );
    expect(record.entityType).toBe('Product');
    expect(record.actionType).toBe('UPDATE');
    expect(record.diffSummary).toBe('تغيير السعر');
  });

  it('لا يسمح بتزوير المستخدم المنفّذ عبر مدخلات الحركة', () => {
    const record = buildAuditRecord(
      {
        entityType: 'Party',
        entityId: 'p1',
        entityName: 'عميل',
        actionType: 'CREATE',
        performedById: 'مستخدم-مزوّر',
      } as any,
      ctx
    );
    // السياق يُطبَّق بعد المدخلات فيتغلّب عليها دائماً.
    expect(record.performedById).toBe('user-9');
  });

  it('يستخدم الساعة الحالية عند غياب now', () => {
    const record = buildAuditRecord(
      { entityType: 'Party', entityId: 'p1', entityName: 'ع', actionType: 'CREATE' },
      { ...ctx, now: undefined }
    );
    expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false);
  });
});

describe('buildActivityLog', () => {
  it('يبني سجل نشاط كامل', () => {
    const log = buildActivityLog(
      {
        screenId: 'pos',
        screenNameAr: 'نقطة البيع',
        screenNameEn: 'POS',
        actionNameAr: 'إتمام بيع',
        actionNameEn: 'Checkout',
        details: 'فاتورة 100 ج.م',
      },
      ctx
    );

    expect(log.screenId).toBe('pos');
    expect(log.userId).toBe('user-9');
    expect(log.userRole).toBe('SuperAdmin');
    expect(log.tenantId).toBe('tenant-1');
    expect(log.id).toMatch(/^log-/);
  });

  it('يستخدم دوراً افتراضياً عند غيابه', () => {
    const log = buildActivityLog(
      {
        screenId: 'pos',
        screenNameAr: 'نقطة البيع',
        screenNameEn: 'POS',
        actionNameAr: 'بيع',
        actionNameEn: 'Sell',
        details: '',
      },
      { ...ctx, userRole: undefined }
    );
    expect(log.userRole).toBe('SuperAdmin');
  });
});

describe('عزل المستأجرين (Tenant Isolation)', () => {
  const records = [
    { id: 'a1', tenantId: 'tenant-1', timestamp: '2026-10-01T00:00:00Z' },
    { id: 'a2', tenantId: 'tenant-2', timestamp: '2026-10-02T00:00:00Z' },
    { id: 'a3', tenantId: 'tenant-1', timestamp: '2026-10-03T00:00:00Z' },
  ] as unknown as AuditRecord[];

  it('لا تُسرّب سجلات منشأة لمنشأة أخرى', () => {
    const scoped = scopeAuditRecords(records, 'tenant-1');
    expect(scoped).toHaveLength(2);
    scoped.forEach((r) => expect(r.tenantId).toBe('tenant-1'));
  });

  it('ترجع الكل عند غياب معرّف المنشأة', () => {
    expect(scopeAuditRecords(records, undefined)).toHaveLength(3);
  });

  it('تطبّق نفس العزل على سجل النشاط', () => {
    const logs = records as unknown as UserActivityLog[];
    expect(scopeActivityLogs(logs, 'tenant-2')).toHaveLength(1);
  });
});

describe('takeRecent', () => {
  it('يرتّب الأحدث أولاً ويقصّ العدد', () => {
    const items = [
      { id: 'old', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'new', timestamp: '2026-09-01T00:00:00Z' },
      { id: 'mid', timestamp: '2026-05-01T00:00:00Z' },
    ];
    const result = takeRecent(items, 2);
    expect(result.map((i) => i.id)).toEqual(['new', 'mid']);
  });

  it('لا يعدّل المصفوفة الأصلية', () => {
    const items = [
      { id: 'a', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'b', timestamp: '2026-02-01T00:00:00Z' },
    ];
    const snapshot = [...items];
    takeRecent(items, 1);
    expect(items).toEqual(snapshot);
  });

  it('يتعامل مع عدد أكبر من العناصر المتاحة', () => {
    expect(takeRecent([{ id: 'x', timestamp: '2026-01-01T00:00:00Z' }], 10)).toHaveLength(1);
  });
});
