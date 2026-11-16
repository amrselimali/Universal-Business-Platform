using System.Security.Cryptography;
using System.Text;
using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Migrations;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>
    /// الاختبارات الذكية: تُبنى من الكود والمخطط الفعليين، فأي شاشة/جدول/ترحيل جديد
    /// يدخل دورة الفحص تلقائيًا دون تعديل قائمة ثابتة.
    /// </summary>
    private async Task CollectSmartCoverageAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        // 1) اكتمال الترحيلات: كل سكريبت مضمّن يجب أن يكون مطبقًا على قاعدة البيانات.
        try
        {
            var expected = new MigrationRunner(_options).GetEmbeddedScriptNames()
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var applied = (await SafeQueryAsync<string>(connection, tx,
                "SELECT scriptname FROM schemaversions", null, ct))
                .Select(n => n[(n.LastIndexOf(".Scripts.", StringComparison.Ordinal) + 9)..])
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missing = expected.Where(e => !applied.Contains(e)).ToList();
            report.Tests.Add(new QaTestRunRow
            {
                Code = "SMART_MIGRATIONS_COMPLETE", Name = "اكتمال ترحيلات المخطط",
                Category = "Migration", Criticality = "critical",
                Status = missing.Count == 0 ? "Passed" : "Failed",
                Message = missing.Count == 0
                    ? $"{expected.Count} سكريبت مطبق"
                    : $"{missing.Count} سكريبت غير مطبق: " + Short(string.Join(", ", missing), 200)
            });
            if (missing.Count > 0)
                report.Findings.Add(new QaFinding
                {
                    Area = "Migration", Code = "SMART_MIGRATIONS_COMPLETE",
                    Severity = QaSeverity.Critical, Title = "ترحيلات ناقصة على قاعدة البيانات",
                    Metric = $"{missing.Count} من {expected.Count}",
                    Detail = Short(string.Join(", ", missing)),
                    Suggestion = "شغّل الترحيلات من شاشة إدارة قاعدة البيانات قبل الاختبار."
                });
        }
        catch (Exception ex)
        {
            report.Findings.Add(new QaFinding
            {
                Area = "Migration", Code = "SMART_MIGRATIONS_FAILED", Severity = QaSeverity.Medium,
                Title = "تعذر التحقق من اكتمال الترحيلات",
                Detail = Short(ex.GetBaseException().Message),
                Suggestion = "تحقق من صلاحية قراءة schemaversions."
            });
        }

        // 2) تغطية الشاشات/الصلاحيات — مجموعة لكل وحدة، تُبنى من AppRegistry.
        foreach (var group in AppRegistry.Screens.GroupBy(s => s.GroupKey))
        {
            var screens = group.ToList();
            var noView = screens
                .Where(s => s.Actions.All(a => a.Code != ActionCodes.View))
                .Select(s => s.Code).ToList();
            report.Tests.Add(new QaTestRunRow
            {
                Code = $"SMART_GROUP_{group.Key.ToUpperInvariant().Replace('.', '_')}",
                Name = $"تغطية صلاحيات {group.Key}",
                Category = "Coverage", Criticality = "high",
                Status = noView.Count == 0 ? "Passed" : "Failed",
                Message = $"{screens.Count} شاشة"
                    + (noView.Count > 0 ? " — بلا VIEW: " + Short(string.Join(", ", noView), 150) : "")
            });
        }

        // 3) سلامة المخطط: كل جدول له مفتاح أساسي.
        var noPk = (await SafeQueryAsync<string>(connection, tx, """
            SELECT c.relname FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r' AND n.nspname = 'public'
              AND NOT EXISTS (SELECT 1 FROM pg_constraint k
                              WHERE k.conrelid = c.oid AND k.contype = 'p')
            ORDER BY 1
            """, null, ct)).ToList();
        report.Tests.Add(new QaTestRunRow
        {
            Code = "SMART_TABLE_PK", Name = "كل جدول له مفتاح أساسي",
            Category = "Coverage", Criticality = "high",
            Status = noPk.Count == 0 ? "Passed" : "Failed",
            Message = noPk.Count == 0 ? "كل الجداول سليمة"
                : $"{noPk.Count} جدول بلا PK: " + Short(string.Join(", ", noPk), 200)
        });
        if (noPk.Count > 0)
            report.Findings.Add(new QaFinding
            {
                Area = "Coverage", Code = "SMART_TABLE_PK", Severity = QaSeverity.High,
                Title = "جداول بلا مفتاح أساسي", Metric = $"{noPk.Count} جدول",
                Detail = Short(string.Join(", ", noPk)),
                Suggestion = "أضف PRIMARY KEY لكل جدول لضمان سلامة البيانات والتكرار."
            });

        // 4) البصمة: تتغير عند إضافة شاشة/جدول، فتُبرز ما دخل الدورة.
        var tableNames = (await SafeQueryAsync<string>(connection, tx, """
            SELECT c.relname FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r' AND n.nspname = 'public' ORDER BY 1
            """, null, ct)).ToList();
        var raw = string.Join("|", AppRegistry.Screens.Select(s => s.Code).OrderBy(c => c))
                  + "#" + string.Join("|", tableNames);
        report.CoverageFingerprint = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16];
        report.Tests.Add(new QaTestRunRow
        {
            Code = "SMART_COVERAGE_FINGERPRINT", Name = "بصمة التغطية الذكية",
            Category = "Coverage", Criticality = "info", Status = "Passed",
            Message = $"{AppRegistry.Screens.Count} شاشة / {tableNames.Count} جدول / {report.CoverageFingerprint}"
        });
    }
}