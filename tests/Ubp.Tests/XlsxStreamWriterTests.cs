using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// كاتب XLSX المتدفق: حزمة OOXML متعددة الأوراق، أنواع خلايا حقيقية (أرقام/تواريخ/منطقي)،
/// وأسماء أوراق صالحة وفريدة. ومحوّل صفوف JSON إلى خلايا بأنواع Excel.
/// </summary>
public sealed class XlsxStreamWriterTests
{
    [Fact]
    public async Task Multi_sheet_workbook_has_one_sheet_per_table_with_typed_cells()
    {
        using var buffer = new MemoryStream();
        await using (var writer = new XlsxStreamWriter(buffer, new[] { "users", "orders" }))
        {
            await writer.StartSheetAsync(0);
            await writer.WriteHeaderAsync(new[] { "id", "qty", "due", "active" });
            await writer.WriteRowAsync(new[]
            {
                XlsxCell.FromText("u-1"), XlsxCell.FromNumber("12.5"),
                XlsxCell.FromDate(46023), XlsxCell.FromBoolean(true)
            });
            await writer.EndSheetAsync();

            await writer.StartSheetAsync(1);
            await writer.WriteHeaderAsync(new[] { "code" });
            await writer.WriteRowAsync(new[] { XlsxCell.FromText("IT-1") });
            await writer.EndSheetAsync();
        }

        var bytes = buffer.ToArray();
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        var names = zip.Entries.Select(e => e.FullName).ToHashSet();
        Assert.Contains("xl/worksheets/sheet1.xml", names);
        Assert.Contains("xl/worksheets/sheet2.xml", names);
        Assert.Contains("xl/styles.xml", names);

        var workbook = ReadEntry(zip, "xl/workbook.xml");
        Assert.Contains("name=\"users\"", workbook);
        Assert.Contains("name=\"orders\"", workbook);
        Assert.Contains("sheetId=\"2\"", workbook);

        var sheet1 = ReadEntry(zip, "xl/worksheets/sheet1.xml");
        Assert.Contains("<c r=\"A1\" t=\"inlineStr\" s=\"3\"><is><t xml:space=\"preserve\">id</t>", sheet1);
        Assert.Contains("<c r=\"B2\"><v>12.5</v></c>", sheet1);
        Assert.Contains("<c r=\"C2\" s=\"1\"><v>46023</v></c>", sheet1);
        Assert.Contains("<c r=\"D2\" t=\"b\"><v>1</v></c>", sheet1);
        Assert.Contains("IT-1", ReadEntry(zip, "xl/worksheets/sheet2.xml"));
    }

    [Fact]
    public void Sheet_names_are_sanitized_truncated_and_unique()
    {
        var names = XlsxStreamWriter.UniqueSheetNames(new[]
        {
            "bad/name:[*?]", new string('x', 40), "BADNAME", "Sheet"
        });

        Assert.Equal(4, names.Count);
        Assert.DoesNotContain('/', names[0]);
        Assert.DoesNotContain(':', names[0]);
        Assert.True(names[1].Length <= 31);
        Assert.Equal(names.Count, names.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.All(names, n => Assert.True(n.Length is > 0 and <= 31));
    }

    [Fact]
    public void Row_mapper_preserves_numbers_booleans_dates_and_text()
    {
        var number = ExcelRowMapper.ToCell(Json("12.50"), "numeric");
        Assert.Equal(XlsxCellKind.Number, number.Kind);
        Assert.Equal("12.50", number.RawNumber);

        var boolean = ExcelRowMapper.ToCell(Json("true"), "boolean");
        Assert.Equal(XlsxCellKind.Boolean, boolean.Kind);
        Assert.True(boolean.Bool);

        var date = ExcelRowMapper.ToCell(Json("\"2026-01-02\""), "date");
        Assert.Equal(XlsxCellKind.Date, date.Kind);
        Assert.Equal("46024", date.RawNumber);

        var timestamp = ExcelRowMapper.ToCell(Json("\"2026-01-02T03:04:05+00:00\""),
            "timestamp with time zone");
        Assert.Equal(XlsxCellKind.DateTime, timestamp.Kind);

        var time = ExcelRowMapper.ToCell(Json("\"03:04:05\""), "time without time zone");
        Assert.Equal(XlsxCellKind.Time, time.Kind);

        var text = ExcelRowMapper.ToCell(Json("\"<A> & B\""), "character varying");
        Assert.Equal(XlsxCellKind.Text, text.Kind);
        Assert.Equal("<A> & B", text.Text);

        var json = ExcelRowMapper.ToCell(Json("{\"a\":1}"), "jsonb");
        Assert.Equal(XlsxCellKind.Text, json.Kind);
        Assert.Equal("{\"a\":1}", json.Text);

        var empty = ExcelRowMapper.ToCell(Json("null"), "text");
        Assert.Equal(XlsxCellKind.Text, empty.Kind);
        Assert.Null(empty.Text);
    }

    [Fact]
    public void Numbers_beyond_excel_precision_are_exported_as_text()
    {
        var cell = ExcelRowMapper.ToCell(Json("12345678901234567890"), "numeric");
        Assert.Equal(XlsxCellKind.Text, cell.Kind);
        Assert.Equal("12345678901234567890", cell.Text);
    }

    [Fact]
    public void Sensitive_columns_are_recognized()
    {
        foreach (var name in new[]
                 { "password_hash", "token_hash", "app_secret", "access_token", "api_key" })
            Assert.True(SensitiveDataColumns.IsSensitive(name), name);

        foreach (var name in new[]
                 { "username", "password_min_length", "refresh_token_id", "name_ar", "notes" })
            Assert.False(SensitiveDataColumns.IsSensitive(name), name);
    }

    private static JsonElement Json(string raw)
    {
        using var document = JsonDocument.Parse(raw);
        return document.RootElement.Clone();
    }

    private static string ReadEntry(ZipArchive zip, string path)
    {
        using var stream = zip.GetEntry(path)!.Open();
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
