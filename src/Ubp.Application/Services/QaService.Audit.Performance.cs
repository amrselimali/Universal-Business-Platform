using System.Text.Json;
using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>الاستعلامات الحقيقية الحساسة للسرعة التي تُقاس فعليًا على البيانات الحالية.</summary>
    private static readonly (string Name, string Area, string Sql)[] Probes =
    {
        ("قائمة الخدمات المحجوزة", "Reservations", """
            SELECT r.booking_line_id, u.paid_amount, u.uncollected_value
            FROM v_customer_reservations r
            LEFT JOIN v_customer_line_paid u ON u.booking_line_id = r.booking_line_id
            ORDER BY r.booking_no, r.booking_line_id LIMIT 200
            """),
        ("أرصدة الحجوزات للعميل", "Reservations", """
            SELECT booking_id, customer_id, total_amount, paid_amount, remaining_amount
            FROM v_customer_booking_balances WHERE remaining_amount > 0 LIMIT 200
            """),
        ("قائمة الحجوزات", "Reservations", """
            SELECT b.id, b.doc_no, b.status, b.booking_date, b.total_amount
            FROM bookings b ORDER BY b.booking_date DESC LIMIT 200
            """),
        ("أرصدة المخزون", "Stock", """
            SELECT b.item_id, b.warehouse_id, b.on_hand, b.average_cost, i.code
            FROM stock_balances b JOIN items i ON i.id = b.item_id ORDER BY i.code LIMIT 200
            """),
        ("ميزان المراجعة", "Accounting", """
            SELECT account_id, SUM(debit) AS debit, SUM(credit) AS credit
            FROM gl_balances GROUP BY account_id ORDER BY account_id LIMIT 200
            """),
        ("سجل الأنشطة", "Audit", """
            SELECT id, table_name, action, created_at FROM audit_log
            ORDER BY id DESC LIMIT 50
            """),
        ("بنود القيود", "Accounting", """
            SELECT entry_id, account_id, debit, credit FROM journal_entry_lines
            ORDER BY entry_id DESC LIMIT 200
            """),
        ("حركات المخزون", "Stock", """
            SELECT id, item_id, warehouse_id, direction, quantity, movement_date
            FROM stock_movements ORDER BY movement_date DESC, id DESC LIMIT 100
            """)
    };

    private async Task CollectPerformanceAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        foreach (var probe in Probes)
        {
            var profile = new QaQueryProfile { Name = probe.Name };
            try
            {
                var planJson = await connection.ExecuteScalarAsync<string>(new CommandDefinition(
                    $"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {probe.Sql}",
                    transaction: tx, cancellationToken: ct));
                using var document = JsonDocument.Parse(planJson ?? "[]");
                var root = document.RootElement[0];
                var plan = root.GetProperty("Plan");
                profile.DurationMs = Math.Round(root.GetProperty("Execution Time").GetDouble(), 2);
                profile.Rows = plan.TryGetProperty("Actual Rows", out var rows) ? rows.GetInt64() : 0;
                profile.SharedHitBlocks = plan.TryGetProperty("Shared Hit Blocks", out var hit)
                    ? hit.GetInt64() : 0;
                profile.SharedReadBlocks = plan.TryGetProperty("Shared Read Blocks", out var read)
                    ? read.GetInt64() : 0;
                profile.Hotspot = FindHotspot(plan);
                report.Queries.Add(profile);

                if (profile.SharedReadBlocks > 2000)
                    report.Findings.Add(PerfFinding(probe.Area,
                        $"{probe.Name}: قراءة من القرص", QaSeverity.Medium,
                        $"{profile.SharedReadBlocks:N0} كتلة من القرص",
                        "البيانات غير مسخنة في الذاكرة: راقب shared_buffers وحرارة القراءة."));

                if (profile.Hotspot is not null)
                    report.Findings.Add(PerfFinding(probe.Area,
                        $"{probe.Name}: خطة غير مثالية", QaSeverity.Medium, profile.Hotspot,
                        "راجع الخطة: مسح متسلسل أو فرز كبير — أضف فهرسًا أو ضيّق النطاق."));

                if (profile.DurationMs >= 1000)
                    report.Findings.Add(PerfFinding(probe.Area,
                        $"{probe.Name}: استعلام بطيء", QaSeverity.Critical,
                        $"{profile.DurationMs:N2} ms",
                        "أضف فهرسًا مناسبًا أو انقل التجميع للخادم مع ترقيم صفحات."));
                else if (profile.DurationMs >= 250)
                    report.Findings.Add(PerfFinding(probe.Area,
                        $"{probe.Name}: يحتاج تحسينًا", QaSeverity.High,
                        $"{profile.DurationMs:N2} ms",
                        "الزمن أعلى من الحد المقبول (250ms) لنفس حجم البيانات."));
            }
            catch (Exception ex)
            {
                report.Findings.Add(PerfFinding(probe.Area, $"{probe.Name}: تعذر القياس",
                    QaSeverity.Low, "استعلام غير صالح على المخطط الحالي",
                    Short(ex.GetBaseException().Message, 200)));
            }
        }

        await CollectSeqScansAsync(connection, tx, report, ct);
    }

    /// <summary>جداول كبيرة تُقرأ بمسح متسلسل أكثر من الفهارس — أول مرشح للبطء.</summary>
    private async Task CollectSeqScansAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var scans = (await connection.QueryAsync<(string Rel, long Seq, long Idx, long Rows)>(
                new CommandDefinition("""
                    SELECT relname, seq_scan, COALESCE(idx_scan, 0), n_live_tup
                    FROM pg_stat_user_tables
                    WHERE n_live_tup > 500 AND seq_scan > 100
                    ORDER BY seq_scan DESC LIMIT 10
                    """, transaction: tx, cancellationToken: ct))).ToList();
            foreach (var row in scans)
            {
                var ratio = row.Idx <= 0 ? double.MaxValue : (double)row.Seq / row.Idx;
                if (row.Idx > 0 && ratio < 0.2) continue;
                report.Findings.Add(new QaFinding
                {
                    Area = "Performance", Code = "SEQ_SCAN_HOTSPOT", Severity = QaSeverity.High,
                    Title = $"مسح متسلسل متكرر: {row.Rel}",
                    Metric = $"seq={row.Seq:N0} / idx={row.Idx:N0} / rows={row.Rows:N0}",
                    Detail = "الجدول يُقرأ كاملًا أكثر من استخدام الفهارس.",
                    Suggestion = "أضف فهرسًا على أعمدة الفلترة/الربط المستخدمة في هذا الجدول."
                });
            }
        }
        catch (Exception ex)
        {
            report.Findings.Add(PerfFinding("Performance", "تعذر قراءة إحصاءات المسح",
                QaSeverity.Low, "", Short(ex.GetBaseException().Message, 200)));
        }
    }

    private static QaFinding PerfFinding(string area, string title, string severity,
        string metric, string suggestion) => new()
    {
        Area = area, Code = "QUERY_PERF", Title = title, Severity = severity,
        Metric = metric, Detail = "قياس فعلي على قاعدة البيانات الحالية.", Suggestion = suggestion
    };

    /// <summary>كشف البطء داخل الخطة: مسح متسلسل كبير أو فرز/تجميع مكلف.</summary>
    private static string? FindHotspot(JsonElement plan)
    {
        var type = plan.TryGetProperty("Node Type", out var t) ? t.GetString() : null;
        var rows = plan.TryGetProperty("Actual Rows", out var r) ? r.GetInt64() : 0;
        var relation = plan.TryGetProperty("Relation Name", out var rel) ? rel.GetString() : null;
        if (type == "Seq Scan" && rows >= 2000)
            return $"Seq Scan على {relation} ({rows:N0} صف)";
        if (type is "Sort" or "HashAggregate" && rows >= 20000)
            return $"{type} ({rows:N0} صف)";
        if (plan.TryGetProperty("Plans", out var children))
            foreach (var child in children.EnumerateArray())
                if (FindHotspot(child) is { } found) return found;
        return null;
    }
}