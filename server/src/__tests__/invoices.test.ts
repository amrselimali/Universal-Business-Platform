import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { buildApp, type AppDeps } from '../app.js';

/**
 * اختبارات مسارات الفواتير (Invoices API)
 * ---------------------------------------------------------------------------
 * الأهم هنا **ليس** شكل الرد، بل ثلاثة ضمانات أمنية:
 *   1. tenant_id لا يُقبل من العميل إطلاقاً (يُشتق من التوكن).
 *   2. Default-Deny: بلا فعل مسجّل ⇒ 403 قبل أي استعلام.
 *   3. كل استدعاء يمرّ بـ db.one(tenantId) أي داخل معاملة تضبط app.tenant_id (RLS).
 */

const JWT_SECRET = 'test-secret-for-invoice-routes-0123456789';

function makeToken(payload: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'Custom',
      allowedTenantIds: ['tenant-1'],
      allowedBranchIds: [],
      allowedViews: ['invoices'],
      allowedActions: ['generic.record.read', 'record.save'],
      ...payload,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

function createFakeDb(replies: Record<string, unknown> = {}) {
  const calls: { key: string; tenantId: string; text: string; params?: unknown[] }[] = [];
  const db: AppDeps['db'] = {
    one: async (tenantId, text, params) => {
      const key = text.includes('fn_invoice_list')
        ? 'list'
        : text.includes('fn_invoice_summary')
          ? 'summary'
          : text.includes('fn_invoice_detail')
            ? 'detail'
            : text.includes('fn_invoice_update')
              ? 'update'
              : text.includes('fn_invoice_cancel')
                ? 'cancel'
                : 'other';
      calls.push({ key, tenantId, text, params });
      if (key in replies) return replies[key] as never;
      return [] as never;
    },
    withTenant: async () => [],
    rawQuery: async () => [] as never,
  };
  return { db, calls };
}

async function buildTestApp(replies: Record<string, unknown> = {}) {
  const { db, calls } = createFakeDb(replies);
  const app = await buildApp({ db, jwtSecret: JWT_SECRET, logger: false, disableRateLimit: true });
  await app.ready();
  return { app, calls };
}

describe('الفواتير: القراءة', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let calls: ReturnType<typeof createFakeDb>['calls'];

  beforeAll(async () => {
    ({ app, calls } = await buildTestApp({
      list: [{ page: { items: [{ id: 'inv-1', invoice_number: 'INV-1', net_amount: 100 }], nextAfterId: null } }],
      summary: [{ summary: { count: 1, netTotal: 100, taxTotal: 14 } }],
      detail: [{ detail: { header: { id: 'inv-1' }, lines: [{ line_no: 1 }] } }],
    }));
  });
  afterAll(async () => { await app.close(); });

  it('يرفض بلا توكن (401)', async () => {
    const response = await app.inject({ method: 'GET', url: '/sales/invoices' });
    expect(response.statusCode).toBe(401);
  });

  it('يرفض بلا فعل generic.record.read (403 — Default-Deny)', async () => {
    const token = makeToken({ allowedActions: [] });
    const response = await app.inject({ method: 'GET', url: '/sales/invoices', headers: auth(token) });
    expect(response.statusCode).toBe(403);
  });

  it('القائمة تُنفَّذ بـ tenant من التوكن لا من الطلب', async () => {
    const token = makeToken();
    const response = await app.inject({
      method: 'GET',
      // محاولة تمرير tenant آخر في الاستعلام — يجب أن تُتجاهل
      url: '/sales/invoices?tenantId=tenant-attacker',
      headers: auth(token),
    });
    expect(response.statusCode).toBe(200);
    const call = calls.find((c) => c.key === 'list');
    expect(call?.tenantId).toBe('tenant-1');
    expect(call?.params?.[0]).toBe('tenant-1');
  });

  it('الملخص يعيد الأرقام من الدالة', async () => {
    const response = await app.inject({ method: 'GET', url: '/sales/invoices/summary', headers: auth(makeToken()) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ count: 1, netTotal: 100, taxTotal: 14 });
  });

  it('التفاصيل تعيد 404 عند غياب الفاتورة', async () => {
    const { app: emptyApp } = await buildTestApp({ detail: [{ detail: {} }] });
    const response = await emptyApp.inject({ method: 'GET', url: '/sales/invoices/nope', headers: auth(makeToken()) });
    expect(response.statusCode).toBe(404);
    await emptyApp.close();
  });
});

describe('الفواتير: الكتابة', () => {
  it('التعديل يفرض سبباً (400 عند الغياب)', async () => {
    const { app } = await buildTestApp({});
    const response = await app.inject({
      method: 'PUT',
      url: '/sales/invoices/inv-1',
      headers: auth(makeToken()),
      payload: { netAmount: 50 },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('التعديل يمرّر tenant من التوكن ولا يقبل tenant من الجسم', async () => {
    const { app, calls } = await buildTestApp({ update: [{ result: { invoiceId: 'inv-1', version: 3 } }] });
    const response = await app.inject({
      method: 'PUT',
      url: '/sales/invoices/inv-1',
      headers: auth(makeToken()),
      payload: { netAmount: 50, reason: 'تصحيح المبلغ', tenantId: 'tenant-attacker' },
    });
    expect(response.statusCode).toBe(200);
    const call = calls.find((c) => c.key === 'update');
    expect(call?.tenantId).toBe('tenant-1');
    expect(call?.params?.[0]).toBe('tenant-1');
    expect(call?.params?.[1]).toBe('inv-1');
    await app.close();
  });

  it('الإلغاء يطلب صلاحية record.save (403 بلا فعل)', async () => {
    const { app } = await buildTestApp({});
    const token = makeToken({ allowedActions: ['generic.record.read'] });
    const response = await app.inject({
      method: 'POST',
      url: '/sales/invoices/inv-1/cancel',
      headers: auth(token),
      payload: { reason: 'سبب الإلغاء' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});

describe('الفواتير: الإصدار (If-Match)', () => {
  it('يمرّر الإصدار المتوقع إلى الدالة عند إرساله', async () => {
    const calls: { params?: unknown[] }[] = [];
    const db: AppDeps['db'] = {
      one: async (_tenantId, text, params) => {
        if (text.includes('fn_invoice_update')) calls.push({ params });
        return [{ result: { invoiceId: 'inv-1', version: 4 } }] as never;
      },
      withTenant: async () => [],
      rawQuery: async () => [] as never,
    };
    const app = await buildApp({ db, jwtSecret: JWT_SECRET, logger: false, disableRateLimit: true });
    await app.ready();

    const response = await app.inject({
      method: 'PUT',
      url: '/sales/invoices/inv-1',
      headers: auth(makeToken()),
      payload: { netAmount: 75, reason: 'تصحيح المبلغ', version: 3 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ version: 4 });
    // المعامل السابع هو الإصدار المتوقع
    expect(calls[0]?.params?.[6]).toBe(3);
    await app.close();
  });

  it('يرفض إصداراً غير رقمي (400)', async () => {
    const { app } = await buildTestApp({});
    const response = await app.inject({
      method: 'PUT',
      url: '/sales/invoices/inv-1',
      headers: auth(makeToken()),
      payload: { netAmount: 75, reason: 'تصحيح المبلغ', version: 'abc' },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
