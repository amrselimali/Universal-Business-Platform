/**
 * جدول الثوابت المعمارية وقياسها (Architecture Invariants)
 * ---------------------------------------------------------------------------
 * فُصل من `scripts/architecture-guardrails.mjs` لسببين:
 *   1. أن يبقى ملف البوابات نفسه تحت حد 300 سطر (القاعدة التي يفرضها).
 *   2. أن يكون جدول الثوابت مصدراً واحداً واضحاً للمراجعة والتوسعة.
 *
 * `expected` هو **الحد الأدنى المقبول** في التصميم المعتمد، لا الرقم المرغوب.
 * `severity: 'advisory'` لا يُفشل البوابة، لكنه يُعرض كتوصية للتوسع.
 */

/** نطاق كود العميل الجديد: يجب ألا يستورد أي عميل قاعدة بيانات. */
export const CLIENT_SCOPE_PREFIXES = [
  'src/services/architectureGuardrails.ts',
  'src/components/architecture/',
  'src/components/ViewRenderer.tsx',
  'src/data/architecture/',
  'src/views/ArchitectureView.tsx',
];

const migrations = (file) => file.path.startsWith('erp-nextgen-local/db/migrations/');
const engineScope = (file) => file.path.startsWith('erp-nextgen-local/');
const clientScope = (file) => CLIENT_SCOPE_PREFIXES.some((prefix) => file.path.startsWith(prefix));

