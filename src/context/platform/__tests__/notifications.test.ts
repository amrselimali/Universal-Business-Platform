import { describe, expect, it } from 'vitest';
import {
  buildNotificationFromRule,
  canUserSeeNotification,
  countUnread,
  filterNotificationsForUser,
  interpolateTemplate,
  markAllRead,
  markOneRead,
  prependNotification,
  removeNotification,
  rulePlaysSound,
  ruleShowsToast,
  type NotificationAudience,
} from '../notifications';
import type { AppNotification, NotificationRule, UserRole } from '../../../types';

const buildNotification = (overrides: Partial<AppNotification> = {}): AppNotification =>
  ({
    id: 'n1',
    ruleCode: 'r1',
    category: 'general',
    severity: 'info',
    titleAr: 'تنبيه',
    titleEn: 'Alert',
    messageAr: 'رسالة',
    messageEn: 'Message',
    timestamp: '2026-10-14T10:00:00.000Z',
    isRead: false,
    ...overrides,
  }) as AppNotification;

const buildRule = (overrides: Partial<NotificationRule> = {}): NotificationRule =>
  ({
    id: 'r1',
    code: 'low_stock',
    nameAr: 'نقص مخزون',
    nameEn: 'Low Stock',
    category: 'inventory',
    severity: 'warning',
    templateMessageAr: 'المنتج {product} وصل إلى {qty}',
    templateMessageEn: 'Product {product} reached {qty}',
    channels: ['in_app'],
    targetRoles: [],
    targetUserIds: [],
    isEnabled: true,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }) as NotificationRule;

describe('interpolateTemplate', () => {
  it('يستبدل كل الرموز بقيمها', () => {
    expect(interpolateTemplate('المنتج {product} وصل إلى {qty}', { product: 'شاشة', qty: 3 })).toBe(
      'المنتج شاشة وصل إلى 3'
    );
  });

  it('يستبدل الرمز المتكرر أكثر من مرة', () => {
    expect(interpolateTemplate('{a} و {a}', { a: 'س' })).toBe('س و س');
  });

  it('يستبدل القيم الفارغة بنص فارغ لا بـ undefined', () => {
    expect(interpolateTemplate('القيمة: {x}', { x: null })).toBe('القيمة: ');
    expect(interpolateTemplate('القيمة: {x}', {})).toBe('القيمة: {x}');
  });

  it('يرجع نصاً فارغاً لقالب فارغ', () => {
    expect(interpolateTemplate('', { a: 1 })).toBe('');
  });
});

describe('canUserSeeNotification — عزل الإشعارات', () => {
  const cashier: NotificationAudience = {
    id: 'u-cashier',
    role: 'Cashier',
    allowedBranchIds: ['b1'],
  };

  it('المدير العام يرى كل الإشعارات', () => {
    const n = buildNotification({ branchId: 'b9' });
    expect(canUserSeeNotification(n, { id: 'a', role: 'SuperAdmin' })).toBe(true);
    expect(canUserSeeNotification(n, { id: 'a', role: 'Cashier', isAdmin: true })).toBe(true);
  });

  it('لا يرى إشعار فرع ليس ضمن فروعه', () => {
    expect(canUserSeeNotification(buildNotification({ branchId: 'b9' }), cashier)).toBe(false);
  });

  it('يرى إشعار فرعه', () => {
    expect(canUserSeeNotification(buildNotification({ branchId: 'b1' }), cashier)).toBe(true);
  });

  it('يرى الإشعارات العامة (all)', () => {
    expect(canUserSeeNotification(buildNotification({ branchId: 'all' }), cashier)).toBe(true);
  });

  it('يرى الإشعار الموجَّه له بالاسم حتى لو لدور آخر', () => {
    const n = buildNotification({ targetRoles: ['Accountant'], targetUserIds: ['u-cashier'] });
    expect(canUserSeeNotification(n, cashier)).toBe(true);
  });

  it('لا يرى إشعاراً موجَّهاً لدور آخر', () => {
    const n = buildNotification({ targetRoles: ['Accountant'] });
    expect(canUserSeeNotification(n, cashier)).toBe(false);
  });

  it('يرى الإشعار الموجَّه لدوره', () => {
    const n = buildNotification({ targetRoles: ['Cashier'] });
    expect(canUserSeeNotification(n, cashier)).toBe(true);
  });

  it('يرى الإشعار الموجَّه للجميع (role = *)', () => {
    const n = buildNotification({ targetRoles: ['*'] as unknown as UserRole[] });
    expect(canUserSeeNotification(n, cashier)).toBe(true);
  });

  it('مستخدم بصلاحية كل الفروع يرى إشعار أي فرع', () => {
    const supervisor: NotificationAudience = {
      id: 'u-sup',
      role: 'BranchManager',
      allowedBranchIds: ['*'],
    };
    expect(canUserSeeNotification(buildNotification({ branchId: 'b99' }), supervisor)).toBe(true);
  });
});

