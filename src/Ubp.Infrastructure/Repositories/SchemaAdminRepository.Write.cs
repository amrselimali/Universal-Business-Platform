using System.Text.Json;
using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class SchemaAdminRepository
{
    private static readonly HashSet<string> EditableTables = new(StringComparer.Ordinal)
    {
        "app_settings", "branches", "warehouses", "warehouse_branches", "currencies",
        "custom_field_definitions", "roles", "role_permissions", "user_roles",
        "user_permissions", "user_branches", "user_warehouses", "users"
    };

    private static readonly HashSet<string> ReadableTables = new(StringComparer.Ordinal)
    {
        "app_settings", "branches", "warehouses", "warehouse_branches", "currencies",
        "custom_field_definitions", "roles", "role_permissions", "user_roles",
        "user_permissions", "user_branches", "user_warehouses", "users",
        "refresh_tokens", "user_sessions", "audit_log",
        "qa_test_definitions", "qa_test_runs", "qa_test_results", "qa_test_artifacts",
        "document_sequences", "schemaversions",
        "units", "item_categories", "items", "item_units", "item_barcodes",
        "customer_categories", "customers", "supplier_categories", "suppliers",
        "fiscal_periods", "period_scope_closures", "period_close_checks", "period_events",
        "stock_documents", "stock_document_lines", "stock_movements", "stock_balances",
        "stock_transfer_receipts", "stock_transfer_receipt_lines", "stocktakes", "stocktake_lines"
    };

    public async Task<RowPage> GetRowsAsync(string table, int page, CancellationToken ct = default)
    {
        // يبقى التوقيع القديم للتوافق؛ القراءة الفعلية تمر بالمسار الموحّد (بلا أعمدة حساسة).
        var data = await GetRowsPageAsync(table, page, 25, null, ct);
        return new RowPage(data.Columns.Select(c => c.Name).ToList(), data.RowsJson,
            (int)Math.Min(int.MaxValue, data.Total));
    }

    public async Task<Dictionary<string, object?>?> GetRowAsync(string table, string id,
        CancellationToken ct = default)
    {
        EnsureReadable(table);
        await using var connection = await _factory.OpenAsync(ct);
        var json = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            $"SELECT row_to_json(t)::text FROM (SELECT * FROM {table} WHERE id::text = @id) t",
            new { id }, cancellationToken: ct));
        return json is null ? null : JsonSerializer.Deserialize<Dictionary<string, object?>>(json);
    }

    private static void EnsureReadable(string table)
    {
        if (!ReadableTables.Contains(table))
            throw new InvalidOperationException("TABLE_NOT_ALLOWED");
    }

    internal static void EnsureEditable(string table)
    {
        if (!EditableTables.Contains(table))
            throw new InvalidOperationException("TABLE_READ_ONLY");
    }

    /// <summary>
    /// مسح كل بيانات الجداول المحددة فقط. يُتحقّق من أن الاسم جدول فعلي في public، ويستثني
    /// schemaversions. يستخدم TRUNCATE ... RESTRICT فلا يُحذف أي جدول غير محدد؛ وإن كانت هناك
    /// جداول أخرى تشير للجدول المحدد عبر مفتاح أجنبي يفشل الطلب (حماية) بدل الحذف المتسلسل.
    /// </summary>
    public async Task<int> ClearTablesAsync(IReadOnlyList<string> tables,
        CancellationToken ct = default)
    {
        if (tables.Count == 0) return 0;
        var requested = tables
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Where(t => !string.Equals(t, "schemaversions", StringComparison.Ordinal))
            .Where(t => SafeName.IsMatch(t))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (requested.Count == 0) return 0;

        await using var connection = await _factory.OpenAsync(ct);
        var existing = (await connection.QueryAsync<string>(new CommandDefinition(
            "SELECT table_name FROM information_schema.tables " +
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
            cancellationToken: ct))).ToHashSet(StringComparer.Ordinal);
        var valid = requested.Where(existing.Contains).ToList();
        if (valid.Count == 0) return 0;

        var list = string.Join(", ", valid.Select(t => $"\"public\".\"{t}\""));
        await connection.ExecuteAsync(new CommandDefinition(
            $"TRUNCATE TABLE {list} RESTRICT", cancellationToken: ct));
        return valid.Count;
    }
}
