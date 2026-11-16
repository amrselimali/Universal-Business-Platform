using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>تجزئة الاستهلاك: كل جدول وكل استعلام/صفحة وكل دورة عمل.</summary>
    private static void BuildSlices(QaAuditReport report)
    {
        foreach (var table in report.Tables)
            report.Slices.Add(new QaResourceSlice
            {
                Name = table.Table, Kind = "Table", Size = table.TotalSize,
                Note = $"{table.Rows:N0} صف — فهارس {table.IndexSize}"
                       + (string.IsNullOrEmpty(table.Hotspot) ? "" : $" — {table.Hotspot}")
            });
        foreach (var query in report.Queries)
            report.Slices.Add(new QaResourceSlice
            {
                Name = query.Name, Kind = "Page", CpuMs = query.DurationMs,
                DbBlocks = query.SharedHitBlocks + query.SharedReadBlocks,
                Note = query.Hotspot ?? $"{query.Rows:N0} صف"
            });
        foreach (var workflow in report.Workflows)
            report.Slices.Add(new QaResourceSlice
            {
                Name = workflow.Name, Kind = "Workflow", Size = $"{workflow.Count:N0}",
                Note = workflow.Status == "ok" ? "سليم" : workflow.Detail
            });
        report.Slices = report.Slices
            .OrderByDescending(s => s.CpuMs).ThenByDescending(s => s.DbBlocks).ToList();
    }

    /// <summary>حكم الصحة لكل جدول: سليم / يحتاج انتباه / حرج.</summary>
    internal static void ApplyTableHealth(QaAuditReport report)
    {
        foreach (var table in report.Tables)
        {
            var reasons = new List<string>();
            var severity = "ok";
            if (table.DeadTuples > 10_000)
            {
                reasons.Add($"{table.DeadTuples:N0} صف ميت");
                severity = "attention";
            }
            // الجداول الصغيرة تُقرأ بالمسح المتسلسل بشكل طبيعي وأرخص من الفهرس؛
            // لا ننبّه إلا عند وجود حجم كافٍ وعدد مسحات فعلي (نفس حد فحص الأداء).
            var meaningfulScans = table.SeqScans >= 100 && table.Rows >= 1000;
            var scanRatio = table.IndexScans == 0
                ? (table.SeqScans > 200 ? double.MaxValue : 0)
                : (double)table.SeqScans / table.IndexScans;
            if (meaningfulScans && scanRatio > 5)
            {
                reasons.Add("مسح متسلسل أكثر من الفهارس");
                if (severity == "ok") severity = "attention";
            }
            if (table.TotalBytes > 500L * 1024 * 1024 && scanRatio > 2)
            {
                reasons.Add("حجم كبير مع قراءة غير مفهرسة");
                severity = "critical";
            }
            if (table.Rows == 0 && table.TotalBytes > 50L * 1024 * 1024)
            {
                reasons.Add("مساحة كبيرة بلا صفوف");
                severity = "attention";
            }
            table.Health = severity;
            table.HealthReason = reasons.Count == 0 ? "سليم: أحجام وفهارس وقراءة طبيعية"
                : string.Join(" — ", reasons);
        }
    }

    private static (double TotalMb, double AvailableMb) ReadMemInfo()
    {
        try
        {
            double total = 0, available = 0;
            foreach (var line in File.ReadLines("/proc/meminfo"))
            {
                if (line.StartsWith("MemTotal:", StringComparison.Ordinal))
                    total = ParseKb(line);
                else if (line.StartsWith("MemAvailable:", StringComparison.Ordinal))
                    available = ParseKb(line);
            }
            if (total > 0) return (total / 1024, available / 1024);
        }
        catch { /* غير متاح على غير لينكس */ }
        var gc = GC.GetGCMemoryInfo();
        return (gc.TotalAvailableMemoryBytes / 1024d / 1024, 0);
    }

    private static double ParseKb(string line)
    {
        var digits = new string(line.Where(char.IsDigit).ToArray());
        return double.TryParse(digits, out var kb) ? kb : 0;
    }

    private static double ReadLoadAverage()
    {
        try
        {
            var first = File.ReadAllText("/proc/loadavg").Split(' ')[0];
            return double.TryParse(first, out var load) ? load : 0;
        }
        catch { return 0; }
    }
}