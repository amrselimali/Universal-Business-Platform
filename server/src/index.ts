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
  /**
   * الأفعال المسموحة للمستخدم (Action Registry) — صلاحيات على مستوى الزر لا الشاشة.
   * غياب الفعل = ممنوع (Default-Deny). القيمة '*' تعني كل الأفعال.
   */
  allowedActions?: string[];
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
    allowedActions: Array.isArray(account.payload?.allowedActions) ? account.payload.allowedActions : [],
  };
  const token = jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN } as any);
  if (!account.payload?.passwordHash && account.payload?.password) {
    request.log.warn(`User ${username} still stores a plaintext password - migrate to passwordHash`);
  }
  return { token, user: { id: payload.sub, tenantId: payload.tenantId, role: payload.role } };
});

app.get('/me', async (request) => ({ auth: request.auth }));

// ---------------------------------------------------------------------------
// محرك الشاشات (Metadata Registry)
// ---------------------------------------------------------------------------
/**
 * يُرجع تعريف الشاشات والأفعال والكيانات وحقولها.
 *
 * هذا هو ما يجعل إضافة حقل أو شاشة **بيانات** لا كوداً: الواجهة تقرأ من هنا
 * ولا تحتاج إعادة بناء. البيانات تُدار في جداول erp_* (انظر
 * scripts/neon_metadata_engine.sql).
 *
 * الجداول غير تابعة لمنشأة (configuration عام)، لذلك لا تخضع للـ RLS،
 * لكن الوصول يظل محمياً بالتوكن (preHandler).
 */
app.get('/metadata/registry', async () => {
  const [views, actions, entities, fields, screens] = await Promise.all([
    rawQuery<any[]>(`SELECT id, name_ar, name_en, description_ar, description_en,
                            icon_name, category, sort_order
                       FROM erp_views WHERE is_active = TRUE
                      ORDER BY sort_order, id`),
    rawQuery<any[]>(`SELECT key, name_ar, name_en, view_id, description_ar, description_en, sort_order
                       FROM erp_actions ORDER BY sort_order, key`),
    rawQuery<any[]>(`SELECT code, table_name, display_name_ar, display_name_en, view_id, soft_delete
                       FROM erp_entities WHERE is_active = TRUE ORDER BY code`),
    rawQuery<any[]>(`SELECT id, entity_code, column_name, label_ar, label_en, data_type,
                            is_required, is_readonly, grid_visible, form_order, width
                       FROM erp_entity_fields ORDER BY entity_code, form_order`),
    rawQuery<any[]>(`SELECT code, view_id, entity_code, kind, route, menu_group, sort_order, icon
                       FROM erp_screens ORDER BY sort_order, code`),
  ]);

  const fieldsByEntity = new Map<string, any[]>();
  for (const row of fields || []) {
    const key = String(row.entity_code);
    const list = fieldsByEntity.get(key) || [];
    list.push({
      id: Number(row.id),
      columnName: row.column_name,
      labelAr: row.label_ar,
      labelEn: row.label_en,
      dataType: row.data_type,
      isRequired: Boolean(row.is_required),
      isReadonly: Boolean(row.is_readonly),
      gridVisible: Boolean(row.grid_visible),
      formOrder: Number(row.form_order),
      width: Number(row.width),
    });
    fieldsByEntity.set(key, list);
  }

  return {
    views: (views || []).map((v: any) => ({
      id: v.id,
      nameAr: v.name_ar,
      nameEn: v.name_en,
      descriptionAr: v.description_ar || '',
      descriptionEn: v.description_en || '',
      iconName: v.icon_name || 'Layers',
      category: v.category,
      sortOrder: Number(v.sort_order),
    })),
    actions: (actions || []).map((a: any) => ({
      key: a.key,
      nameAr: a.name_ar,
      nameEn: a.name_en,
      viewId: a.view_id,
      descriptionAr: a.description_ar || undefined,
      descriptionEn: a.description_en || undefined,
      sortOrder: Number(a.sort_order),
    })),
    entities: (entities || []).map((e: any) => ({
      code: e.code,
      tableName: e.table_name,
      displayNameAr: e.display_name_ar,
      displayNameEn: e.display_name_en,
      viewId: e.view_id,
      softDelete: Boolean(e.soft_delete),
      fields: fieldsByEntity.get(String(e.code)) || [],
    })),
    screens: (screens || []).map((s: any) => ({
      code: s.code,
      viewId: s.view_id,
      entityCode: s.entity_code,
      kind: s.kind,
      route: s.route,
      menuGroup: s.menu_group,
      sortOrder: Number(s.sort_order),
      icon: s.icon,
    })),
  };
});

