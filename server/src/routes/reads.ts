import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * مسارات القراءة بالصفحات (Paged reads)
 * -----------------------------------------------------------------------------
 * تخدم الشاشات التي كانت تقرأ من الداتابيز مباشرة من المتصفح (قيود/سجل نشاط/
 * تدقيق). الـ tenant يأتي من التوكن، وكل استدعاء يمرّ بـ db.one(tenantId) الذي
 * يضبط app.tenant_id داخل المعاملة فتسري سياسات RLS.
 */

interface DbLike {
  one: <T = any>(tenantId: string, text: string, params?: unknown[]) => Promise<T>;
}

export interface ReadRoutesOptions {
  db: DbLike;
  assertTenant: (request: any) => string;
  assertAction: (request: any, actionCode: string) => void;
}

const limitField = z.coerce.number().int().min(1).max(500).optional();
const afterDateField = z.string().max(20).optional();
const afterIdField = z.string().max(200).optional();

const journalQuery = z.object({
  from: z.string().max(20).optional(),
  to: z.string().max(20).optional(),
  search: z.string().max(200).optional(),
  limit: limitField,
  afterDate: afterDateField,
  afterId: afterIdField,
});

const simplePageQuery = z.object({
  search: z.string().max(200).optional(),
  from: z.string().max(20).optional(),
  to: z.string().max(20).optional(),
  userId: z.string().max(120).optional(),
  userName: z.string().max(200).optional(),
  action: z.string().max(60).optional(),
  entity: z.string().max(60).optional(),
  limit: limitField,
  afterId: afterIdField,
});

/** قراءة عامة بالصفحات على جدول يحمل (id, payload, tenant_id, deleted_at). */
const pagedPayloadRead = async (
  db: DbLike,
  options: {
    tenantId: string;
    table: string;
    filters: string[];
    params: unknown[];
    limit: number;
    afterId?: string;
    descending?: boolean;
  }
) => {
  const params = [...options.params];
  const where = options.filters.join(' AND ');
  let pageWhere = where;
  if (options.afterId) {
    params.push(options.afterId);
    pageWhere += ` AND id ${options.descending ? '<' : '>'} $${params.length}`;
  }
  params.push(options.limit);

  const rows = await db.one<any[]>(
    options.tenantId,
    `SELECT id, payload FROM ${options.table} WHERE ${pageWhere}
      ORDER BY id ${options.descending ? 'DESC' : 'ASC'} LIMIT $${params.length}`,
    params
  );
  const items = Array.isArray(rows) ? rows : [];
  return {
    items,
    nextAfterId: items.length === options.limit ? String(items[items.length - 1].id) : null,
  };
};

export async function registerReadRoutes(app: FastifyInstance, options: ReadRoutesOptions) {
  const { db, assertTenant, assertAction } = options;

  /** قائمة القيود (Keyset) + ملخص في مسار منفصل. */
  app.get('/journals', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');
    const parsed = journalQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', details: parsed.error.issues });
    const q = parsed.data;

    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_journal_list($1,$2::date,$3::date,$4,$5,$6::date,$7) AS page`,
        [tenantId, q.from ?? null, q.to ?? null, q.search ?? null, q.limit ?? 100,
         q.afterDate ?? null, q.afterId ?? null]
      );
      return (rows?.[0]?.page as Record<string, unknown>) ?? { items: [], limit: q.limit ?? 100 };
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'journal_list_failed', message: error?.message });
    }
  });

  app.get('/journals/summary', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');
    const parsed = journalQuery.omit({ limit: true, afterDate: true, afterId: true }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const q = parsed.data;
    try {
      const rows = await db.one<any[]>(
        tenantId,
        `SELECT fn_journal_summary($1,$2::date,$3::date,$4) AS summary`,
        [tenantId, q.from ?? null, q.to ?? null, q.search ?? null]
      );
      return (rows?.[0]?.summary as Record<string, unknown>) ?? { count: 0, totalDebit: 0, totalCredit: 0 };
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'journal_summary_failed', message: error?.message });
    }
  });

  /** سجل نشاط المستخدمين. */
  app.get('/activity-logs', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');
    const parsed = simplePageQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', details: parsed.error.issues });
    const q = parsed.data;

    const params: unknown[] = [tenantId];
    const filters = ['tenant_id = $1', 'deleted_at IS NULL'];
    if (q.userId) { params.push(q.userId); filters.push(`payload->>'userId' = $${params.length}`); }
    if (q.userName) { params.push(q.userName); filters.push(`lower(COALESCE(payload->>'userName','')) = lower($${params.length})`); }
    if (q.search) {
      params.push(`%${q.search}%`);
      filters.push(`(COALESCE(payload->>'userName','') || ' ' || COALESCE(payload->>'details','') || ' ' || COALESCE(payload->>'screenName','')) ILIKE $${params.length}`);
    }
    if (q.from) { params.push(q.from); filters.push(`substr(COALESCE(payload->>'timestamp',''),1,10) >= $${params.length}`); }
    if (q.to) { params.push(q.to); filters.push(`substr(COALESCE(payload->>'timestamp',''),1,10) <= $${params.length}`); }

    try {
      return await pagedPayloadRead(db, {
        tenantId, table: 'activity_logs', filters, params,
        limit: q.limit ?? 100, afterId: q.afterId, descending: true,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'activity_list_failed', message: error?.message });
    }
  });

  /** سجل التدقيق (نفس الفلاتر التي تستخدمها الشاشة). */
  app.get('/audit-records', async (request, reply) => {
    const tenantId = assertTenant(request);
    assertAction(request, 'generic.record.read');
    const parsed = simplePageQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', details: parsed.error.issues });
    const q = parsed.data;

    const params: unknown[] = [tenantId];
    const filters = ['tenant_id = $1', 'deleted_at IS NULL'];
    if (q.action && q.action !== 'All') { params.push(q.action); filters.push(`payload->>'actionType' = $${params.length}`); }
    if (q.entity && q.entity !== 'All') { params.push(q.entity); filters.push(`payload->>'entityType' = $${params.length}`); }
    if (q.userId && q.userId !== 'All') { params.push(q.userId); filters.push(`payload->>'performedById' = $${params.length}`); }
    if (q.search) {
      params.push(`%${q.search}%`);
      filters.push(`(COALESCE(payload->>'entityName','') || ' ' || COALESCE(payload->>'performedByName','') || ' ' || COALESCE(payload->>'reason','') || ' ' || COALESCE(payload->>'diffSummary','')) ILIKE $${params.length}`);
    }

    try {
      return await pagedPayloadRead(db, {
        tenantId, table: 'audit_records', filters, params,
        limit: q.limit ?? 100, afterId: q.afterId, descending: true,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'audit_list_failed', message: error?.message });
    }
  });
}
