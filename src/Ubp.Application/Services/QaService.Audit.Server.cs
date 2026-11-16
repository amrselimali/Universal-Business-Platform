using System.Diagnostics;
using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>موارد السيرفر: المعالج والذاكرة والقرص وقاعدة البيانات، والمتبقي غير المستخدم.</summary>
    private async Task CollectServerResourcesAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, QaAuditReport report, CancellationToken ct)
    {
        var process = Process.GetCurrentProcess();
        var cores = Math.Max(1, Environment.ProcessorCount);
        var cpuBefore = process.TotalProcessorTime;
        var wall = Stopwatch.StartNew();
        await Task.Delay(200, ct);
        process.Refresh();
        var cpuDelta = process.TotalProcessorTime - cpuBefore;
        var cpuPercent = Math.Round(cpuDelta.TotalMilliseconds
            / Math.Max(1, wall.Elapsed.TotalMilliseconds) / cores * 100, 1);

        var (memTotal, memAvailable) = ReadMemInfo();
        Add("ذاكرة السيرفر", "Memory", memTotal - memAvailable, memTotal, "MB",
            "المستخدم مقابل إجمالي ذاكرة الخادم (من /proc/meminfo).");
        Add("ذاكرة التطبيق (Working Set)", "Memory",
            process.WorkingSet64 / 1024d / 1024, memTotal, "MB",
            $"العمليات: {process.Threads.Count} خيط.");
        Add("ذاكرة .NET المُدارة", "Memory",
            GC.GetTotalMemory(false) / 1024d / 1024, memTotal, "MB",
            $"GC: {GC.CollectionCount(0)}/{GC.CollectionCount(1)}/{GC.CollectionCount(2)}.");
        Add("المعالج (هذه العملية)", "Cpu", cpuPercent, 100, "%",
            $"{cores} نواة — زمن مستخدم تراكمي {process.TotalProcessorTime.TotalSeconds:0}s.");
        var load = ReadLoadAverage();
        if (load > 0)
            Add("حمل النظام (Load 1m)", "Cpu", load * 100d / cores, 100, "%",
                $"load={load:0.00} على {cores} نواة.");

        try
        {
            var drive = new DriveInfo(Path.GetPathRoot(AppContext.BaseDirectory) ?? "/");
            if (drive.IsReady)
            {
                var totalGb = drive.TotalSize / 1024d / 1024 / 1024;
                var usedGb = (drive.TotalSize - drive.AvailableFreeSpace) / 1024d / 1024 / 1024;
                Add("قرص السيرفر", "Disk", usedGb, totalGb, "GB",
                    $"المتاح {drive.AvailableFreeSpace / 1024d / 1024 / 1024:0.0} GB من {totalGb:0.0} GB.");
            }
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة مساحة القرص", QaSeverity.Low,
                Short(ex.Message, 120)));
        }

        try
        {
            var db = await connection.QuerySingleAsync<(long Size, long Hits, long Reads, long Temp,
                int MaxConn, int UsedConn)>(new CommandDefinition("""
                SELECT pg_database_size(current_database()),
                       (SELECT blks_hit FROM pg_stat_database WHERE datname = current_database()),
                       (SELECT blks_read FROM pg_stat_database WHERE datname = current_database()),
                       (SELECT temp_bytes FROM pg_stat_database WHERE datname = current_database()),
                       current_setting('max_connections')::int,
                       (SELECT count(*)::int FROM pg_stat_activity
                        WHERE datname = current_database())
                """, transaction: tx, cancellationToken: ct));
            Add("حجم قاعدة البيانات", "Database", db.Size / 1024d / 1024, 0, "MB",
                "الحجم الفعلي على القرص.");
            var total = db.Hits + db.Reads;
            var hit = total == 0 ? 100 : db.Hits * 100d / total;
            Add("ذاكرة قاعدة البيانات (Cache Hit)", "Database", hit, 100, "%",
                $"{db.Hits:N0} إصابة / {db.Reads:N0} قراءة — ملفات مؤقتة {HumanSize(db.Temp)}.");
            Add("اتصالات قاعدة البيانات", "Database", db.UsedConn, db.MaxConn, "اتصال",
                $"المتاح {db.MaxConn - db.UsedConn} اتصالًا من {db.MaxConn}.");
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة موارد قاعدة البيانات",
                QaSeverity.Low, Short(ex.GetBaseException().Message, 160)));
        }

        BuildSlices(report);

        foreach (var resource in report.Resources.Where(r => r.Total > 0))
        {
            var free = 100 - resource.Percent;
            if (resource.Category is "Memory" or "Disk" && free < 10)
                report.Findings.Add(ResourceFinding(
                    $"المورد شبه مستنفد: {resource.Name} ({resource.Percent:0}%)",
                    QaSeverity.High, $"{resource.Used:0.0} من {resource.Total:0.0} {resource.Unit}"));
        }

        void Add(string name, string category, double used, double total, string unit, string detail) =>
            report.Resources.Add(new QaServerResource
            {
                Name = name, Category = category, Used = Math.Round(used, 1),
                Total = Math.Round(total, 1), Unit = unit, Detail = detail
            });
    }
}