/** Guarantees the caller may operate on the requested tenant. */
function assertTenant(request: any, requestedTenantId?: string): string {
  const auth = request.auth as TokenPayload;
  const target = requestedTenantId || auth.tenantId;
  if (target !== auth.tenantId && !auth.allowedTenantIds.includes(target)) {
    throw Object.assign(new Error('tenant_forbidden'), { statusCode: 403 });
  }
  return target;
}

/**
 * فحص صلاحية على مستوى الزر (Action Registry) بقاعدة Default-Deny.
 *
 * هذا هو الفرق بين «المستخدم يشوف الشاشة» و«المستخدم يملك حق تنفيذ الفعل»:
 *   - allowedViews تسمح بفتح الشاشة.
 *   - allowedActions تسمح بالضغط على زر معيّن داخلها.
 *
 * غياب الفعل من القائمة = 403 فوري، حتى لو كان المستخدم يرى الشاشة.
 * القيمة '*' (أو دور SuperAdmin) تعني كل الأفعال.
 */
function assertAction(request: any, actionCode: string): void {
  const auth = request.auth as TokenPayload;
  const actions = auth.allowedActions || [];
  const isSuper = auth.role === 'SuperAdmin' || actions.includes('*');
  if (isSuper || actions.includes(actionCode)) return;

  throw Object.assign(new Error('action_not_allowed'), {
    statusCode: 403,
    actionCode,
    detail: `ليس لديك الصلاحية المسجّلة [${actionCode}] لتنفيذ هذه العملية.`,
  });
}

// ---------------------------------------------------------------------------
// معالج الأخطاء الموحّد: يحوّل الأخطاء المرفوعة إلى ردود JSON واضحة
// ---------------------------------------------------------------------------
app.setErrorHandler((error: any, request, reply) => {
  const statusCode = Number(error?.statusCode) || 500;

  if (statusCode === 403) {
    return reply.code(403).send({
      error: error?.message || 'forbidden',
      actionCode: error?.actionCode,
      message: error?.detail || 'مرفوض أمنياً: لا تملك الصلاحية لتنفيذ هذه العملية.',
    });
  }

  if (statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({ error: error?.message || 'bad_request' });
  }

  request.log.error(error);
  return reply.code(500).send({ error: 'internal_error' });
});

// ---------------------------------------------------------------------------
// إدارة الـ Metadata (Metadata Studio)
// ---------------------------------------------------------------------------
/**
 * تعديل حقول الكيانات من الواجهة مباشرة — بلا نشر ولا إعادة بناء.
 *
 * ⚠️ ملاحظة أمنية: هذه الجداول إعدادات عامة (لا تخص منشأة بعينها)، لذلك
 * تقتصر الكتابة على دور SuperAdmin. غياب الفحص يعني أن أي مستخدم يستطيع
 * تغيير واجهة كل الشركات.
 */
function assertSuperAdmin(request: any): void {
  const auth = request.auth as TokenPayload;
  const isSuper =
    auth.role === 'SuperAdmin' ||
    (auth.allowedActions || []).includes('*') ||
    (auth.allowedViews || []).includes('*');

  if (!isSuper) {
    throw Object.assign(new Error('metadata_forbidden'), {
      statusCode: 403,
      detail: 'تعديل تعريفات الشاشات متاح للمدير العام فقط.',
    });
  }
}

const metadataFieldSchema = z.object({
  entityCode: z.string().min(1).max(150),
  columnName: z.string().min(1).max(150),
  labelAr: z.string().min(1).max(255),
  labelEn: z.string().min(1).max(255),
  dataType: z.enum(['string', 'number', 'currency', 'badge', 'date', 'select', 'boolean', 'json']),
  isRequired: z.boolean().optional(),
  isReadonly: z.boolean().optional(),
  gridVisible: z.boolean().optional(),
  formOrder: z.number().int().min(0).max(9999).optional(),
  width: z.number().int().min(40).max(1200).optional(),
});

/** إضافة حقل جديد لكيان. */
app.post('/metadata/fields', async (request, reply) => {
  assertSuperAdmin(request);
  const parsed = metadataFieldSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.issues });
  }
  const f = parsed.data;

  const rows = await rawQuery<any[]>(
    `INSERT INTO erp_entity_fields
       (entity_code, column_name, label_ar, label_en, data_type,
        is_required, is_readonly, grid_visible, form_order, width)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (entity_code, column_name) DO UPDATE SET
       label_ar = EXCLUDED.label_ar,
       label_en = EXCLUDED.label_en,
       data_type = EXCLUDED.data_type,
       is_required = EXCLUDED.is_required,
       is_readonly = EXCLUDED.is_readonly,
       grid_visible = EXCLUDED.grid_visible,
       form_order = EXCLUDED.form_order,
       width = EXCLUDED.width
     RETURNING id`,
    [
      f.entityCode, f.columnName, f.labelAr, f.labelEn, f.dataType,
      f.isRequired ?? false, f.isReadonly ?? false, f.gridVisible ?? true,
      f.formOrder ?? 10, f.width ?? 150,
    ]
  );

  return { id: rows?.[0]?.id ?? null, saved: true };
});

