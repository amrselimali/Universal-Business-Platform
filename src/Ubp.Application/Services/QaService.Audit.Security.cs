using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Security;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>قاعدة تسمية الأعمدة الحساسة التي تُستبعد من الاستعراض والتصدير.</summary>
    internal static bool IsSensitiveColumn(string name) =>
        name.Contains("password", StringComparison.OrdinalIgnoreCase) ||
        (name.Contains("token", StringComparison.OrdinalIgnoreCase) &&
         !name.EndsWith("_id", StringComparison.OrdinalIgnoreCase)) ||
        name.Equals("api_key", StringComparison.OrdinalIgnoreCase) ||
        name.EndsWith("_secret", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("secret", StringComparison.OrdinalIgnoreCase);

    /// <summary>فحص الأمان: إعدادات قاعدة البيانات، الحسابات، الجلسات، وسطح الهجوم.</summary>
    private async Task CollectSecurityAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        await CheckAsync("SEC_SSL", "اتصال قاعدة البيانات غير مشفّر", QaSeverity.High,
            "SELECT current_setting('ssl')", value => value is "on" or "true",
            "شغّل SSL على PostgreSQL واشترط sslmode=require في سلسلة الاتصال.");

        await CheckAsync("SEC_PASSWORD_ENCRYPTION", "خوارزمية تشفير كلمات المرور ضعيفة",
            QaSeverity.Medium, "SELECT current_setting('password_encryption')",
            value => value == "scram-sha-256",
            "اضبط password_encryption = 'scram-sha-256' وأعد تعيين كلمات المرور القديمة.");

        await CheckAsync("SEC_APP_PASSWORDS", "كلمات مرور مخزّنة بصيغة غير آمنة",
            QaSeverity.Critical,
            "SELECT count(*) FROM users WHERE password_hash NOT LIKE '$2%'",
            value => value == "0",
            "أعد تشفير كلمات المرور بـ BCrypt؛ أي صيغة أخرى تعني تخزينًا ضعيفًا أو نصًا صريحًا.");

        await CheckAsync("SEC_SUPERUSERS", "حسابات قاعدة بيانات فائقة الصلاحية قابلة للدخول",
            QaSeverity.Medium,
            "SELECT count(*) FROM pg_roles WHERE rolsuper AND rolcanlogin",
            value => int.Parse(value) <= 2,
            "استخدم دور تطبيق محدود الصلاحيات بدل superuser لتقليل أثر أي اختراق.");

        await CheckAsync("SEC_PUBLIC_SCHEMA", "صلاحية CREATE عامة على مخطط public",
            QaSeverity.High,
            """
            SELECT count(*) FROM pg_namespace n, aclexplode(n.nspacl) a
            WHERE n.nspname = 'public' AND a.grantee = 0 AND a.privilege_type = 'CREATE'
            """,
            value => value == "0",
            "ألغِ CREATE عن PUBLIC: REVOKE CREATE ON SCHEMA public FROM PUBLIC.");

        await CheckAsync("SEC_PLAINTEXT_SESSIONS", "جلسات قاعدة بيانات بلا تشفير",
            QaSeverity.High,
            "SELECT count(*) FROM pg_stat_activity WHERE ssl IS FALSE AND pid <> pg_backend_pid()",
            value => value == "0",
            "أجبر كل الاتصالات على SSL؛ الجلسات غير المشفرة قابلة للتنصت.");

        await CheckAsync("SEC_LOG_CONNECTIONS", "تسجيل الاتصالات معطّل (ضعف التتبع)",
            QaSeverity.Low, "SELECT current_setting('log_connections')", value => value == "on",
            "فعّل log_connections وlog_disconnections لرصد محاولات الدخول.");

        await CheckSensitiveColumnsAsync(connection, tx, report, ct);
        await CheckScreenGuardsAsync(report);

        async Task CheckAsync(string code, string title, string severity, string sql,
            Func<string, bool> ok, string suggestion)
        {
            try
            {
                var raw = await SafeScalarAsync<object>(connection, tx, sql, null, ct);
                var value = raw?.ToString() ?? "";
                var passed = ok(value);
                report.Tests.Add(new QaTestRunRow
                {
                    Code = code, Name = title, Category = "Security",
                    Criticality = severity, Status = passed ? "Passed" : "Failed",
                    Message = $"القيمة المقاسة: {value}"
                });
                if (passed) return;
                report.Findings.Add(new QaFinding
                {
                    Area = "Security", Code = code, Severity = severity, Title = title,
                    Metric = value, Detail = "فحص أمني مباشر على قاعدة البيانات الحالية.",
                    Suggestion = suggestion
                });
            }
            catch (Exception ex)
            {
                report.Findings.Add(new QaFinding
                {
                    Area = "Security", Code = code + "_FAILED", Severity = QaSeverity.Low,
                    Title = $"تعذر تنفيذ الفحص الأمني: {title}",
                    Detail = Short(ex.GetBaseException().Message),
                    Suggestion = "راجع صلاحيات القراءة على إعدادات الخادم."
                });
            }
        }
    }
}