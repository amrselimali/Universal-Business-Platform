using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Security;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>الأعمدة الحساسة: التأكد أن سياسة الإخفاء تغطي كل عمود فعلي.</summary>
    private async Task CheckSensitiveColumnsAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var columns = (await SafeQueryAsync<string>(connection, tx, """
                SELECT table_name || '.' || column_name FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND (column_name LIKE '%password%' OR column_name LIKE '%token%'
                       OR column_name LIKE '%secret%' OR column_name LIKE '%api_key%')
                """, null, ct)).ToList();
            var exposed = columns.Where(c => !c.EndsWith("_id", StringComparison.OrdinalIgnoreCase))
                .Where(c => !IsSensitiveColumn(c.Split('.').Last())).ToList();
            if (exposed.Count > 0)
            {
                report.Findings.Add(new QaFinding
                {
                    Area = "Security", Code = "SEC_SENSITIVE_COLUMNS", Severity = QaSeverity.High,
                    Title = "أعمدة حساسة قد تظهر في الاستعراض/التصدير",
                    Metric = $"{exposed.Count} عمود",
                    Detail = Short(string.Join(", ", exposed.Take(10))),
                    Suggestion = "وسّع قاعدة الإخفاء لتشمل هذه الأعمدة قبل السماح بتصدير الجداول."
                });
                return;
            }
            report.Tests.Add(new QaTestRunRow
            {
                Code = "SEC_SENSITIVE_COLUMNS", Name = "إخفاء الأعمدة الحساسة",
                Category = "Security", Criticality = "high", Status = "Passed",
                Message = $"{columns.Count} عمود حساس مغطى بسياسة الإخفاء"
            });
        }
        catch (Exception ex)
        {
            report.Findings.Add(new QaFinding
            {
                Area = "Security", Code = "SEC_COLUMNS_FAILED", Severity = QaSeverity.Low,
                Title = "تعذر فحص الأعمدة الحساسة", Detail = Short(ex.Message),
                Suggestion = "تحقق من صلاحية قراءة information_schema."
            });
        }
    }

    /// <summary>سطح الهجوم: كل شاشة يجب أن تكون محمية بصلاحية VIEW.</summary>
    private static Task CheckScreenGuardsAsync(QaAuditReport report)
    {
        var unprotected = AppRegistry.Screens
            .Where(s => s.Actions.All(a => a.Code != ActionCodes.View))
            .Select(s => s.Code).ToList();
        if (unprotected.Count > 0)
            report.Findings.Add(new QaFinding
            {
                Area = "Security", Code = "SEC_SCREEN_NO_VIEW", Severity = QaSeverity.High,
                Title = "شاشات بلا صلاحية عرض معلنة",
                Metric = $"{unprotected.Count} شاشة",
                Detail = Short(string.Join(", ", unprotected)),
                Suggestion = "أضف ActionCodes.View لكل شاشة مسجّلة حتى تُطبق سيطرة الوصول."
            });
        else
            report.Tests.Add(new QaTestRunRow
            {
                Code = "SEC_SCREEN_NO_VIEW", Name = "حماية كل الشاشات بصلاحية عرض",
                Category = "Security", Criticality = "high", Status = "Passed",
                Message = $"{AppRegistry.Screens.Count} شاشة محمية"
            });
        return Task.CompletedTask;
    }
}