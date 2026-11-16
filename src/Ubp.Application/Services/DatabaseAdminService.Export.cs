using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Application.Services;

/// <summary>
/// تصدير بيانات قاعدة البيانات إلى Excel (XLSX) للقراءة فقط:
/// جدول منفرد أو كل الجداول في ملف واحد بورقة مستقلة لكل جدول.
/// يُقرأ من قاعدة البيانات مباشرة على دفعات (لا Cache ولا تحميل كامل للجدول)،
/// مع استبعاد الأعمدة الحساسة، واحترام حد Excel لكل ورقة، وتسجيل العملية في سجل المراجعة.
/// </summary>
public sealed partial class DatabaseAdminService
{
    /// <summary>حد Excel الصارم لكل ورقة (بما فيها صف العناوين).</summary>
    public const int ExcelMaxRows = 1_048_576;
    /// <summary>الحد الأقصى لصفوف البيانات في الورقة = الحد الأقصى ناقص صف العناوين.</summary>
    public const int ExcelMaxDataRows = ExcelMaxRows - 1;
    private const int ExportBatchSize = 2000;

    public async Task<TableExportResult> ExportTableAsync(ActorContext actor, string table,
        Stream output, Func<TableExportProgress, Task>? progress = null,
        CancellationToken ct = default)
    {
        RequireSuperAdmin(actor);
        await _permissions.RequireAsync(actor, ScreenCodes.DatabaseAdmin, ActionCodes.ExportTable, ct: ct);

        var columns = await ReadExportColumnsAsync(table, ct);
        var totalRows = await CountRowsSafeAsync(table, ct);
        var result = new MutableExportResult();

        await using (var writer = new XlsxStreamWriter(output, new[] { table }))
        {
            await writer.StartSheetAsync(0, ct);
            await writer.WriteHeaderAsync(columns.Select(c => c.Name).ToList(), ct);
            await ReportAsync(progress, 0, 0, 1, table, TableExportProgress.Running);
            await WriteTableRowsAsync(writer, table, columns, totalRows,
                Math.Min(totalRows, ExcelMaxDataRows), progress, 0, 1, result, ct);
            await writer.EndSheetAsync();
        }

        await ReportAsync(progress, 100, 1, 1, table, TableExportProgress.Completed);
        var tableResult = new TableExportResult(table + ".xlsx", result.Rows, 1,
            new[] { table }, result.TruncatedTables.Count > 0
                ? new[] { table }
                : Array.Empty<string>());
        await _audit.WriteAsync(actor, "database", table, "EXPORT", null, new
        {
            fileName = tableResult.FileName,
            tables = tableResult.Tables,
            rows = tableResult.RowsExported,
            truncated = tableResult.TruncatedTables
        }, ct);
        return tableResult;
    }

    public async Task<TableExportResult> ExportDatabaseAsync(ActorContext actor, Stream output,
        Func<TableExportProgress, Task>? progress = null, CancellationToken ct = default)
    {
        RequireSuperAdmin(actor);
        await _permissions.RequireAsync(actor, ScreenCodes.DatabaseAdmin, ActionCodes.ExportDatabase, ct: ct);

        var tables = (await _schema.GetTablesAsync(ct)).OrderBy(t => t.Name,
            StringComparer.Ordinal).ToList();
        if (tables.Count == 0)
            throw new ValidationAppException("database.no_tables");

        var result = new MutableExportResult();
        long totalTarget = 0;
        foreach (var table in tables)
            totalTarget += Math.Min(table.RowCount, ExcelMaxDataRows);
        if (totalTarget <= 0) totalTarget = tables.Count;

        await ReportAsync(progress, 0, 0, tables.Count, string.Empty, TableExportProgress.Running);
        await using (var writer = new XlsxStreamWriter(output, tables.Select(t => t.Name).ToList()))
        {
            for (var index = 0; index < tables.Count; index++)
            {
                var table = tables[index];
                var columns = await ReadExportColumnsAsync(table.Name, ct);
                await writer.StartSheetAsync(index, ct);
                await writer.WriteHeaderAsync(columns.Select(c => c.Name).ToList(), ct);
                await ReportAsync(progress, Percent(result.Rows, totalTarget, result.TablesDone,
                        tables.Count), result.TablesDone, tables.Count, table.Name,
                    TableExportProgress.Running);

                await WriteTableRowsAsync(writer, table.Name, columns, table.RowCount,
                    totalTarget, progress, result.TablesDone, tables.Count, result, ct);
                await writer.EndSheetAsync();

                result.TablesDone++;
                result.Tables.Add(table.Name);
                await ReportAsync(progress, Percent(result.Rows, totalTarget, result.TablesDone,
                        tables.Count), result.TablesDone, tables.Count, table.Name,
                    TableExportProgress.Running);
            }
        }

        await ReportAsync(progress, 100, tables.Count, tables.Count, string.Empty,
            TableExportProgress.Completed);
        var fileName = $"database-{DateTime.UtcNow:yyyyMMdd-HHmmss}.xlsx";
        var dbResult = new TableExportResult(fileName, result.Rows, tables.Count,
            result.Tables.ToList(), result.TruncatedTables.ToList());
        await _audit.WriteAsync(actor, "database", "all", "EXPORT", null, new
        {
            fileName,
            tables = dbResult.Tables,
            rows = dbResult.RowsExported,
            truncated = dbResult.TruncatedTables
        }, ct);
        return dbResult;
    }

