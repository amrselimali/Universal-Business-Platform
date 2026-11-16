using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>قيود الكود: حد 300 سطر للملف + حراس قاعدة البيانات + فهارس المفاتيح الأجنبية.</summary>
    private async Task CollectCodeAndConstraintsAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, QaAuditReport report, CancellationToken ct)
    {
        CollectFileLengths(report);
        await CollectSchemaConstraintsAsync(connection, tx, report, ct);
    }

    /// <summary>حد 300 سطر لكل ملف صفحة/خدمة: يُقاس على الملفات المنشورة فعليًا.</summary>
    private static void CollectFileLengths(QaAuditReport report)
    {
        var root = Path.Combine(AppContext.BaseDirectory, "Code");
        if (!Directory.Exists(root))
        {
            report.Findings.Add(new QaFinding
            {
                Area = "Code", Code = "LINE_LIMIT_SKIPPED", Severity = QaSeverity.Low,
                Title = "تعذر فحص حد الأسطر (ملفات المصدر غير منشورة)",
                Detail = "مجلد Code غير موجود بجوار التطبيق.",
                Suggestion = "تأكد من هدف النسخ CopyManualSources في مشروع الويب."
            });
            return;
        }

        var over = Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
            .Where(f => f.EndsWith(".razor", StringComparison.OrdinalIgnoreCase)
                        || f.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
            .Select(f => (Path: Path.GetRelativePath(root, f), Lines: File.ReadLines(f).Count()))
            .Where(x => x.Lines > 300)
            .OrderByDescending(x => x.Lines)
            .Take(10)
            .ToList();

        foreach (var file in over)
            report.Findings.Add(new QaFinding
            {
                Area = "Code", Code = "FILE_TOO_LONG", Severity = QaSeverity.Medium,
                Title = $"ملف يتجاوز 300 سطر: {file.Path}",
                Metric = $"{file.Lines} سطر",
                Detail = "قيد المشروع: كل صفحة/خدمة ≤ 300 سطر.",
                Suggestion = "قسّم الملف إلى partial أو مكوّنات أصغر."
            });
    }

    private async Task CollectSchemaConstraintsAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, QaAuditReport report, CancellationToken ct)
    {
        try
        {
            var triggers = (await connection.QueryAsync<string>(new CommandDefinition(
                "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal",
                transaction: tx, cancellationToken: ct))).ToHashSet(StringComparer.OrdinalIgnoreCase);

            RequireTrigger(report, triggers, "trg_audit_log_guard", QaSeverity.Critical,
                "حارس سجل الأنشطة", "سجل الأنشطة يجب أن يكون غير قابل للتعديل.");
            RequireTrigger(report, triggers, "trg_touch_users", QaSeverity.High,
                "زيادة نسخة المستخدم", "التزامن على نسخة السجل مطلوب لمنع الكتابة فوق تعديلات الآخرين.");

            var uniqueCount = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE '%UNIQUE%'",
                transaction: tx, cancellationToken: ct));
            if (uniqueCount < 20)
                report.Findings.Add(new QaFinding
                {
                    Area = "Constraints", Code = "FEW_UNIQUE_INDEXES", Severity = QaSeverity.High,
                    Title = "عدد الفهارس الفريدة أقل من المتوقع",
                    Metric = $"{uniqueCount} فهرس فريد",
                    Detail = "ضعف القيود يسمح بالتكرار في البيانات الحرجة.",
                    Suggestion = "راجع قيود الفرادة (أكواد المستندات/الحسابات/المستخدمين)."
                });

            var missingFkIndexes = (await connection.QueryAsync<string>(new CommandDefinition("""
                SELECT conrelid::regclass::text AS tbl
                FROM pg_constraint c
                WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
                  AND NOT EXISTS (
                    SELECT 1 FROM pg_index i
                    WHERE i.indrelid = c.conrelid
                      AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
                GROUP BY conrelid
                ORDER BY conrelid::regclass::text
                LIMIT 8
                """, transaction: tx, cancellationToken: ct))).ToList();
            foreach (var table in missingFkIndexes)
                report.Findings.Add(new QaFinding
                {
                    Area = "Constraints", Code = "FK_WITHOUT_INDEX", Severity = QaSeverity.Medium,
                    Title = $"مفتاح أجنبي بلا فهرس: {table}",
                    Metric = "FK بدون فهرس مطابق",
                    Detail = "الحذف/التحديث في الجدول الأب يمسح الجدول الابن كاملًا.",
                    Suggestion = "أضف فهرسًا على عمود المفتاح الأجنبي."
                });
        }
        catch (Exception ex)
        {
            report.Findings.Add(new QaFinding
            {
                Area = "Constraints", Code = "CONSTRAINT_CHECK_FAILED",
                Severity = QaSeverity.Low, Title = "تعذر فحص قيود قاعدة البيانات",
                Detail = Short(ex.GetBaseException().Message, 200),
                Suggestion = "تحقق من صلاحيات القراءة على كتالوج قاعدة البيانات."
            });
        }
    }

    private static void RequireTrigger(QaAuditReport report, HashSet<string> triggers,
        string name, string severity, string title, string detail)
    {
        if (triggers.Contains(name)) return;
        report.Findings.Add(new QaFinding
        {
            Area = "Constraints", Code = "MISSING_TRIGGER", Severity = severity,
            Title = $"مُشغِّل مفقود: {title} ({name})",
            Metric = "غير موجود",
            Detail = detail,
            Suggestion = "نفّذ الترحيلات الناقصة من شاشة إدارة قاعدة البيانات."
        });
    }
}