describe('filterNotificationsForUser', () => {
  it('ترجع الكل عند غياب المستخدم', () => {
    const list = [buildNotification({ id: 'a' }), buildNotification({ id: 'b' })];
    expect(filterNotificationsForUser(list, null)).toHaveLength(2);
  });

  it('تحصر حسب صلاحيات المستخدم', () => {
    const list = [
      buildNotification({ id: 'a', branchId: 'b1' }),
      buildNotification({ id: 'b', branchId: 'b9' }),
    ];
    const scoped = filterNotificationsForUser(list, {
      id: 'u',
      role: 'Cashier',
      allowedBranchIds: ['b1'],
    });
    expect(scoped.map((n) => n.id)).toEqual(['a']);
  });
});

describe('countUnread', () => {
  it('يعدّ غير المقروء فقط', () => {
    expect(
      countUnread([
        buildNotification({ isRead: false }),
        buildNotification({ id: 'b', isRead: true }),
        buildNotification({ id: 'c', isRead: false }),
      ])
    ).toBe(2);
  });

  it('يرجع صفراً لقائمة فارغة', () => {
    expect(countUnread([])).toBe(0);
  });
});

describe('buildNotificationFromRule', () => {
  it('يعبّئ الرموز ويحفظ بيانات القاعدة', () => {
    const notif = buildNotificationFromRule(
      buildRule(),
      { product: 'شاشة ليزر', qty: 2, branchId: 'b1' },
      { tenantId: 't1', now: '2026-10-14T10:00:00.000Z' }
    );

    expect(notif.messageAr).toBe('المنتج شاشة ليزر وصل إلى 2');
    expect(notif.ruleCode).toBe('low_stock');
    expect(notif.category).toBe('inventory');
    expect(notif.severity).toBe('warning');
    expect(notif.isRead).toBe(false);
    expect(notif.branchId).toBe('b1');
    expect(notif.timestamp).toBe('2026-10-14T10:00:00.000Z');
  });

  it('يستخدم فرع القاعدة عند غياب فرع الحدث', () => {
    const notif = buildNotificationFromRule(
      buildRule({ targetBranchId: 'b7' }),
      {},
      { tenantId: 't1', branchId: 'b1' }
    );
    expect(notif.branchId).toBe('b7');
  });
});

describe('rulePlaysSound و ruleShowsToast', () => {
  it('يكتشف التشغيل الصوتي من العَلَم أو القنوات', () => {
    expect(rulePlaysSound(buildRule({ soundAlert: true, channels: ['in_app'] }))).toBe(true);
    expect(rulePlaysSound(buildRule({ channels: ['sound'] }))).toBe(true);
    expect(rulePlaysSound(buildRule({ channels: ['in_app'] }))).toBe(false);
  });

  it('يكتشف النافذة المنبثقة من القنوات', () => {
    expect(ruleShowsToast(buildRule({ channels: ['popup'] }))).toBe(true);
    expect(ruleShowsToast(buildRule({ channels: ['in_app'] }))).toBe(false);
  });
});

describe('عمليات القائمة (Immutable)', () => {
  const list = [
    buildNotification({ id: 'a', isRead: false }),
    buildNotification({ id: 'b', isRead: false }),
  ];

  it('markOneRead تقرأ إشعاراً واحداً فقط ولا تعدّل الأصل', () => {
    const result = markOneRead(list, 'a', '2026-10-14T11:00:00.000Z');
    expect(result.find((n) => n.id === 'a')?.isRead).toBe(true);
    expect(result.find((n) => n.id === 'b')?.isRead).toBe(false);
    expect(list[0].isRead).toBe(false);
  });

  it('markAllRead تقرأ الكل وتضع نفس التوقيت', () => {
    const result = markAllRead(list, '2026-10-14T11:00:00.000Z');
    result.forEach((n) => {
      expect(n.isRead).toBe(true);
      expect(n.readAt).toBe('2026-10-14T11:00:00.000Z');
    });
  });

  it('removeNotification تحذف بالمعرّف', () => {
    expect(removeNotification(list, 'a').map((n) => n.id)).toEqual(['b']);
  });

  it('prependNotification تضيف في المقدمة', () => {
    const result = prependNotification(list, buildNotification({ id: 'new' }));
    expect(result[0].id).toBe('new');
    expect(result).toHaveLength(3);
  });
});