export const INVARIANT_DEFS = [
  { id: 'rls_enabled_tables', labelAr: 'جداول عليها RLS مفعّل وإجباري', labelEn: 'Tables with RLS enabled and forced',
    comparison: 'atLeast', expected: 5, severity: 'required', scope: migrations, pattern: /FORCE ROW LEVEL SECURITY/g },
  { id: 'rls_tenant_policies', labelAr: 'سياسات عزل المنشأة (tenant_isolation)', labelEn: 'Tenant isolation policies',
    comparison: 'atLeast', expected: 5, severity: 'required', scope: migrations, pattern: /CREATE POLICY\s+tenant_isolation/g },
  { id: 'tenant_session_context', labelAr: 'ضبط سياق المنشأة set_config(app.tenant_id)', labelEn: 'Tenant session context set_config(app.tenant_id)',
    comparison: 'atLeast', expected: 2, severity: 'required', scope: engineScope, pattern: /set_config\('app\.tenant_id'/g },
  { id: 'version_columns', labelAr: 'أعمدة version للتزامن المتفائل', labelEn: 'version columns for optimistic concurrency',
    comparison: 'atLeast', expected: 4, severity: 'required', scope: migrations, pattern: /version\s+integer\s+NOT NULL DEFAULT 1/g },
  { id: 'version_conditional_update', labelAr: 'تحديث مشروط بالنسخة (version = @clientVersion)', labelEn: 'Version-conditional updates',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /version\s*=\s*@clientVersion/g },
  { id: 'version_bump_trigger', labelAr: 'Trigger يزيد الإصدار تلقائياً (touch_row)', labelEn: 'Automatic version bump trigger',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: migrations, pattern: /NEW\.version\s*:=\s*OLD\.version \+ 1/g },
  { id: 'realtime_notify_trigger', labelAr: 'دالة بث pg_notify داخل نفس المعاملة', labelEn: 'pg_notify realtime function in-transaction',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: migrations, pattern: /pg_notify\('table_changes'/g },
  { id: 'listen_bridge', labelAr: 'جسر LISTEN على قناة التغييرات', labelEn: 'LISTEN bridge on the change channel',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /LISTEN table_changes/g },
  { id: 'signalr_tenant_broadcast', labelAr: 'بث SignalR لمجموعة المنشأة فقط', labelEn: 'SignalR broadcast to the tenant group only',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /Clients\.Group\(/g },
  { id: 'yarp_routes', labelAr: 'مسارات توجيه YARP في البوابة', labelEn: 'YARP proxy routes in the gateway',
    comparison: 'atLeast', expected: 3, severity: 'required', scope: engineScope, pattern: /"ClusterId":/g },
  { id: 'tenant_rate_limiter', labelAr: 'Rate Limiting لكل منشأة', labelEn: 'Per-tenant rate limiting',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /AddRateLimiter/g },
  { id: 'default_deny_filter', labelAr: 'فلتر Default-Deny يرجع 403 صريحاً', labelEn: 'Default-Deny filter returning 403',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /Status403Forbidden/g },
  { id: 'http_only_cookie', labelAr: 'Refresh Cookie بـ HttpOnly', labelEn: 'HttpOnly refresh cookie',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /HttpOnly\s*=\s*true/g },
  { id: 'refresh_token_hashed', labelAr: 'تخزين هاش Refresh Token (SHA-256)', labelEn: 'Hashed refresh tokens (SHA-256)',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /SHA256\.HashData/g },
  { id: 'keyset_pagination', labelAr: 'ترقيم Keyset بدل OFFSET', labelEn: 'Keyset pagination instead of OFFSET',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /\(created_at, id\)\s*</g },
  { id: 'soft_delete', labelAr: 'حذف ناعم (deleted_at) بلا فقد بيانات', labelEn: 'Soft delete (deleted_at)',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /deleted_at IS NULL/g },
  { id: 'metadata_registry', labelAr: 'سجل Metadata يقود الشاشات ونقاط النهاية', labelEn: 'Metadata registry driving screens and endpoints',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: engineScope, pattern: /IMetadataRegistry|class MetadataRegistry/g },
  { id: 'transactional_outbox', labelAr: 'Outbox ذري لعدم فقد الحركات', labelEn: 'Transactional outbox',
    comparison: 'atLeast', expected: 1, severity: 'required', scope: migrations, pattern: /outbox_events/g },
  {
    id: 'no_client_db_driver',
    labelAr: 'كود العميل الجديد لا يستورد أي عميل قاعدة بيانات',
    labelEn: 'New client code imports no database driver',
    comparison: 'none',
    expected: 0,
    severity: 'required',
    scope: clientScope,
    pattern: /from '@neondatabase\/serverless'|from 'pg'|require\('pg'\)|NpgsqlConnection/g,
  },
  { id: 'always_on_runtime', labelAr: 'تشغيل دائم بلا Scale-to-Zero', labelEn: 'Always-on runtime (no scale-to-zero)',
    comparison: 'atLeast', expected: 1, severity: 'advisory', scope: engineScope, pattern: /restart:\s*(unless-stopped|always)/g },
  { id: 'connection_pooling_guard', labelAr: 'PgBouncer أو حد اتصالات صريح قبل التوسع', labelEn: 'PgBouncer or an explicit connection cap',
    comparison: 'atLeast', expected: 1, severity: 'advisory', scope: engineScope, pattern: /pgbouncer|Maximum Pool Size|MaxPoolSize/gi },
  { id: 'emitted_events_pipeline', labelAr: 'معالجة الأحداث المُصدَّرة بلا تكرار', labelEn: 'Idempotent event processing',
    comparison: 'atLeast', expected: 1, severity: 'advisory', scope: engineScope, pattern: /processed_events/g },
];

/** يقيس كل ثابت على ملفات نطاق المحرك ويُرجع النتيجة مع أدلتها. */
export const measureInvariants = (files) =>
  INVARIANT_DEFS.map((def) => {
    let found = 0;
    const evidence = new Set();
    for (const file of files) {
      if (!def.scope(file)) continue;
      const matches = [...file.text.matchAll(new RegExp(def.pattern.source, def.pattern.flags))];
      if (matches.length === 0) continue;
      found += matches.length;
      evidence.add(file.path);
    }
    return {
      id: def.id,
      labelAr: def.labelAr,
      labelEn: def.labelEn,
      comparison: def.comparison,
      expected: def.expected,
      found,
      severity: def.severity,
      evidence: [...evidence].sort(),
    };
  });

