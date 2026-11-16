using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>
    /// دورات العمل الحية: يقرأ أعداد المستندات في كل مرحلة للتحقق من سلامة الدورة
    /// (مسودات عالقة، مستندات مرحّلة بلا قيد، شفتات مفتوحة، جرد غير مُسوّى).
    /// </summary>
    private async Task CollectWorkflowProbesAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, QaAuditReport report, CancellationToken ct)
    {
        await ProbeAsync(connection, tx, report, ct, "الحجوزات المؤكدة غير المنفذة", QaSeverity.Medium,
            "مسودات/حجوزات مؤكدة عالقة بلا تنفيذ لفترة طويلة",
            """
            SELECT count(*) FROM bookings
            WHERE status IN ('draft','confirmed','partially_delivered')
              AND booking_date < current_date - 30
            """,
            l => l > 0, "حجوزات قديمة لم تُنفَّذ ولم تُلغَ: راجع شاشة الحجوزات المنتهية.");

        await ProbeAsync(connection, tx, report, ct, "جرد لم يُسوَّ", QaSeverity.High,
            "جلسات جرد مسودة تمنع إغلاق الفترة",
            "SELECT count(*) FROM stocktakes WHERE status = 'DRAFT'",
            l => l == 0, "جرد مسودة يمنع إغلاق الفترة المحاسبية — سوِّه من شاشة تسويات جردية.");

        await ProbeAsync(connection, tx, report, ct, "سندات خزينة مسودة", QaSeverity.Medium,
            "سندات لم تُرحّل بعد",
            "SELECT count(*) FROM vouchers WHERE status = 'draft'",
            l => l == 0, "سندات مسودة لا تؤثر على الحسابات — راجعها ثم رحّلها أو ألغِها.");

        await ProbeAsync(connection, tx, report, ct, "شفتات مفتوحة", QaSeverity.Info,
            "شفتات ما زالت مفتوحة الآن",
            "SELECT count(*) FROM cashier_shifts WHERE status = 'open'",
            _ => true, "معلومة: عدد الشفتات المفتوحة حاليًا لكل الفروع.");

        await ProbeAsync(connection, tx, report, ct, "قيود مسودة عالقة", QaSeverity.Medium,
            "قيود محاسبية لم تُرحّل",
            "SELECT count(*) FROM journal_entries WHERE status = 'draft'",
            l => l == 0, "قيود مسودة لا تظهر في الأستاذ — راجعها من شاشة قيود اليومية.");

        await ProbeAsync(connection, tx, report, ct, "فواتير مرحّلة بلا قيد", QaSeverity.High,
            "مستندات مؤثرة بلا أثر محاسبي",
            """
            SELECT count(*) FROM commercial_documents
            WHERE status = 'posted' AND journal_entry_id IS NULL
            """,
            l => l == 0, "مستندات مرحّلة بلا قيد: استخدم مركز الترحيل والمطابقات.");

        await ProbeAsync(connection, tx, report, ct, "تسويات حساب عميل مسودة", QaSeverity.Low,
            "إيصالات تسوية تنتظر ترحيل الشفت",
            "SELECT count(*) FROM customer_account_settlements WHERE status = 'draft'",
            _ => true, "معلومة: تسويات لم تُرحّل بعد وتُرحّل مع الشفت.");

        await ProbeAsync(connection, tx, report, ct, "فوترة الخدمات المنفذة", QaSeverity.Low,
            "خدمات منفذة لم تُفوتر بعد",
            """
            SELECT count(*) FROM booking_lines
            WHERE delivered_qty > invoiced_qty + settled_qty
            """,
            l => l == 0, "كميات منفذة بلا فاتورة/تسوية: قد تكون إيرادات غير مسجلة.");

        // الفحص الختامي: هل يمكن قراءة كل الجداول المطلوبة (سلامة المخطط).
        await ProbeAsync(connection, tx, report, ct, "سلامة المخطط الأساسي", QaSeverity.Critical,
            "جداول أساسية مفقودة",
            """
            SELECT count(*) FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('users','branches','items','bookings','journal_entries','audit_log')
            """,
            l => l == 6, "ترحيلات ناقصة — نفّذ تحديث قاعدة البيانات.");
    }

    private static async Task ProbeAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct, string name, string severityWhenBad,
        string detail, string sql, Func<long, bool> isHealthy, string suggestion)
    {
        try
        {
            var count = await connection.ExecuteScalarAsync<long>(new CommandDefinition(sql,
                transaction: tx, cancellationToken: ct));
            var healthy = isHealthy(count);
            report.Workflows.Add(new QaWorkflowProbe
            {
                Name = name, Count = count, Status = healthy ? "ok" : "attention",
                Detail = detail
            });
            if (healthy) return;
            report.Findings.Add(new QaFinding
            {
                Area = "Workflows", Code = "WORKFLOW_OPEN", Severity = severityWhenBad,
                Title = $"{name}: {count:N0}",
                Metric = $"{count:N0}", Detail = detail, Suggestion = suggestion
            });
        }
        catch (Exception ex)
        {
            report.Workflows.Add(new QaWorkflowProbe
            {
                Name = name, Count = 0, Status = "unknown",
                Detail = Short(ex.GetBaseException().Message, 160)
            });
            report.Findings.Add(new QaFinding
            {
                Area = "Workflows", Code = "WORKFLOW_UNREADABLE", Severity = QaSeverity.Low,
                Title = $"{name}: تعذر القياس",
                Detail = Short(ex.GetBaseException().Message, 200),
                Suggestion = "المخطط لا يطابق الكود الحالي — تحقق من الترحيلات."
            });
        }
    }
}