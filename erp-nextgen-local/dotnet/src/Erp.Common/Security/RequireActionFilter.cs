using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace Erp.Common.Security;

/// <summary>
/// يحدد كود الفعل المطلوب لنقطة النهاية صراحةً في الـ Action Registry.
/// مثال: .RequireAction("generic.record.read")
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireActionAttribute(string actionCode) : Attribute
{
    public string ActionCode { get; } = actionCode;
}

public static class ActionEndpointExtensions
{
    public static TBuilder RequireAction<TBuilder>(this TBuilder builder, string actionCode)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new RequireActionAttribute(actionCode));
        return builder;
    }
}

/// <summary>
/// فلتر الحماية المركزي: يفرض قاعدة Default-Deny على كل نقطة نهاية.
/// غياب صف في core.permissions = 403 فوراً.
///
/// [إصلاح] النسخة الأصلية في الـ Workbench كانت تستعلم core.permissions
/// بدون ضبط app.tenant_id، وبما أن RLS مفعّل بـ FORCE على هذا الجدول
/// فإن الاستعلام كان يُرجع صفر صفوف دائماً → رفض كل الطلبات.
/// </summary>
public sealed class RequireActionFilter(NpgsqlDataSource db) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var http = ctx.HttpContext;
        var user = http.User;

        if (user.Identity?.IsAuthenticated != true)
            return Results.Unauthorized();

        var actionCode = ResolveActionCode(http);

        var tenantId = user.GetTenantId();
        var userId = user.GetUserId();

        await using var conn = await db.OpenConnectionAsync();

        // 1. ضبط سياق الـ Tenant إجبارياً قبل أي استعلام يخضع للـ RLS
        await conn.ExecuteAsync(
            "SELECT set_config('app.tenant_id', @tenantId::text, false);",
            new { tenantId = tenantId.ToString() });

        // 2. فحص مصفوفة الصلاحيات مع عزل الـ Tenant
        const string checkSql = @"
            SELECT p.scope
            FROM core.permissions p
            JOIN core.user_roles ur
              ON ur.role_id = p.role_id
             AND ur.tenant_id = p.tenant_id
            WHERE p.tenant_id = @tenantId
              AND ur.user_id = @userId
              AND p.action_code = @actionCode
            LIMIT 1;";

        var grantedScope = await conn.ExecuteScalarAsync<string?>(
            checkSql, new { tenantId, userId, actionCode });

        // 3. Default-Deny الصارم
        if (grantedScope is null && !user.IsInRole("super_admin"))
        {
            return Results.Problem(
                title: "مرفوض أمنياً (Access Denied)",
                detail: $"ليس لديك الصلاحية المسجلة [{actionCode}] لتنفيذ هذه العملية.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        http.Items["ActionScope"] = grantedScope ?? "all";
        http.Items["ActionCode"] = actionCode;

        return await next(ctx);
    }

    /// <summary>
    /// الأولوية: كود الفعل المُعرَّف صراحةً على نقطة النهاية، وإلا يُشتق
    /// تلقائياً من المسار + طريقة الـ HTTP (نمط module.entity.verb).
    /// </summary>
    private static string ResolveActionCode(HttpContext http)
    {
        var explicitCode = http.GetEndpoint()?.Metadata.GetMetadata<RequireActionAttribute>()?.ActionCode;
        if (!string.IsNullOrWhiteSpace(explicitCode))
            return explicitCode;

        var module = http.Request.RouteValues["module"]?.ToString() ?? "core";
        var entity = http.Request.RouteValues["entity"]?.ToString() ?? "record";
        var verb = http.Request.Method switch
        {
            "GET" => "read",
            "POST" => "create",
            "PUT" or "PATCH" => "save",
            "DELETE" => "delete",
            _ => "execute"
        };

        return $"{module}.{entity}.{verb}";
    }
}
