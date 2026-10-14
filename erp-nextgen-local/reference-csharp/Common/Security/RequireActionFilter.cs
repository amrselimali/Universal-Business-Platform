using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace Erp.Common.Security;

public class RequireActionFilter : IEndpointFilter
{
    private readonly NpgsqlDataSource _db;

    public RequireActionFilter(NpgsqlDataSource db)
    {
        _db = db;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var http = ctx.HttpContext;
        var user = http.User;

        if (!user.Identity?.IsAuthenticated ?? true)
            return Results.Unauthorized();

        // 1. تحديد كود الفعل المطلوب من المسار والعملية: e.g. "inventory.item.save"
        var module = ctx.GetArgument<string>(0);
        var entity = ctx.GetArgument<string>(1);
        var httpMethod = http.Request.Method;
        var verb = httpMethod switch {
            "GET" => "read",
            "POST" => "create",
            "PUT" => "save",
            "DELETE" => "delete",
            _ => "execute"
        };
        var actionCode = $"{module}.{entity}.{verb}";

        var tenantId = user.GetTenantId();
        var userId = user.GetUserId();

        await using var conn = await _db.OpenConnectionAsync();

        // 2. فحص مصفوفة الصلاحيات مع عزل الـ Tenant
        const string checkSql = @"
            SELECT p.scope 
            FROM core.permissions p
            JOIN core.user_roles ur ON ur.role_id = p.role_id AND ur.tenant_id = p.tenant_id
            WHERE p.tenant_id = @tenantId 
              AND ur.user_id = @userId 
              AND p.action_code = @actionCode
            LIMIT 1;";

        var grantedScope = await conn.ExecuteScalarAsync<string?>(checkSql, 
            new { tenantId, userId, actionCode });

        // 3. قاعدة Default-Deny الصارمة: غياب الصف = 403 Forbidden فوري!
        if (grantedScope is null && !user.IsInRole("super_admin"))
        {
            return Results.Problem(
                title: "مرفوض أمنياً (Access Denied)",
                detail: $"ليس لديك الصلاحية المسجلة [{actionCode}] لتنفيذ هذه العملية.",
                statusCode: StatusCodes.Status403Forbidden
            );
        }

        http.Items["ActionScope"] = grantedScope ?? "all";
        return await next(ctx);
    }
}
