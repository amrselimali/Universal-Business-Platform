using System.Text.Json;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Erp.Common.Security;
using Erp.Common.Metadata;

namespace Erp.Services.GenericData.Endpoints;

public static class GenericDataEndpoints
{
    public static void MapGenericDataRoutes(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/generic/{module}.{entity}")
                       .RequireAuthorization();

        // 1. GET with Keyset Pagination O(1)
        group.MapGet("", async (
            string module, 
            string entity,
            [FromQuery] string? afterDate,
            [FromQuery] Guid? afterId,
            [FromQuery] int limit,
            [FromServices] IMetadataRegistry metadata,
            [FromServices] NpgsqlDataSource dataSource,
            HttpContext ctx) =>
        {
            var tenantId = ctx.User.GetTenantId();
            var targetEntity = metadata.GetEntity(module, entity);
            limit = Math.Clamp(limit == 0 ? 50 : limit, 1, 200);

            await using var conn = await dataSource.OpenConnectionAsync();
            // حقن معرف الـ Tenant للـ RLS
            await conn.ExecuteAsync("SELECT set_config('app.tenant_id', @tenantId::text, true);", 
                new { tenantId });

            string sql = $@"
                SELECT * FROM {targetEntity.FullTableName}
                WHERE (@afterDate IS NULL OR (created_at, id) < (@afterDate::timestamptz, @afterId))
                ORDER BY created_at DESC, id DESC
                LIMIT @limit;";

            var records = await conn.QueryAsync(sql, new { afterDate, afterId, limit });
            return Results.Ok(new { items = records, count = records.Count() });
        })
        .AddEndpointFilter<RequireActionFilter>();

        // 2. PUT with Optimistic Concurrency (version check)
        group.MapPut("", async (
            string module,
            string entity,
            [FromBody] JsonElement payload,
            [FromServices] IMetadataRegistry metadata,
            [FromServices] NpgsqlDataSource dataSource,
            HttpContext ctx) =>
        {
            var tenantId = ctx.User.GetTenantId();
            var userId = ctx.User.GetUserId();
            var targetEntity = metadata.GetEntity(module, entity);

            var id = payload.GetProperty("id").GetGuid();
            var clientVersion = payload.GetProperty("version").GetInt32();

            await using var conn = await dataSource.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();

            // ضبط متغيرات الجلسة (Tenant + User للـ Audit)
            await conn.ExecuteAsync(@"
                SELECT set_config('app.tenant_id', @tenantId::text, true);
                SELECT set_config('app.user_id', @userId::text, true);",
                new { tenantId, userId }, tx);

            var updateAssignments = targetEntity.BuildUpdateSqlAssignments(payload);
            string updateSql = $@"
                UPDATE {targetEntity.FullTableName}
                SET {updateAssignments},
                    updated_at = clock_timestamp(),
                    updated_by = @userId
                WHERE id = @id AND version = @clientVersion
                RETURNING version;";

            var newVersion = await conn.ExecuteScalarAsync<int?>(updateSql, 
                new { id, clientVersion, userId }, tx);

            if (newVersion is null)
            {
                await tx.RollbackAsync();
                // 409 Conflict: تم تعديل السجل بواسطة مستخدم آخر بالتزامن!
                return Results.Conflict(new { 
                    error = "DbConcurrencyException", 
                    message = "السجل تم تعديله من مشغل آخر، يرجى تحديث الشاشة.",
                    expectedVersion = clientVersion 
                });
            }

            await tx.CommitAsync();
            return Results.Ok(new { success = true, id, version = newVersion.Value });
        })
        .AddEndpointFilter<RequireActionFilter>();
    }
}
