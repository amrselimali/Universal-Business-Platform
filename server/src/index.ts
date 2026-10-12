import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { one, withTenant, rawQuery } from './db.js';

/**
 * Universal Business Platform API
 * -----------------------------------------------------------------------------
 * The browser never talks to Postgres again: it calls this API, which
 *   1. authenticates the user (JWT),
 *   2. derives the tenant from the token (never from the request body),
 *   3. opens a transaction with `app.tenant_id` set so RLS isolates the tenant,
 *   4. and runs the atomic accounting functions.
 */

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const app = Fastify({ logger: true, trustProxy: true });
await app.register(helmet);
await app.register(cors, {
  origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : false,
  credentials: true,
});
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

interface TokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  allowedTenantIds: string[];
  allowedBranchIds: string[];
  allowedViews: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: TokenPayload;
  }
}

/** Verifies the bearer token and exposes the tenant. Never trusts the body. */
app.decorateRequest('auth', undefined);
app.addHook('preHandler', async (request, reply) => {
  const path = request.routeOptions?.url || request.url;
  if (path === '/health' || path === '/auth/login') return;
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return reply.code(401).send({ error: 'missing_token' });
  try {
    request.auth = jwt.verify(token, JWT_SECRET as string) as TokenPayload;
  } catch {
    return reply.code(401).send({ error: 'invalid_token' });
  }
});

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

app.get('/health', async () => {
  const rows = await rawQuery<any[]>('SELECT 1 AS ok');
  return { status: 'ok', database: rows?.[0]?.ok === 1 ? 'up' : 'down' };
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  tenantId: z.string().min(1).optional(),
});

app.post('/auth/login', async (request, reply) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
  const { username, password, tenantId } = parsed.data;

  // Users live in app_records; the tenant is verified from the record itself.
  // Login happens before a tenant is known, so it goes through a SECURITY DEFINER
  // function that only returns the matching user rows (RLS still protects everything
  // else). Passwords are compared in constant time.
  const rows = await rawQuery<any[]>(
    `SELECT out_tenant_id AS tenant_id, out_payload AS payload FROM fn_login($1)`,
    [username]
  );
  const matches = (rows || []).filter((row) => {
    const stored = String(row.payload?.password || '');
    const storedHash = String(row.payload?.passwordHash || '');
    if (storedHash) return safeEqual(storedHash, sha256(password));
    return stored.length > 0 && safeEqual(stored, password);
  });
  const account = tenantId ? matches.find((row) => row.tenant_id === tenantId) : matches[0];
  if (!account) return reply.code(401).send({ error: 'invalid_credentials' });
  if (account.payload?.isActive === false) return reply.code(403).send({ error: 'user_disabled' });

  const payload: TokenPayload = {
    sub: String(account.payload?.id || username),
    tenantId: String(account.tenant_id),
    role: String(account.payload?.role || 'Custom'),
    allowedTenantIds: Array.isArray(account.payload?.allowedTenantIds) ? account.payload.allowedTenantIds : [String(account.tenant_id)],
    allowedBranchIds: Array.isArray(account.payload?.allowedBranchIds) ? account.payload.allowedBranchIds : [],
    allowedViews: Array.isArray(account.payload?.allowedViews) ? account.payload.allowedViews : [],
  };
  const token = jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN } as any);
  if (!account.payload?.passwordHash && account.payload?.password) {
    request.log.warn(`User ${username} still stores a plaintext password - migrate to passwordHash`);
  }
  return { token, user: { id: payload.sub, tenantId: payload.tenantId, role: payload.role } };
});

app.get('/me', async (request) => ({ auth: request.auth }));

/** Guarantees the caller may operate on the requested tenant. */
function assertTenant(request: any, requestedTenantId?: string): string {
  const auth = request.auth as TokenPayload;
  const target = requestedTenantId || auth.tenantId;
  if (target !== auth.tenantId && !auth.allowedTenantIds.includes(target)) {
    throw Object.assign(new Error('tenant_forbidden'), { statusCode: 403 });
  }
  return target;
}

// ---------------------------------------------------------------------------
// Records (the data layer the app uses)
// ---------------------------------------------------------------------------
const PAGE_SIZE = 2000;

/** Live records of a dataset (soft-deleted excluded), keyset-paginated. */
app.get('/records/:docKey', async (request, reply) => {
  const { docKey } = request.params as { docKey: string };
  const query = request.query as { after?: string; limit?: string };
  const tenantId = assertTenant(request);
  const limit = Math.min(Number(query.limit || PAGE_SIZE), PAGE_SIZE);
  const after = query.after || '';
  const rows = await one<any[]>(
    tenantId,
    `SELECT record_id, payload, updated_at FROM app_records
      WHERE doc_key = $1 AND deleted_at IS NULL AND ($2 = '' OR record_id > $2)
      ORDER BY record_id LIMIT $3`,
    [docKey, after, limit]
  );
  const records = (rows || []).map((row: any) => ({ ...(row.payload || {}), id: String(row.record_id) }));
  const nextAfter = rows && rows.length === limit ? String(rows[rows.length - 1].record_id) : null;
  return { records, nextAfter, count: records.length };
});

