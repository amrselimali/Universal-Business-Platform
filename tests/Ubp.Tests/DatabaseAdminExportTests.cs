using System.IO.Compression;
using System.Text;
using Dapper;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// قراءة الجداول للاستعراض والتصدير على قاعدة PostgreSQL حقيقية: أعمدة حقيقية،
/// بحث وصفحات وإجمالي، دفعات تصدير، ملف Excel لجدول/لكل القاعدة، واستبعاد الحقول الحساسة.
/// </summary>
public sealed class DatabaseAdminExportTests
{
    [Fact]
    public async Task Browse_returns_real_columns_pages_search_and_total_without_secrets()
    {
        var db = new TestDb();
        await CreateProbeAsync(db);
        var repo = new SchemaAdminRepository(db.Factory);

        var first = await repo.GetRowsPageAsync("export_probe", 1, 2, null);
        Assert.Equal(3, first.Total);
        Assert.Equal(2, first.RowsJson.Count);
        Assert.Equal(2, first.PageSize);
        Assert.Contains(first.Columns, c => c.Name == "qty");
        Assert.DoesNotContain(first.Columns, c => c.Name == "password_hash");
        Assert.DoesNotContain(first.Columns, c => c.Name == "app_secret");
        Assert.DoesNotContain("hash1", string.Join("", first.RowsJson));

        var second = await repo.GetRowsPageAsync("export_probe", 2, 2, null);
        Assert.Single(second.RowsJson);
        Assert.Equal(3, second.Total);

        var search = await repo.GetRowsPageAsync("export_probe", 1, 25, "BETA");
        Assert.Equal(1, search.Total);
        Assert.Single(search.RowsJson);
        Assert.Contains("beta-2", search.RowsJson[0]);

        var noMatch = await repo.GetRowsPageAsync("export_probe", 1, 25, "does-not-exist");
        Assert.Equal(0, noMatch.Total);
        Assert.Empty(noMatch.RowsJson);

        // رموز LIKE تُبحث حرفياً: "%_" موجودة في gamma%_3 فقط، ولو لم تُهرَّب لطابقت الجميع.
        var escaped = await repo.GetRowsPageAsync("export_probe", 1, 25, "%_");
        Assert.Equal(1, escaped.Total);
        Assert.Contains("gamma%_3", escaped.RowsJson[0]);
    }

    [Fact]
    public async Task Browse_works_for_every_real_table_not_only_a_hardcoded_allowlist()
    {
        var db = new TestDb();
        await using (var connection = await db.Factory.OpenAsync())
        {
            await connection.ExecuteAsync("""
                CREATE TABLE "MixedCaseTable" (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    label text NOT NULL
                );
                INSERT INTO "MixedCaseTable" (label) VALUES ('first-row');
                """);
        }
        var repo = new SchemaAdminRepository(db.Factory);

        var page = await repo.GetRowsPageAsync("MixedCaseTable", 1, 10, null);
        Assert.Equal(1, page.Total);
        Assert.Contains(page.Columns, c => c.Name == "label");
        Assert.Contains("first-row", page.RowsJson[0]);

        var tables = await repo.GetTablesAsync();
        var info = Assert.Single(tables, t => t.Name == "MixedCaseTable");
        Assert.Equal(1, info.RowCount);
    }

    [Fact]
    public async Task Export_batches_read_every_row_once_without_loading_the_table_at_once()
    {
        var db = new TestDb();
        await CreateProbeAsync(db);
        var repo = new SchemaAdminRepository(db.Factory);
        var columns = (await repo.GetColumnsAsync("export_probe"))
            .Where(c => !SensitiveDataColumns.IsSensitive(c.Name))
            .Select(c => c.Name).ToList();

        Assert.Equal(3, await repo.CountRowsAsync("export_probe"));

        var first = await repo.ReadExportBatchAsync("export_probe", columns, null, 2);
        Assert.Equal(2, first.RowsJson.Count);
        Assert.True(first.HasMore);
        Assert.NotNull(first.NextCursor);

        var second = await repo.ReadExportBatchAsync("export_probe", columns,
            first.NextCursor, 2);
        Assert.Single(second.RowsJson);
        Assert.False(second.HasMore);
        Assert.Null(second.NextCursor);

        var all = string.Join("", first.RowsJson.Concat(second.RowsJson));
        Assert.Contains("alpha-1", all);
        Assert.Contains("beta-2", all);
        Assert.Contains("gamma%_3", all);
        Assert.DoesNotContain("hash1", all);
    }

