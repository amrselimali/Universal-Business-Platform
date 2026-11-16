using System.Diagnostics;
using Dapper;
using Microsoft.Extensions.Logging;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Data;

namespace Ubp.Application.Services;

/// <summary>
/// الفحص المباشر: يقرأ من قاعدة البيانات الفعلية داخل معاملة READ ONLY ولا يكتب أي بيانات.
/// يجمع قياسات الأداء والموارد والقيود ودورات العمل، ثم يرتب المشاكل ويقيّم الحالة.
/// </summary>
public sealed partial class QaService
{
    public async Task<QaAuditReport> RunLiveAuditAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.QaCenter, ActionCodes.RunTests, ct: ct);
        if (string.IsNullOrWhiteSpace(_options.ConnectionString))
            throw new ValidationAppException("qa.database_not_configured");

        var watch = Stopwatch.StartNew();
        var report = new QaAuditReport();
        await using var connection = new NpgsqlConnection(_options.ConnectionString);
        await connection.OpenAsync(ct);
        // حماية صريحة: أي محاولة كتابة داخل هذا الفحص تفشل من قاعدة البيانات نفسها.
        await using var tx = await connection.BeginTransactionAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("SET TRANSACTION READ ONLY",
            transaction: tx, cancellationToken: ct));

        try
        {
            var head = await connection.QuerySingleAsync<(string Version, string Db)>(new CommandDefinition(
                "SELECT current_setting('server_version'), current_database()",
                transaction: tx, cancellationToken: ct));
            report.ServerVersion = head.Version;
            report.Database = head.Db;

            await CollectPerformanceAsync(connection, tx, report, ct);
            await CollectCodeAndConstraintsAsync(connection, tx, report, ct);
            await CollectWorkflowProbesAsync(connection, tx, report, ct);
            await CollectAccountingAsync(connection, tx, report, ct);
            await CollectSecurityAsync(connection, tx, report, ct);
            await CollectSmartCoverageAsync(connection, tx, report, ct);
            // الموارد أخيرًا: تحتاج نتائج الاستعلامات/الجداول/الدورات لتجزئة الاستهلاك.
            await CollectResourcesAsync(connection, tx, report, ct);
            ApplyTableHealth(report);
        }
        catch (Exception ex)
        {
            report.Findings.Add(new QaFinding
            {
                Area = "System", Code = "AUDIT_ABORTED", Severity = QaSeverity.Critical,
                Title = "تعذر إكمال الفحص المباشر", Metric = "",
                Detail = Short(ex.GetBaseException().Message),
                Suggestion = "تحقق من صلاحيات القراءة على قاعدة البيانات ثم أعد الفحص."
            });
            _logger.LogWarning(ex, "QA live audit aborted");
        }
        finally
        {
            await tx.RollbackAsync(ct);
        }

        report.DurationMs = Math.Round(watch.Elapsed.TotalMilliseconds, 1);
        Score(report);
        return report;
    }

    /// <summary>ترتيب النتائج وتقييم الحالة: خصم أوزان حسب الخطورة.</summary>
    private static void Score(QaAuditReport report)
    {
        report.Findings = report.Findings
            .OrderByDescending(f => QaSeverity.Weight(f.Severity))
            .ThenBy(f => f.Area).ToList();
        var penalty = report.Findings.Sum(f => QaSeverity.Weight(f.Severity));
        report.HealthScore = Math.Clamp(100 - penalty, 0, 100);
        report.Grade = report.HealthScore switch
        {
            >= 90 => "A",
            >= 75 => "B",
            >= 60 => "C",
            >= 40 => "D",
            _ => "F"
        };
    }

    internal static string Short(string? text, int max = 400) =>
        string.IsNullOrWhiteSpace(text) ? "" :
        text.Length <= max ? text : text[..max] + "…";

    internal static string HumanSize(long bytes) => bytes switch
    {
        >= 1024L * 1024 * 1024 => $"{bytes / 1024d / 1024 / 1024:0.00} GB",
        >= 1024 * 1024 => $"{bytes / 1024d / 1024:0.0} MB",
        >= 1024 => $"{bytes / 1024d:0.0} KB",
        _ => $"{bytes} B"
    };
}