using System.Text;
using Ubp.Application.Contracts;
using Ubp.Application.Services;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Endpoints;

/// <summary>
/// تصدير تقارير المرتبات كملفات (بند 13.2): مصنّف Excel متعدد الأوراق + تقرير التأمين + الإعفاءات.
/// الصلاحية: payroll.reports -- export لكل طلب، ولا يُولَّد أي ملف قبل التحقق.
/// </summary>
public static class PayrollReportEndpoints
{
    public static IEndpointRouteBuilder MapPayrollReportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/payroll/runs/{runId:guid}/workbook.xls", async (Guid runId, HttpContext context,
            PayrollReportingService reporting, PermissionService permissions, CancellationToken ct) =>
        {
            var actor = ActorOf(context);
            if (actor is null) return Results.Unauthorized();
            if (!await permissions.HasAsync(actor, ScreenCodes.PayrollReports, ActionCodes.Export, ct))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            var xml = await reporting.ExportWorkbookXmlAsync(runId, ct);
            return Results.File(Encoding.UTF8.GetBytes(xml), "application/vnd.ms-excel",
                $"payroll-{runId:N}.xls");
        }).RequireAuthorization();

        app.MapGet("/api/v1/payroll/runs/{runId:guid}/insurance.csv", async (Guid runId, HttpContext context,
            PayrollReportingService reporting, PermissionService permissions, CancellationToken ct) =>
        {
            var actor = ActorOf(context);
            if (actor is null) return Results.Unauthorized();
            if (!await permissions.HasAsync(actor, ScreenCodes.PayrollReports, ActionCodes.Export, ct))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            var csv = await reporting.ExportInsuranceCsvAsync(runId, ct);
            return Results.File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv", $"payroll-insurance-{runId:N}.csv");
        }).RequireAuthorization();

        app.MapGet("/api/v1/payroll/tax-exemptions.csv", async (DateTime? asOf, HttpContext context,
            PayrollReportingService reporting, PermissionService permissions, CancellationToken ct) =>
        {
            var actor = ActorOf(context);
            if (actor is null) return Results.Unauthorized();
            if (!await permissions.HasAsync(actor, ScreenCodes.PayrollReports, ActionCodes.Export, ct))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            var date = DateOnly.FromDateTime(asOf ?? DateTime.Today);
            var csv = await reporting.ExportExemptionsCsvAsync(date, ct);
            return Results.File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
                "text/csv", $"payroll-tax-exemptions-{date:yyyyMMdd}.csv");
        }).RequireAuthorization();

        return app;
    }

    /// <summary>سياق الفاعل من الجلسة — لا يُقبل أي طلب بلا جلسة مصادَق عليها.</summary>
    private static ActorContext? ActorOf(HttpContext context)
    {
        var session = context.Items["session"] as SessionUser;
        if (session is null) return null;
        return new ActorContext
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
    }
}
