using System.Security.Claims;

namespace Erp.Common.Security;

/// <summary>
/// امتدادات قراءة هوية المستخدم والمستأجر من الـ JWT Claims.
/// تُستخدم في كل نقطة نهاية لضبط متغيرات جلسة قاعدة البيانات
/// (app.tenant_id / app.user_id) التي تعتمد عليها سياسات الـ RLS.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    public const string TenantIdClaim = "tenant_id";
    public const string UserIdClaim = "user_id";

    public static Guid GetTenantId(this ClaimsPrincipal user)
    {
        var raw = user.FindFirst(TenantIdClaim)?.Value;
        return Guid.TryParse(raw, out var id)
            ? id
            : throw new UnauthorizedAccessException("لا يوجد tenant_id صالح في الـ Token.");
    }

    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var raw = user.FindFirst(UserIdClaim)?.Value;
        return Guid.TryParse(raw, out var id)
            ? id
            : throw new UnauthorizedAccessException("لا يوجد user_id صالح في الـ Token.");
    }

    public static string? GetCorrelationId(this ClaimsPrincipal user)
        => user.FindFirst("correlation_id")?.Value;
}
