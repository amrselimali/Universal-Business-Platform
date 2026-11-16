using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>كل مستند مرحّل يجب أن يكون له قيد — يُبنى ديناميكيًا من المخطط الفعلي.</summary>
    private async Task CheckPostedDocumentsAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        var missingTotal = 0L;
        var skipped = new List<string>();
        foreach (var table in AccountingDocs)
        {
            try
            {
                var exists = await SafeScalarAsync<bool>(connection, tx, """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema='public' AND table_name=@table
                          AND column_name='journal_entry_id')
                    """, new { table }, ct) == true;
                if (!exists) { skipped.Add(table); continue; }

                var missing = await SafeScalarAsync<long>(connection, tx,
                    $"SELECT count(*) FROM {table} WHERE status = 'POSTED' AND journal_entry_id IS NULL",
                    null, ct);
                if (missing == 0) continue;
                missingTotal += missing;
                report.Findings.Add(new QaFinding
                {
                    Area = "Accounting", Code = "ACC_MISSING_JOURNAL", Severity = QaSeverity.Critical,
                    Title = $"مستندات مرحّلة بلا قيد: {table}", Metric = $"{missing} مستند",
                    Detail = "الترحيل إلى الأستاذ العام مفقود لهذه المستندات.",
                    Suggestion = "أعد توليد القيود من مركز الترحيل المحاسبي وتحقق من إعدادات الحسابات."
                });
            }
            catch (Exception ex)
            {
                report.Findings.Add(new QaFinding
                {
                    Area = "Accounting", Code = "ACC_CHECK_FAILED", Severity = QaSeverity.Low,
                    Title = $"تعذر فحص ترحيل: {table}",
                    Detail = Short(ex.GetBaseException().Message),
                    Suggestion = "راجع أعمدة الحالة/القيد في هذا الجدول."
                });
            }
        }

        report.Tests.Add(new QaTestRunRow
        {
            Code = "ACC_ALL_POSTED_HAVE_JOURNAL", Name = "كل مستند مرحّل له قيد محاسبي",
            Category = "Accounting", Criticality = "critical",
            Status = missingTotal == 0 ? "Passed" : "Failed",
            Message = missingTotal == 0
                ? $"تم فحص {AccountingDocs.Length - skipped.Count} جدولًا"
                : $"{missingTotal} مستند بلا قيد"
        });
    }
}