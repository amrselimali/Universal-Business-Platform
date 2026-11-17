using Ubp.Application.Contracts;
using Ubp.Application.Services;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Endpoints;

/// <summary>
/// يستقبل لقطة الشاشة التي ينتجها المتصفح (html2canvas) ويحفظها كـ PNG،
/// ويحذفها عند طلب إعادة الالتقاط. الوصول محمي بجلسة المستخدم وصلاحية دليل المستخدم.
/// </summary>
public static class ManualScreenshotEndpoints
{
    private const long MaxBytes = 12 * 1024 * 1024;

    public static IEndpointRouteBuilder MapManualScreenshotEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/manual/screenshots/{code}", async (string code,
            HttpContext context, ManualScreenshotStore store, PermissionService permissions,
            CancellationToken ct) =>
        {
            var session = context.Items["session"] as SessionUser;
            if (session is null) return Results.Unauthorized();
            if (!await CanManageAsync(session, context, permissions, ct))
                return Results.StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden);
            var path = store.PathForRead(session.User.Id, code);
            if (path is null) return Results.NotFound();
            context.Response.Headers.CacheControl = "private, no-store, max-age=0";
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
                64 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
            return Results.File(stream, "image/png");
        }).RequireAuthorization();

        app.MapPost("/api/v1/manual/screenshots/{code}", async (string code,
            HttpContext context, ManualScreenshotStore store, PermissionService permissions,
            CancellationToken ct) =>
        {
            if (!string.Equals(context.Request.Headers["X-Ubp-Manual"], "1",
                    StringComparison.Ordinal))
                return Results.BadRequest();
            var session = context.Items["session"] as SessionUser;
            if (session is null) return Results.Unauthorized();
            if (!await CanManageAsync(session, context, permissions, ct))
                return Results.StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden);
            if (context.Request.ContentLength is > MaxBytes) return Results.BadRequest();
            if (context.Request.ContentType is null ||
                !context.Request.ContentType.StartsWith("image/png", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest();

            using var buffer = new MemoryStream();
            await context.Request.Body.CopyToAsync(buffer, ct);
            if (buffer.Length < 8 || buffer.Length > MaxBytes) return Results.BadRequest();
            if (!await store.SaveAsync(session.User.Id, code, buffer.ToArray(), ct))
                return Results.BadRequest();
            return Results.Ok(new { url = store.UrlFor(session.User.Id, code) });
        }).RequireAuthorization();

        app.MapDelete("/api/v1/manual/screenshots/{code}", async (string code,
            HttpContext context, ManualScreenshotStore store, PermissionService permissions,
            CancellationToken ct) =>
        {
            if (!string.Equals(context.Request.Headers["X-Ubp-Manual"], "1",
                    StringComparison.Ordinal))
                return Results.BadRequest();
            var session = context.Items["session"] as SessionUser;
            if (session is null) return Results.Unauthorized();
            if (!await CanManageAsync(session, context, permissions, ct))
                return Results.StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden);
            store.Delete(session.User.Id, code);
            return Results.NoContent();
        }).RequireAuthorization();
        return app;
    }

    private static async Task<bool> CanManageAsync(SessionUser session, HttpContext context,
        PermissionService permissions, CancellationToken ct)
    {
        var actor = new ActorContext
        {
            UserId = session.User.Id,
            Username = session.User.Username,
            Name = session.User.Name,
            IsAdmin = session.User.IsAdmin,
            IsSuperAdmin = session.User.IsSuperAdmin,
            MustChangePassword = session.MustChangePassword,
            RequiresShift = session.User.RequiresShift,
            Language = session.UserLanguage,
            CurrentBranchId = session.BranchId,
            FilterBranchIds = session.FilterBranchIds,
            AllowedBranchIds = session.BranchIds,
            AllBranchIds = session.AllBranchIds,
            IpAddress = context.Connection.RemoteIpAddress?.ToString(),
            TraceId = context.Items["TraceId"]?.ToString() ?? context.TraceIdentifier
        };
        try
        {
            await permissions.RequireAsync(actor, ScreenCodes.UserManual, ActionCodes.View, ct: ct);
            return true;
        }
        catch (AppException)
        {
            return false;
        }
    }
}
