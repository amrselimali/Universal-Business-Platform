using Dapper;
using Npgsql;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>جداول مستندات يجب أن يقابلها قيد محاسبي عند الترحيل.</summary>
    private static readonly string[] AccountingDocs =
    {
        "commercial_documents", "vouchers", "operating_expenses", "booking_settlements",
        "review_adjustments", "employee_advances", "reservation_adjustments",
        "delivery_notes", "service_transfers", "cash_handovers", "shift_cash_counts",
        "asset_depreciation_runs", "asset_maintenance_orders", "fixed_assets"
    };

    /// <summary>اختبار دورة الحسابات: توازن القيود واكتمال الترحيل وعدم وجود أجزاء مفقودة.</summary>
    private async Task CollectAccountingAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        QaAuditReport report, CancellationToken ct)
    {
        await CheckSqlAsync("ACC_ENTRY_UNBALANCED", "قيود غير متوازنة (مدين ≠ دائن)",
            QaSeverity.Critical, """
            SELECT count(*) FROM (
                SELECT entry_id FROM journal_entry_lines
                GROUP BY entry_id
                HAVING round(sum(debit), 2) <> round(sum(credit), 2)
            ) x
            """, "أي قيد غير متوازن يعني خللًا في الترحيل المحاسبي — راجعه قبل إغلاق الفترة.");

        await CheckSqlAsync("ACC_ORPHAN_LINES", "بنود قيود بلا قيد أب",
            QaSeverity.Critical, """
            SELECT count(*) FROM journal_entry_lines l
            WHERE NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.entry_id)
            """, "بنود يتيمة تشير إلى قيود محذوفة — نظّفها وأصلح القيد الأصلي.");

        await CheckSqlAsync("ACC_EMPTY_ENTRIES", "قيود بلا بنود",
            QaSeverity.High, """
            SELECT count(*) FROM journal_entries e
            WHERE NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.entry_id = e.id)
            """, "القيد الفارغ يفسد الميزان — إما احذفه أو أضف بنوده.");

        await CheckSqlAsync("ACC_GL_IMBALANCE", "ميزان الأستاذ العام غير متوازن",
            QaSeverity.Critical, """
            SELECT count(*) FROM (
                SELECT 1 FROM gl_balances
                HAVING round(coalesce(sum(debit - credit), 0), 2) <> 0
            ) x
            """, "مجموع المدين يجب أن يساوي الدائن في gl_balances — تحقق من الترحيلات المعلقة.");

        await CheckSqlAsync("ACC_DUPLICATE_DOC_NO", "أرقام مستندات مكررة",
            QaSeverity.High, """
            SELECT count(*) FROM (
                SELECT doc_type, doc_no FROM commercial_documents
                GROUP BY doc_type, doc_no HAVING count(*) > 1
            ) x
            """, "تكرار رقم المستند يفسد التتبع والمراجعة — أصلح مولّد التسلسل.");

        await CheckSqlAsync("ACC_DRAFT_PERIODS", "فترات محاسبية غير سليمة",
            QaSeverity.High, "SELECT count(*) FROM fiscal_periods WHERE end_date < start_date",
            "فترة تنتهي قبل بدايتها تمنع الترحيل الصحيح — صحّح تواريخ الفترات.");

        await CheckSqlAsync("ACC_POSTING_DEFAULTS", "إعدادات ترحيل ناقصة",
            QaSeverity.Medium, "SELECT count(*) FROM posting_defaults WHERE account_id IS NULL",
            "أكمل ربط الحسابات الافتراضية من إعدادات المحاسبة.");

        await CheckSqlAsync("ACC_CATEGORY_ACCOUNTS", "تصنيفات أصناف بلا حسابات",
            QaSeverity.Medium, """
            SELECT count(*) FROM item_categories c
            LEFT JOIN item_category_accounts m ON m.category_id = c.id
            WHERE m.id IS NULL OR m.inventory_account_id IS NULL
            """, "كل تصنيف يحتاج حساب مخزون وتكلفة مبيعات حتى لا يفشل توليد القيد.");
        await EnrichMissingCategoryAccountsAsync(connection, tx, report, ct);

        await CheckPostedDocumentsAsync(connection, tx, report, ct);

        async Task CheckSqlAsync(string code, string title, string severity, string sql,
            string suggestion)
        {
            try
            {
                var count = await SafeScalarAsync<long>(connection, tx, sql, null, ct);
                var passed = count == 0;
                report.Tests.Add(new QaTestRunRow
                {
                    Code = code, Name = title, Category = "Accounting", Criticality = severity,
                    Status = passed ? "Passed" : "Failed", Message = $"عدد الحالات: {count}"
                });
                if (passed) return;
                report.Findings.Add(new QaFinding
                {
                    Area = "Accounting", Code = code, Severity = severity, Title = title,
                    Metric = $"{count} حالة", Detail = "فحص مباشر لدورة الترحيل المحاسبي.",
                    Suggestion = suggestion
                });
            }
            catch (Exception ex)
            {
                report.Findings.Add(new QaFinding
                {
                    Area = "Accounting", Code = code + "_FAILED", Severity = QaSeverity.Low,
                    Title = $"تعذر تنفيذ فحص: {title}",
                    Detail = Short(ex.GetBaseException().Message),
                    Suggestion = "تحقق من وجود الجداول/الأعمدة في المخطط الحالي."
                });
            }
        }
    }

    /// <summary>يضيف أسماء التصنيفات الناقصة إلى الملاحظة لتسهيل الإصلاح من الإعدادات.</summary>
    private static async Task EnrichMissingCategoryAccountsAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, QaAuditReport report, CancellationToken ct)
    {
        var finding = report.Findings.LastOrDefault(f => f.Code == "ACC_CATEGORY_ACCOUNTS");
        if (finding is null) return;
        var names = (await connection.QueryAsync<string>(new CommandDefinition("""
            SELECT c.name_ar FROM item_categories c
            LEFT JOIN item_category_accounts m ON m.category_id = c.id
            WHERE m.id IS NULL OR m.inventory_account_id IS NULL
            ORDER BY c.name_ar LIMIT 10
            """, transaction: tx, cancellationToken: ct))).ToList();
        if (names.Count > 0)
            finding.Detail += " — التصنيفات: " + string.Join("، ", names);
    }
}