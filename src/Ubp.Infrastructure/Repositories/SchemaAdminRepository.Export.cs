using Dapper;
using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// قراءة بيانات الجداول للاستعراض والتصدير: أعمدة حقيقية من information_schema،
/// بحث خادمي، صفحات قابلة للتحديد، وتصدير على دفعات بلا تحميل الجدول كاملاً في الذاكرة.
/// الأعمدة الحساسة (password_hash, token_hash, app_secret, ...) تُستبعد دائماً.
/// </summary>
public sealed partial class SchemaAdminRepository
{
    public async Task<TableRowsPage> GetRowsPageAsync(string table, int page, int pageSize,
        string? search, CancellationToken ct = default)
    {
        await EnsureReadableAsync(table, ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 500);

        var columns = await GetReadableColumnsAsync(table, ct);
        if (columns.Count == 0)
            throw new InvalidOperationException("TABLE_NO_READABLE_COLUMNS");

        var columnList = string.Join(", ", columns.Select(c => Quote(c.Name)));
        var searchSql = BuildSearch(columns, search, out var pattern);
        var order = columns.Any(c => c.Name == "id")
            ? table == "audit_log" ? Quote("id") + " DESC" : Quote("id") + " ASC"
            : "ctid ASC";

        var sql = $"""
            SELECT row_to_json(t)::text
            FROM (
                SELECT {columnList}
                FROM {Quote(table)}
                {searchSql}
                ORDER BY {order}
                LIMIT @limit OFFSET @offset
            ) t;
            SELECT count(*)::bigint FROM {Quote(table)} {searchSql};
            """;

        var parameters = new DynamicParameters();
        parameters.Add("limit", pageSize);
        parameters.Add("offset", (long)(page - 1) * pageSize);
        if (pattern is not null) parameters.Add("pattern", pattern);

        await using var connection = await _factory.OpenAsync(ct);
        using var multi = await connection.QueryMultipleAsync(
            new CommandDefinition(sql, parameters, cancellationToken: ct));
        var rows = (await multi.ReadAsync<string>()).ToList();
        var total = await multi.ReadFirstAsync<long>();
        return new TableRowsPage(columns, rows, total, page, pageSize);
    }

    public async Task<TableExportBatch> ReadExportBatchAsync(string table,
        IReadOnlyList<string> columns, string? cursor, int batchSize,
        CancellationToken ct = default)
    {
        await EnsureReadableAsync(table, ct);
        if (columns.Count == 0)
            throw new InvalidOperationException("TABLE_NO_READABLE_COLUMNS");
        batchSize = Math.Clamp(batchSize, 1, 5000);

        var columnList = string.Join(", ", columns.Select(Quote));
        var take = batchSize + 1;
        // Keyset على ctid: مسح متسلسل للجدول دفعة بعد دفعة بلا OFFSET متزايد ولا قفل للجدول.
        var sql = $"""
            SELECT x.__ctid::text AS Cursor, row_to_json(x)::text AS Json
            FROM (
                SELECT ctid AS __ctid, {columnList}
                FROM {Quote(table)}
                WHERE ctid > @cursor::tid
                ORDER BY ctid
                LIMIT @take
            ) x
            ORDER BY x.__ctid
            """;

        await using var connection = await _factory.OpenAsync(ct);
        var rows = (await connection.QueryAsync<ExportRow>(new CommandDefinition(sql, new
        {
            cursor = string.IsNullOrWhiteSpace(cursor) ? "(0,0)" : cursor,
            take
        }, cancellationToken: ct))).ToList();

        var hasMore = rows.Count > batchSize;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        return new TableExportBatch(rows.Select(r => r.Json).ToList(),
            hasMore ? rows[^1].Cursor : null, hasMore);
    }

    public async Task<long> CountRowsAsync(string table, CancellationToken ct = default)
    {
        await EnsureReadableAsync(table, ct);
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            $"SELECT count(*)::bigint FROM {Quote(table)}", cancellationToken: ct));
    }

    private async Task<IReadOnlyList<ColumnInfo>> GetReadableColumnsAsync(string table,
        CancellationToken ct)
    {
        var columns = await GetColumnsAsync(table, ct);
        return columns.Where(c => !SensitiveDataColumns.IsSensitive(c.Name)).ToList();
    }

    private async Task EnsureReadableAsync(string table, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(table) || !SafeName.IsMatch(table))
            throw new InvalidOperationException("TABLE_NOT_ALLOWED");

        await using var connection = await _factory.OpenAsync(ct);
        var exists = await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = @table
                  AND table_type = 'BASE TABLE')
            """, new { table }, cancellationToken: ct));
        if (!exists) throw new InvalidOperationException("TABLE_NOT_ALLOWED");
    }

    private static string BuildSearch(IReadOnlyList<ColumnInfo> columns, string? search,
        out string? pattern)
    {
        pattern = null;
        if (string.IsNullOrWhiteSpace(search)) return string.Empty;
        pattern = "%" + EscapeLike(search.Trim()) + "%";
        var conditions = columns.Select(c =>
            $"{Quote(c.Name)}::text ILIKE @pattern ESCAPE '\\'");
        return "WHERE " + string.Join(" OR ", conditions);
    }

    private static string EscapeLike(string value) => value
        .Replace("\\", "\\\\")
        .Replace("%", "\\%")
        .Replace("_", "\\_");

    private static string Quote(string identifier) =>
        "\"" + identifier.Replace("\"", "\"\"") + "\"";

    private sealed class ExportRow
    {
        public string Cursor { get; set; } = "";
        public string Json { get; set; } = "";
    }
}
