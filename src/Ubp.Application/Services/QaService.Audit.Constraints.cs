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
            // التحقق من الحارس بدالة المشغّل وليس باسمه: الأسماء تختلف بين الترحيلات.
            var auditGuard = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT count(*)::int FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_proc p ON p.oid = t.tgfoid
                WHERE NOT t.tgisinternal AND c.relname = 'audit_log'
                  AND p.proname = 'fn_audit_log_immutable'
                """, transaction: tx, cancellationToken: ct));
            if (auditGuard < 2)
                report.Findings.Add(new QaFinding
                {
                    Area = "Constraints", Code = "MISSING_AUDIT_GUARD",
                    Severity = QaSeverity.Critical,
                    Title = "حارس سجل الأنشطة غير مكتمل",
                    Metric = $"{auditGuard} مشغّل",
                    Detail = "سجل الأنشطة يجب أن يمنع التعديل والحذف (مشغّلان).",
                    Suggestion = "نفّذ الترحيلات الناقصة من شاشة إدارة قاعدة البيانات."
                });

            var versionGuard = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT count(*)::int FROM pg_trigger t
                JOIN pg_proc p ON p.oid = t.tgfoid
                WHERE NOT t.tgisinternal AND p.proname = 'fn_touch_version'
                """, transaction: tx, cancellationToken: ct));
            if (versionGuard < 5)
                report.Findings.Add(new QaFinding
                {
                    Area = "Constraints", Code = "MISSING_VERSION_TRIGGER",
                    Severity = QaSeverity.High,
                    Title = "مشغّلات النسخ (التزامن) ناقصة",
                    Metric = $"{versionGuard} مشغّل",
                    Detail = "التزامن على نسخة السجل يمنع الكتابة فوق تعديلات الآخرين.",
                    Suggestion = "نفّذ الترحيلات الناقصة."
                });

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

            // المفتاح الأجنبي يُعدّ مفهرسًا إذا وُجد فهرس يبدأ بأعمدته (بأي ترتيب).
            var missingFkIndexes = (await connection.QueryAsync<(string Table, string Name)>(
                new CommandDefinition("""
                WITH fk AS (
                    SELECT c.conrelid, c.conname, c.conkey,
                           array_length(c.conkey, 1) AS n, a.attname
                    FROM pg_constraint c
                    JOIN pg_namespace ns ON ns.oid = c.connamespace
                    JOIN pg_attribute a ON a.attrelid = c.conrelid
                                       AND a.attnum = c.conkey[1]
                    WHERE c.contype = 'f' AND ns.nspname = 'public'
                      AND array_length(c.conkey, 1) = 1
                      AND right(a.attname, 3) <> '_by'
                      AND a.attname NOT IN ('actor_user_id', 'read_by')
                ), idx AS (
                    SELECT i.indrelid,
                           string_to_array(i.indkey::text, ' ')::int2[] AS keys,
                           array_length(string_to_array(i.indkey::text, ' '), 1) AS n
                    FROM pg_index i
                )
                SELECT DISTINCT fk.conrelid::regclass::text AS "Table", fk.attname AS "Name"
                FROM fk
                WHERE NOT EXISTS (
                    SELECT 1 FROM idx
                    WHERE idx.indrelid = fk.conrelid AND idx.n >= fk.n
                      AND (SELECT array_agg(k ORDER BY k)
                           FROM unnest(idx.keys[1:fk.n]) k)
                          = (SELECT array_agg(k ORDER BY k) FROM unnest(fk.conkey) k))
                ORDER BY 1, 2 LIMIT 40
                """, transaction: tx, cancellationToken: ct))).ToList();
            foreach (var fk in missingFkIndexes)
                report.Findings.Add(new QaFinding
                {
                    Area = "Constraints", Code = "FK_WITHOUT_INDEX", Severity = QaSeverity.Medium,
                    Title = $"مفتاح أجنبي بلا فهرس: {fk.Table}.{fk.Name}",
                    Metric = "FK بدون فهرس مطابق",
                    Detail = "الحذف/التحديث في الجدول الأب يمسح الجدول الابن كاملًا.",
                    Suggestion = "أضف فهرسًا على أعمدة المفتاح الأجنبي."
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

}