/** تعديل حقل موجود (بالمعرّف). */
app.put('/metadata/fields/:id', async (request, reply) => {
  assertSuperAdmin(request);
  const { id } = request.params as { id: string };
  const parsed = metadataFieldSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.issues });
  }

  const f = parsed.data;
  const rows = await rawQuery<any[]>(
    `UPDATE erp_entity_fields SET
       label_ar     = COALESCE($2, label_ar),
       label_en     = COALESCE($3, label_en),
       data_type    = COALESCE($4, data_type),
       is_required  = COALESCE($5, is_required),
       is_readonly  = COALESCE($6, is_readonly),
       grid_visible = COALESCE($7, grid_visible),
       form_order   = COALESCE($8, form_order),
       width        = COALESCE($9, width)
     WHERE id = $1
     RETURNING id`,
    [
      Number(id),
      f.labelAr ?? null, f.labelEn ?? null, f.dataType ?? null,
      f.isRequired ?? null, f.isReadonly ?? null, f.gridVisible ?? null,
      f.formOrder ?? null, f.width ?? null,
    ]
  );

  if (!rows || rows.length === 0) {
    return reply.code(404).send({ error: 'field_not_found' });
  }
  return { id: rows[0].id, saved: true };
});

/** حذف حقل من الكيان. */
app.delete('/metadata/fields/:id', async (request, reply) => {
  assertSuperAdmin(request);
  const { id } = request.params as { id: string };
  const rows = await rawQuery<any[]>(
    `DELETE FROM erp_entity_fields WHERE id = $1 RETURNING id`,
    [Number(id)]
  );
  if (!rows || rows.length === 0) {
    return reply.code(404).send({ error: 'field_not_found' });
  }
  return { id: rows[0].id, deleted: true };
});

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

const upsertSchema = z.object({
  records: z.array(z.record(z.any())).min(1).max(1000),
  /** عند تفعيله، يرفض الخادم أي كتابة تُلغي تعديلاً أحدث موجود على الخادم. */
  enforceVersion: z.boolean().optional(),
});

/**
 * فحص التزامن المتفائل (Optimistic Concurrency).
 *
 * يقارن إصدار كل سجل قادم بالإصدار المخزَّن، ويرجع قائمة التعارضات.
 * الاعتماد على `version` الرقمي (لا على الطوابع الزمنية) يمنع الكتابة فوق
 * تعديلات مستخدم آخر حتى لو كانت ساعات الأجهزة مختلفة.
 */
async function findVersionConflicts(
  tenantId: string,
  docKey: string,
  incoming: Record<string, any>[]
): Promise<{ id: string; serverVersion: number; clientVersion: number }[]> {
  const ids = incoming.map((r) => String(r?.id ?? '')).filter(Boolean);
  if (ids.length === 0) return [];

  const rows = await one<any[]>(
    tenantId,
    `SELECT record_id, payload->>'version' AS version
       FROM app_records
      WHERE tenant_id = $1
        AND doc_key = $2
        AND record_id = ANY($3)
        AND deleted_at IS NULL`,
    [tenantId, docKey, ids]
  );

  const conflicts: { id: string; serverVersion: number; clientVersion: number }[] = [];
  for (const row of rows || []) {
    const recordId = String(row.record_id);
    const serverVersion = Number(row.version);
    const clientRecord = incoming.find((r) => String(r?.id ?? '') === recordId);
    const clientVersion = Number(clientRecord?.version);

    if (!Number.isFinite(serverVersion) || !Number.isFinite(clientVersion)) continue;

    // تعارض حقيقي: الخادم أحدث من النسخة التي عدّلها العميل.
    if (serverVersion > clientVersion) {
      conflicts.push({ id: recordId, serverVersion, clientVersion });
    }
  }
  return conflicts;
}

/** Upserts records (one transaction, tenant-scoped) with optional version enforcement. */
app.post('/records/:docKey', async (request, reply) => {
  const { docKey } = request.params as { docKey: string };
  const parsed = upsertSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
  const tenantId = assertTenant(request);
  assertAction(request, 'record.save');
  const actor = String(request.auth?.sub || 'api');

  if (parsed.data.enforceVersion === true) {
    const conflicts = await findVersionConflicts(tenantId, docKey, parsed.data.records);
    if (conflicts.length > 0) {
      return reply.code(409).send({
        error: 'version_conflict',
        message: 'تم تعديل بعض السجلات من مستخدم آخر. حدّث الشاشة ثم أعد المحاولة.',
        conflicts,
      });
    }
  }

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
  assertAction(request, 'record.delete');
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
  assertAction(request, 'journal.post');
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
  assertAction(request, 'receipt.create');
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
  assertAction(request, 'journal.reverse');
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

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`API listening on :${PORT}`);
