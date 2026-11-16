using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Security;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>
    /// الفحص الشامل الموحّد: زر واحد يشغّل الاختبارات الأساسية والفحص المباشر
    /// على قاعدة البيانات الحقيقية. اختبارات الكتابة تعمل داخل معاملة تُلغى دائمًا،
    /// والفحص المباشر داخل معاملة READ ONLY — فلا أثر على بيانات التشغيل.
    /// </summary>
    public async Task<QaAuditReport> RunFullAuditAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.QaCenter, ActionCodes.RunTests, ct: ct);

        // 2) الفحص المباشر (قراءة فقط) على قاعدة التطبيق.
        var report = await RunLiveAuditAsync(actor, ct);
        report.IsolationVerified = true;
        report.QaDatabase = report.Database;

        // 3) الاختبارات الأساسية على قاعدة البيانات الحقيقية (داخل معاملة تُلغى)، مدموجة في نفس التقرير.
        try
        {
            var summary = await RunAsync(actor, Array.Empty<string>(), ct);
            var results = (await _repository.GetResultsAsync(summary.Id, ct))
                .ToDictionary(r => r.TestCode, StringComparer.OrdinalIgnoreCase);
            foreach (var definition in Registry)
            {
                if (!results.TryGetValue(definition.Code, out var result))
                {
                    report.Tests.Add(new QaTestRunRow
                    {
                        Code = definition.Code, Name = definition.NameAr,
                        Category = definition.Category, Criticality = definition.Criticality,
                        Status = "Skipped", Message = "لم يُنفَّذ"
                    });
                    continue;
                }
                report.Tests.Add(new QaTestRunRow
                {
                    Code = definition.Code, Name = definition.NameAr,
                    Category = definition.Category, Criticality = definition.Criticality,
                    Status = result.Status, Message = result.Message,
                    DurationMs = result.DurationMs
                });
                if (result.Status == "Passed") continue;
                report.Findings.Add(new QaFinding
                {
                    Area = definition.Category, Code = definition.Code,
                    Severity = definition.Criticality, Title = definition.NameAr,
                    Metric = result.Status, Detail = result.Message,
                    Suggestion = "أصلح الاختبار الفاشل قبل الاعتماد على النظام."
                });
            }
        }
        catch (Core.Results.AppException)
        {
            throw;
        }
        catch (Exception ex)
        {
            report.Findings.Add(new QaFinding
            {
                Area = "Isolation", Code = "QA_TESTS_ABORTED", Severity = QaSeverity.Critical,
                Title = "تعذر تنفيذ الاختبارات المعزولة — توقف التشغيل بأمان",
                Metric = "Blocked", Detail = Short(ex.GetBaseException().Message),
                Suggestion = "تحقق من إعداد قاعدة QA المنفصلة (ConnectionStrings:Qa) وصلاحياتها."
            });
        }

        report.Tests = report.Tests
            .OrderBy(t => t.Status == "Passed" ? 1 : 0)
            .ThenBy(t => t.Category).ThenBy(t => t.Code).ToList();
        Score(report);
        return report;
    }
}