    private async Task WriteTableRowsAsync(XlsxStreamWriter writer, string table,
        IReadOnlyList<ColumnInfo> columns, long tableTotalRows, long overallTarget,
        Func<TableExportProgress, Task>? progress, int tablesDone, int tablesTotal,
        MutableExportResult result, CancellationToken ct)
    {
        var exportLimit = Math.Min(tableTotalRows, ExcelMaxDataRows);
        long exportedForTable = 0;
        string? cursor = null;
        var columnNames = columns.Select(c => c.Name).ToList();

        while (exportedForTable < exportLimit)
        {
            ct.ThrowIfCancellationRequested();
            var size = (int)Math.Min(ExportBatchSize, exportLimit - exportedForTable);
            var batch = await _schema.ReadExportBatchAsync(table, columnNames, cursor, size, ct);
            if (batch.RowsJson.Count == 0) break;

            foreach (var json in batch.RowsJson)
            {
                await writer.WriteRowAsync(ExcelRowMapper.ToCells(json, columns), ct);
                exportedForTable++;
                result.Rows++;
                if (exportedForTable >= exportLimit) break;
            }

            cursor = batch.NextCursor;
            await ReportAsync(progress, Percent(result.Rows, overallTarget, tablesDone, tablesTotal),
                tablesDone, tablesTotal, table, TableExportProgress.Running);
            if (!batch.HasMore) break;
        }

        if (tableTotalRows > ExcelMaxDataRows) result.TruncatedTables.Add(table);
    }

    private async Task<IReadOnlyList<ColumnInfo>> ReadExportColumnsAsync(string table,
        CancellationToken ct)
    {
        IReadOnlyList<ColumnInfo> columns;
        try
        {
            columns = await _schema.GetColumnsAsync(table, ct);
        }
        catch (InvalidOperationException)
        {
            throw new ValidationAppException("validation.table_not_allowed");
        }
        var safe = columns.Where(c => !SensitiveDataColumns.IsSensitive(c.Name)).ToList();
        if (safe.Count == 0)
            throw new ValidationAppException("validation.no_exportable_columns");
        return safe;
    }

    private async Task<long> CountRowsSafeAsync(string table, CancellationToken ct)
    {
        try
        {
            return await _schema.CountRowsAsync(table, ct);
        }
        catch (InvalidOperationException)
        {
            throw new ValidationAppException("validation.table_not_allowed");
        }
    }

    private static Task ReportAsync(Func<TableExportProgress, Task>? progress, int percent,
        int tablesDone, int tablesTotal, string table, string status) =>
        progress is null
            ? Task.CompletedTask
            : progress(new TableExportProgress(Math.Clamp(percent, 0, 100), tablesDone,
                tablesTotal, table, status));

    private static int Percent(long rowsDone, long target, int tablesDone, int tablesTotal)
    {
        if (target > 0)
            return (int)Math.Clamp(rowsDone * 100 / target, 0, 99);
        return tablesTotal > 0
            ? (int)Math.Clamp((long)tablesDone * 100 / tablesTotal, 0, 99)
            : 0;
    }

    private sealed class MutableExportResult
    {
        public long Rows { get; set; }
        public int TablesDone { get; set; }
        public List<string> Tables { get; } = new();
        public List<string> TruncatedTables { get; } = new();
    }
}
