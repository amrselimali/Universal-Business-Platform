using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>استهلاك الموارد: الأحجام، إصابة الذاكرة، الاتصالات، الأقفال، الصفوف الميتة.</summary>
    private async Task CollectResourcesAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        await CollectTableSizesAsync(connection, tx, report, ct);
        await CollectCacheAsync(connection, tx, report, ct);
        await CollectConnectionsAsync(connection, tx, report, ct);
        await CollectLocksAsync(connection, tx, report, ct);
        await CollectBloatAsync(connection, tx, report, ct);
    }

    private async Task CollectTableSizesAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var rows = (await connection.QueryAsync<(string Rel, long Bytes, long IdxBytes,
                long Live, long Seq, long Idx)>(new CommandDefinition("""
                SELECT c.relname, pg_total_relation_size(c.oid), pg_indexes_size(c.oid),
                       COALESCE(s.n_live_tup, 0), COALESCE(s.seq_scan, 0), COALESCE(s.idx_scan, 0)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
                WHERE n.nspname = 'public' AND c.relkind = 'r'
                ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 15
                """, transaction: tx, cancellationToken: ct))).ToList();

            foreach (var row in rows)
            {
                report.Tables.Add(new QaTableProfile
                {
                    Table = row.Rel, Rows = row.Live, TotalSize = HumanSize(row.Bytes),
                    IndexSize = HumanSize(row.IdxBytes), SeqScans = row.Seq, IndexScans = row.Idx
                });
                // جدول ضخم بلا أي مسح بالفهرس إشارة إلى فهرس مفقود.
                if (row.Bytes > 50L * 1024 * 1024 && row.Idx == 0 && row.Live > 1000)
                    report.Findings.Add(new QaFinding
                    {
                        Area = "Resources", Code = "TABLE_NO_INDEX_SCAN",
                        Severity = QaSeverity.High,
                        Title = $"جدول كبير بلا استخدام للفهارس: {row.Rel}",
                        Metric = $"{HumanSize(row.Bytes)} / فهارس {HumanSize(row.IdxBytes)}",
                        Detail = "لم يُستخدم أي فهرس في هذا الجدول رغم حجمه الكبير.",
                        Suggestion = "راجع الفهارس على أعمدة الفلترة الأساسية."
                    });
            }
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة أحجام الجداول", QaSeverity.Low,
                Short(ex.GetBaseException().Message, 200)));
        }
    }

    private async Task CollectCacheAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var row = await connection.QuerySingleAsync<(long Hit, long Read, long Temp,
                long Deadlocks)>(new CommandDefinition("""
                SELECT blks_hit, blks_read, temp_bytes, deadlocks
                FROM pg_stat_database WHERE datname = current_database()
                """, transaction: tx, cancellationToken: ct));
            var total = row.Hit + row.Read;
            var ratio = total == 0 ? 100d : row.Hit * 100d / total;
            if (ratio < 95)
                report.Findings.Add(ResourceFinding($"نسبة إصابة الذاكرة منخفضة ({ratio:0.0}%)",
                    ratio < 85 ? QaSeverity.High : QaSeverity.Medium,
                    $"{row.Hit:N0} إصابة / {row.Read:N0} قراءة"));
            if (row.Temp > 256L * 1024 * 1024)
                report.Findings.Add(ResourceFinding("ملفات مؤقتة كبيرة (فرز على القرص)",
                    QaSeverity.Medium, HumanSize(row.Temp)));
            if (row.Deadlocks > 0)
                report.Findings.Add(ResourceFinding($"جمود (deadlocks) مسجل: {row.Deadlocks}",
                    QaSeverity.High, "ترتيب الأقفال غير متسق بين المعاملات."));
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة إحصاءات الذاكرة", QaSeverity.Low,
                Short(ex.GetBaseException().Message, 200)));
        }
    }

    private static QaFinding ResourceFinding(string title, string severity, string metric) => new()
    {
        Area = "Resources", Code = "RESOURCE", Title = title, Severity = severity,
        Metric = metric, Detail = "قراءة من إحصاءات الخادم الفعلية.",
        Suggestion = "راجع الإعدادات المذكورة في العنوان."
    };

    private async Task CollectConnectionsAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var row = await connection.QuerySingleAsync<(int Max, int Used, int IdleInTx)>(
                new CommandDefinition("""
                SELECT current_setting('max_connections')::int,
                       (SELECT count(*)::int FROM pg_stat_activity
                        WHERE datname = current_database()),
                       (SELECT count(*)::int FROM pg_stat_activity
                        WHERE datname = current_database() AND state = 'idle in transaction')
                """, transaction: tx, cancellationToken: ct));
            var used = row.Max == 0 ? 0 : row.Used * 100d / row.Max;
            if (used >= 80)
                report.Findings.Add(ResourceFinding($"استهلاك الاتصالات مرتفع ({used:0}%)",
                    QaSeverity.High, $"{row.Used} من {row.Max}"));
            if (row.IdleInTx > 5)
                report.Findings.Add(ResourceFinding("اتصالات خاملة داخل معاملة",
                    QaSeverity.Medium,
                    $"{row.IdleInTx} اتصال idle in transaction — يحجب VACUUM."));
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة إحصاءات الاتصالات",
                QaSeverity.Low, Short(ex.GetBaseException().Message, 200)));
        }
    }

    private async Task CollectLocksAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var blocked = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT count(*)::int FROM pg_stat_activity a
                WHERE a.datname = current_database() AND a.wait_event_type = 'Lock'
                """, transaction: tx, cancellationToken: ct));
            if (blocked > 0)
                report.Findings.Add(ResourceFinding($"استعلامات محجوبة بقفل: {blocked}",
                    QaSeverity.Critical, "انتظار قفل يعطّل المستخدمين الآن."));

            var longRunning = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT count(*)::int FROM pg_stat_activity
                WHERE datname = current_database() AND state = 'active'
                  AND now() - query_start > interval '5 seconds'
                  AND query NOT ILIKE '%pg_stat_activity%'
                """, transaction: tx, cancellationToken: ct));
            if (longRunning > 0)
                report.Findings.Add(ResourceFinding($"استعلامات طويلة قيد التشغيل: {longRunning}",
                    QaSeverity.High, "زمن تنفيذ أطول من 5 ثوانٍ."));
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة الأقفال", QaSeverity.Low,
                Short(ex.GetBaseException().Message, 200)));
        }
    }

    private async Task CollectBloatAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var rows = (await connection.QueryAsync<(string Rel, long Live, long Dead)>(
                new CommandDefinition("""
                SELECT relname, n_live_tup, n_dead_tup
                FROM pg_stat_user_tables
                WHERE n_dead_tup > 1000
                ORDER BY n_dead_tup DESC LIMIT 8
                """, transaction: tx, cancellationToken: ct))).ToList();
            foreach (var row in rows)
            {
                var ratio = row.Live <= 0 ? 100d : row.Dead * 100d / row.Live;
                foreach (var table in report.Tables.Where(t => t.Table == row.Rel))
                    table.DeadTuples = row.Dead;
                if (ratio < 20) continue;
                report.Findings.Add(new QaFinding
                {
                    Area = "Resources", Code = "TABLE_BLOAT", Severity = QaSeverity.Medium,
                    Title = $"صفوف ميتة متراكمة: {row.Rel}",
                    Metric = $"dead={row.Dead:N0} / live={row.Live:N0}",
                    Detail = "التضخم يزيد زمن القراءة ويستهلك مساحة.",
                    Suggestion = "شغّل VACUUM ANALYZE وراجع إعدادات autovacuum لهذا الجدول."
                });
            }
        }
        catch (Exception ex)
        {
            report.Findings.Add(ResourceFinding("تعذر قراءة الصفوف الميتة", QaSeverity.Low,
                Short(ex.GetBaseException().Message, 200)));
        }
    }
}