import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * مسارات الفواتير (Invoices API)
 * -----------------------------------------------------------------------------
 * القراءة والكتابة كلها من السيرفر:
 *   • tenant_id **من التوكن** (لا من جسم الطلب ولا من query).
 *   • كل استدعاء يمرّ عبر `db.one(tenantId, ...)` الذي يضبط `app.tenant_id`
 *     داخل نفس المعاملة فتسري سياسات RLS الخاصة بالمنشأة.
 *   • دوال SQL تبقى كما هي (fn_invoice_list/summary/detail/update/cancel).
 *
 * هذا هو الفرق عن الوضع السابق: المتصفح لم يعد يحمل رابط الاتصال ولا يستطيع
 * تمرير tenant آخر.
 */

interface DbLike {
  one: <T = any>(tenantId: string, text: string, params?: unknown[]) => Promise<T>;
}

export interface InvoiceRoutesOptions {
  db: DbLike;
  assertTenant: (request: any) => string;
  assertAction: (request: any, actionCode: string) => void;
}

const listQuery = z.object({
  search: z.string().max(200).optional(),
  from: z.string().max(20).optional(),
  to: z.string().max(20).optional(),
  status: z.string().max(30).optional(),
  source: z.string().max(40).optional(),
  customerId: z.string().max(120).optional(),
  branchId: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  afterDate: z.string().max(20).optional(),
  afterId: z.string().max(200).optional(),
});

const updateBody = z.object({
  netAmount: z.number(),
  paymentMethod: z.string().max(120).optional(),
  reason: z.string().min(3).max(500),
});

const cancelBody = z.object({ reason: z.string().min(3).max(500) });

export async function registerInvoiceRoutes(app: FastifyInstance, options: InvoiceRoutesOptions) {
  const { db, assertTenant, assertAction } = options;

  /** قائمة الفواتير: صفحة Keyset + فلاتر في SQL. */
  app.get('/sales/invoices', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');

    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', details: parsed.error.issues });
    const q = parsed.data;

    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_invoice_list($1,$2,$3::date,$4::date,$5,$6,$7::date,$8,$9,$10,$11) AS page`,
        [
          tenantId, q.search ?? null, q.from ?? null, q.to ?? null, q.status ?? null,
          q.limit ?? 50, q.afterDate ?? null, q.afterId ?? null,
          q.source && q.source !== 'all' ? q.source : null,
          q.customerId && q.customerId !== 'all' ? q.customerId : null,
          q.branchId || null,
        ]
      );
      return (rows?.[0]?.page as Record<string, unknown>) ?? { items: [], limit: q.limit ?? 50 };
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'invoice_list_failed', message: error?.message });
    }
  });

  /** ملخص الفواتير المطابق للفلاتر (عدّاد + صافي + ضريبة). */
  app.get('/sales/invoices/summary', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');

    const parsed = listQuery.omit({ limit: true, afterDate: true, afterId: true }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', details: parsed.error.issues });
    const q = parsed.data;

    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_invoice_summary($1,$2,$3::date,$4::date,$5,$6,$7,$8) AS summary`,
        [
          tenantId, q.search ?? null, q.from ?? null, q.to ?? null, q.status ?? null,
          q.source && q.source !== 'all' ? q.source : null,
          q.customerId && q.customerId !== 'all' ? q.customerId : null,
          q.branchId || null,
        ]
      );
      return (rows?.[0]?.summary as Record<string, unknown>) ?? { count: 0, netTotal: 0, taxTotal: 0 };
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'invoice_summary_failed', message: error?.message });
    }
  });

  /** تفاصيل فاتورة: الرأس + سطور invoice_lines. */
  app.get('/sales/invoices/:id', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');
    const { id } = request.params as { id: string };

    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_invoice_detail($1,$2) AS detail`,
        [tenantId, id]
      );
      const detail = (rows?.[0]?.detail as Record<string, unknown>) ?? {};
      if (!detail.header) return reply.code(404).send({ error: 'invoice_not_found' });
      return detail;
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'invoice_detail_failed', message: error?.message });
    }
  });

  /** تعديل فاتورة (سبب إلزامي) — يُسجَّل في الداتابيز. */
  app.put('/sales/invoices/:id', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'record.save');
    const { id } = request.params as { id: string };

    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.issues });

    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_invoice_update($1,$2,$3::numeric,$4,$5,$6) AS result`,
        [tenantId, id, parsed.data.netAmount, parsed.data.paymentMethod ?? null,
         parsed.data.reason, String(request.auth?.sub || 'api')]
      );
      return (rows?.[0]?.result as Record<string, unknown>) ?? { invoiceId: id };
    } catch (error: any) {
      return reply.code(400).send({ error: 'invoice_update_rejected', message: error?.message });
    }
  });

  /** إلغاء فاتورة (سبب إلزامي). */
  app.post('/sales/invoices/:id/cancel', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'record.save');
    const { id } = request.params as { id: string };

    const parsed = cancelBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.issues });

    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_invoice_cancel($1,$2,$3,$4) AS result`,
        [tenantId, id, parsed.data.reason, String(request.auth?.sub || 'api')]
      );
      return (rows?.[0]?.result as Record<string, unknown>) ?? { invoiceId: id, status: 'Cancelled' };
    } catch (error: any) {
      return reply.code(400).send({ error: 'invoice_cancel_rejected', message: error?.message });
    }
  });
}