    [Fact]
    public async Task Single_table_export_is_named_after_the_table_and_excludes_secrets()
    {
        var db = new TestDb();
        await CreateProbeAsync(db);
        var service = Service(db);
        var actor = await db.AdminActorAsync();

        using var buffer = new MemoryStream();
        var result = await service.ExportTableAsync(actor, "export_probe", buffer);

        Assert.Equal("export_probe.xlsx", result.FileName);
        Assert.Equal(3, result.RowsExported);
        Assert.Equal(1, result.TablesExported);
        Assert.Empty(result.TruncatedTables);

        using var zip = new ZipArchive(new MemoryStream(buffer.ToArray()), ZipArchiveMode.Read);
        var sheet = ReadEntry(zip, "xl/worksheets/sheet1.xml");
        Assert.Contains("code", sheet);
        Assert.Contains("alpha-1", sheet);
        Assert.Contains("<c r=\"C2\"><v>12.50</v></c>", sheet);
        Assert.Contains("t=\"b\"", sheet);
        foreach (var entry in zip.Entries)
            Assert.DoesNotContain("hash1", ReadEntry(zip, entry.FullName));
    }

    [Fact]
    public async Task Whole_database_export_has_a_sheet_per_table_and_one_excel_file()
    {
        var db = new TestDb();
        await CreateProbeAsync(db);
        var service = Service(db);
        var actor = await db.AdminActorAsync();

        using var buffer = new MemoryStream();
        var progress = new List<TableExportProgress>();
        var result = await service.ExportDatabaseAsync(actor, buffer, p =>
        {
            progress.Add(p);
            return Task.CompletedTask;
        });

        Assert.True(result.TablesExported > 50, $"only {result.TablesExported} tables");
        Assert.Contains("export_probe", result.Tables);
        Assert.EndsWith(".xlsx", result.FileName);
        Assert.Contains(progress, p => p.Status == TableExportProgress.Running
                                     && p.CurrentTable == "export_probe");
        Assert.Equal(100, progress[^1].Percent);
        Assert.Equal(TableExportProgress.Completed, progress[^1].Status);
        Assert.Equal(result.TablesExported, progress[^1].TablesDone);
        Assert.Equal(result.TablesExported, progress[^1].TablesTotal);
        for (var i = 1; i < progress.Count; i++)
            Assert.True(progress[i].Percent >= progress[i - 1].Percent);

        using var zip = new ZipArchive(new MemoryStream(buffer.ToArray()), ZipArchiveMode.Read);
        var workbook = ReadEntry(zip, "xl/workbook.xml");
        Assert.Contains("name=\"export_probe\"", workbook);
        Assert.Equal(result.TablesExported,
            zip.Entries.Count(e => e.FullName.StartsWith("xl/worksheets/sheet")));

        // العملية مسجلة في سجل المراجعة بإجراء EXPORT (ترحيل 0095).
        await using var connection = await db.Factory.OpenAsync();
        var audit = await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM audit_log WHERE action = 'EXPORT'");
        Assert.True(audit >= 1, $"audit EXPORT rows = {audit}");
    }

    private static DatabaseAdminService Service(TestDb db) =>
        new(new SchemaAdminRepository(db.Factory), null!, null!, db.Permissions(),
            db.Settings(), new AuditService(db.AuditRepo));

    private static async Task CreateProbeAsync(TestDb db)
    {
        await using var connection = await db.Factory.OpenAsync();
        await connection.ExecuteAsync("""
            CREATE TABLE export_probe (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                code text NOT NULL,
                qty numeric(12,2) NOT NULL,
                price numeric(20,2),
                active boolean NOT NULL DEFAULT true,
                due_date date,
                created_at timestamptz NOT NULL DEFAULT now(),
                notes jsonb,
                password_hash text,
                app_secret text
            );
            INSERT INTO export_probe
                (code, qty, price, active, due_date, notes, password_hash, app_secret)
            VALUES
                ('alpha-1', 12.50, 123456789012345678.90, true, '2026-01-02',
                 '{"a":1}', 'hash1', 'sec1'),
                ('beta-2', 3.00, 10, false, '2025-12-31', null, 'hash2', 'sec2'),
                ('gamma%_3', 0, null, true, null, null, 'hash3', 'sec3');
            """);
    }

    private static string ReadEntry(ZipArchive zip, string path)
    {
        using var stream = zip.GetEntry(path)!.Open();
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
