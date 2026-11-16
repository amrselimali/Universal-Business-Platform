using Ubp.Application.Contracts;
using Ubp.Application.Services;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Endpoints;

/// <summary>
/// تنزيل ملفات تصدير قاعدة البيانات. الرمز عشوائي لمرة واحدة ومربوط بالمستخدم والصلاحية،
/// ويُعاد فحص الجلسة والصلاحية على الخادم قبل إرسال الملف — لا يوجد رابط عام أو دائم.
/// </summary>
public static class DatabaseExportEndpoints
{
    private const string ExcelContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapDatabaseExportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/admin/database/export/download/{token}",
            async (string token, HttpContext context, DatabaseExportFileStore store,
                PermissionService permissions, CancellationToken ct) =>
            {
                var session = context.Items["session"] as SessionUser;
                if (session is null) return Results.Unauthorized();

                var ticket = store.Take(token);
                if (ticket is null) return Results.NotFound();
                if (ticket.UserId != session.User.Id)
                {
                    store.Discard(ticket);
                    return Results.StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden);
                }

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

                if (!actor.IsSuperAdmin)
                {
                    store.Discard(ticket);
                    return Results.StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden);
                }

                try
                {
                    await permissions.RequireAsync(actor, ScreenCodes.DatabaseAdmin,
                        ticket.PermissionAction, ct: ct);
                }
                catch (AppException)
                {
                    store.Discard(ticket);
                    return Results.StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden);
                }

                context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
                Stream stream;
                try
                {
                    stream = new FileStream(ticket.FilePath, FileMode.Open, FileAccess.Read,
                        FileShare.Read, 64 * 1024,
                        FileOptions.Asynchronous | FileOptions.DeleteOnClose);
                }
                catch (IOException)
                {
                    return Results.NotFound();
                }
                return Results.File(stream, ExcelContentType, ticket.FileName);
            }).RequireAuthorization();
        return app;
    }
}
