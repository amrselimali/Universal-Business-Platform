/**
 * مقتطفات الكود المعتمد للمنظومة الجديدة (Clean Production Snippets)
 * ---------------------------------------------------------------------------
 * ⚠️ كل مقتطف منقول من كود **موجود فعلاً في هذا المستودع** تحت `erp-nextgen-local/`
 * (تم اختصار الأسطر غير الجوهرية بعلامة «…» فقط). الغرض: أن يرى المهندس والمالك
 * التنفيذ الحقيقي، لا شريحة عرض توضيحية.
 */

export interface CodeSnippet {
  id: string;
  titleAr: string;
  titleEn: string;
  sourcePath: string;
  language: string;
  noteAr: string;
  noteEn: string;
  code: string;
}

export const ARCHITECTURE_SNIPPETS: CodeSnippet[] = [
  {
    id: 'generic-endpoint',
    titleAr: 'Generic Data API — نقطة نهاية واحدة لكل الكيانات',
    titleEn: 'Generic Data API — one endpoint for every entity',
    sourcePath: 'erp-nextgen-local/dotnet/src/Erp.Api/Endpoints/GenericDataEndpoints.cs',
    language: 'csharp',
    noteAr: 'نقطة واحدة تخدم كل كيان مسجّل: ضبط سياق الـ Tenant داخل نفس المعاملة، ثم تحديث مشروط بالـ version، والتعارض يرجع 409',
    noteEn: 'One endpoint serves every registered entity: tenant context set inside the same transaction, then a version-conditional update returning 409 on conflict',
    code: `private static async Task<IResult> UpdateRecord(
    string module,
    string entity,
    [FromBody] JsonElement payload,
    [FromServices] IMetadataRegistry metadata,
    [FromServices] NpgsqlDataSource dataSource,
    HttpContext ctx)
{
    var tenantId = ctx.User.GetTenantId();
    var userId = ctx.User.GetUserId();
    var target = metadata.GetEntity(module, entity);

    if (!payload.TryGetProperty("id", out var idElement) ||
        !payload.TryGetProperty("version", out var versionElement))
    {
        return Results.BadRequest(new { error = "الحقول id و version مطلوبة في جسم الطلب." });
    }

    var id = idElement.GetGuid();
    var clientVersion = versionElement.GetInt32();

    // أعمدة مسموحة فقط من الـ Metadata — منع SQL Injection بالبناء الآمن
    var (assignments, parameters) = target.BuildUpdateAssignments(payload);
    parameters.Add("id", id);
    parameters.Add("tenantId", tenantId);
    parameters.Add("clientVersion", clientVersion);
    parameters.Add("userId", userId);

    var sql = $"""
        UPDATE {target.QualifiedTableName}
           SET {assignments},
               version    = version + 1,
               updated_at = clock_timestamp(),
               updated_by = @userId
         WHERE id = @id
           AND tenant_id = @tenantId
           AND version = @clientVersion
           AND deleted_at IS NULL
        RETURNING version;
        """;

    await using var conn = await dataSource.OpenConnectionAsync();
    await using var tx = await conn.BeginTransactionAsync();
    await SetSessionContextAsync(conn, tenantId, userId, ctx, tx);

    var newVersion = await conn.ExecuteScalarAsync<int?>(sql, parameters, tx);

    if (newVersion is null)
    {
        await tx.RollbackAsync();
        return Results.Conflict(new
        {
            error = "DbConcurrencyException",
            message = "السجل تم تعديله من مشغل آخر، يرجى تحديث الشاشة.",
            expectedVersion = clientVersion
        });
    }

    await tx.CommitAsync();
    return Results.Ok(new { success = true, id, version = newVersion.Value });
}`,
  },
  {
    id: 'rls-and-concurrency',
    titleAr: 'PostgreSQL — عزل RLS + تزامن متفائل + بث لحظي',
    titleEn: 'PostgreSQL — RLS isolation + optimistic concurrency + realtime push',
    sourcePath: 'erp-nextgen-local/db/migrations/0006_core_rls_policies.sql · 0002_core_functions_and_triggers.sql',
    language: 'sql',
    noteAr: 'العزل ليس شرطاً في الكود: كل جدول عليه سياسة RLS تقرأ app.tenant_id، ودالة touch_row تزيد الإصدار، ودالة البث تنشر الحدث على قناة واحدة',
    noteEn: 'Isolation is not left to application code: every table carries an RLS policy reading app.tenant_id, touch_row bumps the version, and the notify function publishes one event',
    code: `-- 1) تفعيل العزل الإجباري على كل جدول تابع للمنشأة
ALTER TABLE core.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.branches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON core.branches
  FOR ALL
  USING (tenant_id = (SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid))
  WITH CHECK (tenant_id = (SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid));

-- 2) التزامن المتفائل: الإصدار يزيد تلقائياً مع كل تعديل
CREATE OR REPLACE FUNCTION core.touch_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version    := OLD.version + 1;
  NEW.updated_at := clock_timestamp();
  NEW.updated_by := NULLIF(current_setting('app.user_id', true), '')::uuid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) البث اللحظي: الحدث يُنشر داخل نفس المعاملة فلا يضيع
CREATE OR REPLACE FUNCTION core.realtime_notify_func()
RETURNS TRIGGER AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'op',       TG_OP,
    'schema',   TG_TABLE_SCHEMA,
    'table',    TG_TABLE_NAME,
    'id',       NEW.id,
    'version',  NEW.version,
    'tenant_id', NEW.tenant_id,
    'timestamp', clock_timestamp()
  );

  PERFORM pg_notify('table_changes', v_payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;`,
  },
  {
    id: 'signalr-bridge',
    titleAr: 'SignalR LISTEN Bridge — من NOTIFY إلى كل الشاشات',
    titleEn: 'SignalR LISTEN bridge — from NOTIFY to every screen',
    sourcePath: 'erp-nextgen-local/reference-csharp/Services/Realtime/PostgresRealtimeBridge.cs',
    language: 'csharp',
    noteAr: 'خدمة خلفية واحدة تستهلك إشعارات Postgres وتوزّعها على مجموعة المنشأة فقط — لا استعلامات دورية ولا سحب من الشاشات',
    noteEn: 'One background service consumes Postgres notifications and fans them out to the tenant group only — no polling, no screen-side pulling',
    code: `conn.Notification += async (o, e) =>
{
    var json = JsonDocument.Parse(e.Payload);
    var tenantId = json.RootElement.GetProperty("tenant_id").GetString();

    // البث الفوري لمجموعة المنشأة فقط لضمان العزل التام والسرعة القصوى
    if (!string.IsNullOrEmpty(tenantId))
    {
        await _hub.Clients.Group($"tenant_{tenantId}")
            .SendAsync("RecordUpdated", e.Payload, stoppingToken);
    }
};

await using var cmd = new NpgsqlCommand("LISTEN table_changes;", conn);
await cmd.ExecuteNonQueryAsync(stoppingToken);

while (!stoppingToken.IsCancellationRequested)
{
    // استهلاك شبه منعدم للـ CPU (Non-blocking I/O Wait)
    await conn.WaitAsync(stoppingToken);
}`,
  },
  {
    id: 'yarp-routes',
    titleAr: 'YARP Proxy Routes — بوابة موحّدة قبل الخدمات',
    titleEn: 'YARP proxy routes — one gateway in front of the services',
    sourcePath: 'erp-nextgen-local/dotnet/src/Erp.Gateway/appsettings.json',
    language: 'json',
    noteAr: 'كل الطلبات تمر من مسار واحد مع Rate Limiting لكل منشأة، والبوابة تضيف Correlation ID لكل طلب لتتبّع الأثر',
    noteEn: 'All traffic flows through one route set with per-tenant rate limiting, and the gateway stamps a correlation id on every request',
    code: `"ReverseProxy": {
  "Routes": {
    "auth-route":         { "ClusterId": "erp-api-cluster", "Match": { "Path": "/api/v1/auth/{**catch-all}" } },
    "generic-data-route": { "ClusterId": "erp-api-cluster",
                            "Match": { "Path": "/api/v1/generic/{**catch-all}" },
                            "RateLimiterPolicy": "fixed-window-tenant" },
    "system-route":       { "ClusterId": "erp-api-cluster", "Match": { "Path": "/api/v1/system/{**catch-all}" } }
  },
  "Clusters": {
    "erp-api-cluster": { "Destinations": { "primary": { "Address": "http://localhost:5080/" } } }
  }
}

// Erp.Gateway/Program.cs — الحد لكل منشأة لمنع الإغراق
options.AddPolicy("fixed-window-tenant", ctx =>
{
    var tenantId = ctx.User.FindFirst("tenant_id")?.Value ?? "anon";
    return RateLimitPartition.GetFixedWindowLimiter(tenantId, _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 600,                 // 600 طلب بالدقيقة لكل عميل
        Window      = TimeSpan.FromMinutes(1),
        QueueLimit  = 20
    });
});`,
  },
];