/** Changes since a cursor - what the client polls for. */
app.get('/records/:docKey/changes', async (request) => {
  const { docKey } = request.params as { docKey: string };
  const query = request.query as { since?: string };
  const tenantId = assertTenant(request);
  const rows = await one<any[]>(
    tenantId,
    `SELECT record_id, payload, updated_at, deleted_at FROM fn_changed_records($1, $2, $3::timestamptz)`,
    [tenantId, docKey, query.since || '1970-01-01T00:00:00.000Z']
  );
  const records: any[] = [];
  const deletedIds: string[] = [];
  let nextCursor = query.since || '1970-01-01T00:00:00.000Z';
  (rows || []).forEach((row: any) => {
    const stamp = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
    if (stamp > nextCursor) nextCursor = stamp;
    if (row.deleted_at) deletedIds.push(String(row.record_id));
    else records.push({ ...(row.payload || {}), id: String(row.record_id) });
  });
  return { records, deletedIds, nextCursor };
});

const upsertSchema = z.object({ records: z.array(z.record(z.any())).min(1).max(1000) });

/** Upserts records (one transaction, tenant-scoped). */
app.post('/records/:docKey', async (request, reply) => {
  const { docKey } = request.params as { docKey: string };
  const parsed = upsertSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
  const tenantId = assertTenant(request);
  const actor = String(request.auth?.sub || 'api');
  const rows = await one<any[]>(
    tenantId,
    `SELECT fn_upsert_records($1, $2, $3::jsonb, $4) AS n`,
    [tenantId, docKey, JSON.stringify(parsed.data.records), actor]
  );
  return { upserted: Number(rows?.[0]?.n || 0) };
});

const deleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) });

/** Soft-deletes records (never a hard delete). */
app.post('/records/:docKey/delete', async (request, reply) => {
  const { docKey } = request.params as { docKey: string };
  const parsed = deleteSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
  const tenantId = assertTenant(request);
  const actor = String(request.auth?.sub || 'api');
  const rows = await one<any[]>(
    tenantId,
    `SELECT fn_soft_delete_records($1, $2, $3::jsonb, $4) AS n`,
    [tenantId, docKey, JSON.stringify(parsed.data.ids), actor]
  );
  return { deleted: Number(rows?.[0]?.n || 0) };
});

// ---------------------------------------------------------------------------
// Atomic accounting (the business operations live in the database)
// ---------------------------------------------------------------------------
const journalSchema = z.object({
  branchId: z.string().optional(),
  date: z.string().min(8),
  description: z.string().min(1),
  sourceDocument: z.string().default('API'),
  lines: z.array(z.object({
    account_id: z.string().min(1),
    account_code: z.string().default(''),
    account_name_ar: z.string().default(''),
    memo: z.string().default(''),
    debit: z.number().nonnegative(),
    credit: z.number().nonnegative(),
  })).min(2),
});

/** Posts a balanced journal atomically; rejects unbalanced input with 400. */
app.post('/accounting/journal', async (request, reply) => {
  const parsed = journalSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.issues });
  const tenantId = assertTenant(request);
  const body = parsed.data;
  try {
    const rows = await one<any[]>(
      tenantId,
      `SELECT fn_post_journal($1, $2, $3, $4, $5, $6::jsonb, $7) AS journal_id`,
      [tenantId, body.branchId || null, body.date, body.description, body.sourceDocument,
       JSON.stringify(body.lines), String(request.auth?.sub || 'api')]
    );
    return { journalId: String(rows?.[0]?.journal_id) };
  } catch (error: any) {
    return reply.code(400).send({ error: 'posting_rejected', message: error?.message });
  }
});

const receiptSchema = z.object({
  branchId: z.string().min(1),
  customerCode: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(8),
  paymentAccountId: z.string().min(1),
  service: z.string().optional(),
  receipt: z.record(z.any()),
});

/** Records a customer collection receipt atomically (payment account debit / customer credit). */
app.post('/accounting/receipt', async (request, reply) => {
  const parsed = receiptSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
  const tenantId = assertTenant(request);
  const b = parsed.data;
  try {
    const rows = await one<any[]>(
      tenantId,
      `SELECT fn_post_customer_receipt($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) AS result`,
      [tenantId, b.branchId, b.customerCode, b.amount, b.date, b.paymentAccountId,
       b.service || '', JSON.stringify(b.receipt), String(request.auth?.sub || 'api')]
    );
    return { result: rows?.[0]?.result };
  } catch (error: any) {
    return reply.code(400).send({ error: 'posting_rejected', message: error?.message });
  }
});

/** Reverses a journal atomically (the original is kept). */
app.post('/accounting/journal/:id/reverse', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = z.object({ reason: z.string().min(3) }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
  const tenantId = assertTenant(request);
  try {
    const rows = await one<any[]>(
      tenantId,
      `SELECT fn_reverse_journal($1,$2,$3,$4) AS journal_id`,
      [tenantId, id, parsed.data.reason, String(request.auth?.sub || 'api')]
    );
    return { journalId: String(rows?.[0]?.journal_id) };
  } catch (error: any) {
    return reply.code(400).send({ error: 'reversal_rejected', message: error?.message });
  }
});

/** Authoritative account balances straight from the ledger. */
app.get('/accounting/balances', async (request) => {
  const tenantId = assertTenant(request);
  const rows = await one<any[]>(
    tenantId,
    `SELECT code, name_ar, account_type, balance FROM accounts ORDER BY code`,
    []
  );
  return { balances: rows || [] };
});

app.setErrorHandler((error, request, reply) => {
  const status = (error as any).statusCode || 500;
  if (status >= 500) request.log.error(error);
  reply.code(status).send({ error: (error as any)?.message || 'internal_error' });
});

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`API listening on :${PORT}`);
