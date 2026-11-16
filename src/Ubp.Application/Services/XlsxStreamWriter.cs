using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;

namespace Ubp.Application.Services;

/// <summary>نوع قيمة الخلية في ملف XLSX المبني يدوياً.</summary>
public enum XlsxCellKind
{
    Text = 0,
    Number = 1,
    Boolean = 2,
    Date = 3,
    DateTime = 4,
    Time = 5
}

/// <summary>
/// خلية Excel: النص أو الرقم أو القيمة المنطقية أو التاريخ. التواريخ تُكتب كأرقام تسلسلية
/// مع نمط عرض تاريخ، فيتعامل معها Excel كتواريخ حقيقية لا كنصوص.
/// </summary>
public readonly record struct XlsxCell(XlsxCellKind Kind, string? Text, string? RawNumber, bool Bool)
{
    public static XlsxCell FromText(string? value) => new(XlsxCellKind.Text, value, null, false);
    public static XlsxCell FromNumber(string rawNumber) => new(XlsxCellKind.Number, null, rawNumber, false);
    public static XlsxCell FromBoolean(bool value) => new(XlsxCellKind.Boolean, null, null, value);
    public static XlsxCell FromDate(double serial) =>
        new(XlsxCellKind.Date, null, serial.ToString("0.########", CultureInfo.InvariantCulture), false);
    public static XlsxCell FromDateTime(double serial) =>
        new(XlsxCellKind.DateTime, null, serial.ToString("0.########", CultureInfo.InvariantCulture), false);
    public static XlsxCell FromTime(double serial) =>
        new(XlsxCellKind.Time, null, serial.ToString("0.########", CultureInfo.InvariantCulture), false);
}

/// <summary>
/// كاتب ملفات XLSX متعدد الأوراق يعتمد على System.IO.Compression فقط (بلا حزم خارجية).
/// يكتب الورقة سطراً بسطر إلى تدفق ZIP مباشرة، فلا يُحمَّل الجدول كاملاً في الذاكرة —
/// ما يسمح بتصدير جداول ضخمة على دفعات.
/// </summary>
public sealed class XlsxStreamWriter : IAsyncDisposable
{
    private const string SheetNs =
        "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private const string RelNs =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    private readonly Stream _output;
    private readonly ZipArchive _zip;
    private readonly List<string> _sheetNames;
    private StreamWriter? _sheet;
    private int _rowIndex;

    public IReadOnlyList<string> SheetNames => _sheetNames;

    public XlsxStreamWriter(Stream output, IReadOnlyList<string> sheetNames)
    {
        if (sheetNames.Count == 0)
            throw new ArgumentException("At least one sheet is required.", nameof(sheetNames));

        _output = output;
        _sheetNames = UniqueSheetNames(sheetNames).ToList();
        _zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        AddText("[Content_Types].xml", ContentTypes(_sheetNames.Count));
        AddText("_rels/.rels", RootRels);
        AddText("xl/workbook.xml", Workbook(_sheetNames));
        AddText("xl/_rels/workbook.xml.rels", WorkbookRels(_sheetNames.Count));
        AddText("xl/styles.xml", Styles);
    }

    public async Task StartSheetAsync(int index, CancellationToken ct = default)
    {
        if (index < 0 || index >= _sheetNames.Count)
            throw new ArgumentOutOfRangeException(nameof(index));
        if (_sheet is not null)
            throw new InvalidOperationException("A sheet is already open.");

        _rowIndex = 0;
        var entry = _zip.CreateEntry($"xl/worksheets/sheet{index + 1}.xml",
            CompressionLevel.Fastest);
        _sheet = new StreamWriter(entry.Open(), new UTF8Encoding(false), 32 * 1024)
        {
            AutoFlush = false
        };
        await _sheet.WriteAsync(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            $"<worksheet xmlns=\"{SheetNs}\"><sheetData>");
        ct.ThrowIfCancellationRequested();
    }

    public Task WriteHeaderAsync(IReadOnlyList<string> headers, CancellationToken ct = default)
    {
        var cells = headers.Select(h => XlsxCell.FromText(h)).ToArray();
        return WriteRowAsync(cells, header: true, ct);
    }

    public Task WriteRowAsync(IReadOnlyList<XlsxCell> cells, CancellationToken ct = default) =>
        WriteRowAsync(cells, header: false, ct);

    private async Task WriteRowAsync(IReadOnlyList<XlsxCell> cells, bool header,
        CancellationToken ct)
    {
        if (_sheet is null) throw new InvalidOperationException("No sheet is open.");
        ct.ThrowIfCancellationRequested();

        _rowIndex++;
        var builder = new StringBuilder(64 + cells.Count * 24);
        builder.Append("<row r=\"").Append(_rowIndex).Append("\">");
        for (var column = 0; column < cells.Count; column++)
        {
            var cell = cells[column];
            if (cell.Kind == XlsxCellKind.Text && string.IsNullOrEmpty(cell.Text)) continue;
            var reference = ReportExporter.ColumnName(column + 1) + _rowIndex;
            var style = header ? 3 : cell.Kind switch
            {
                XlsxCellKind.Date => 1,
                XlsxCellKind.DateTime => 2,
                XlsxCellKind.Time => 4,
                _ => 0
            };
            var styleAttr = style == 0 ? string.Empty : $" s=\"{style}\"";
            switch (cell.Kind)
            {
                case XlsxCellKind.Number:
                case XlsxCellKind.Date:
                case XlsxCellKind.DateTime:
                case XlsxCellKind.Time:
                    builder.Append("<c r=\"").Append(reference).Append('"')
                        .Append(styleAttr).Append("><v>")
                        .Append(cell.RawNumber)
                        .Append("</v></c>");
                    break;
                case XlsxCellKind.Boolean:
                    builder.Append("<c r=\"").Append(reference).Append("\" t=\"b\"")
                        .Append(styleAttr).Append("><v>")
                        .Append(cell.Bool ? '1' : '0')
                        .Append("</v></c>");
                    break;
                default:
                    builder.Append("<c r=\"").Append(reference).Append("\" t=\"inlineStr\"")
                        .Append(styleAttr).Append("><is><t xml:space=\"preserve\">")
                        .Append(EscapeXml(cell.Text))
                        .Append("</t></is></c>");
                    break;
            }
        }
        builder.Append("</row>");
        await _sheet.WriteAsync(builder.ToString().AsMemory(), ct);
    }

    public async Task EndSheetAsync()
    {
        if (_sheet is null) return;
        await _sheet.WriteAsync("</sheetData></worksheet>");
        await _sheet.FlushAsync();
        await _sheet.DisposeAsync();
        _sheet = null;
    }

    public async ValueTask DisposeAsync()
    {
        await EndSheetAsync();
        _zip.Dispose();
        await _output.FlushAsync();
    }

    private void AddText(string path, string content)
    {
        var entry = _zip.CreateEntry(path, CompressionLevel.Fastest);
        using var stream = entry.Open();
        using var writer = new StreamWriter(stream, new UTF8Encoding(false));
        writer.Write(content);
    }

    /// <summary>Excel: اسم الورقة ≤ 31 حرفاً، بلا []:*?/\\، وفريد بلا حساسية لحالة الأحرف.</summary>
    public static IReadOnlyList<string> UniqueSheetNames(IReadOnlyList<string> names)
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<string>(names.Count);
        foreach (var raw in names)
        {
            var cleaned = new string((raw ?? string.Empty)
                .Where(c => c is not ('[' or ']' or ':' or '*' or '?' or '/' or '\\'))
                .ToArray()).Trim();
            if (string.IsNullOrWhiteSpace(cleaned)) cleaned = "Sheet";
            if (cleaned.Length > 31) cleaned = cleaned[..31];
            if (cleaned.EndsWith('\'')) cleaned = cleaned[..^1] + "_";

            var candidate = cleaned;
            var suffix = 2;
            while (!used.Add(candidate))
            {
                var tag = "_" + suffix++;
                candidate = cleaned.Length + tag.Length > 31
                    ? cleaned[..(31 - tag.Length)] + tag
                    : cleaned + tag;
            }
            result.Add(candidate);
        }
        return result;
    }

    private static string EscapeXml(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var builder = new StringBuilder(value.Length);
        foreach (var c in value)
        {
            // أحرف التحكم غير المسموحة في XML 1.0 تُحذف حتى لا يرفض Excel الملف.
            if (c < 0x20 && c is not ('\t' or '\n' or '\r')) continue;
            if (c is '\uFFFE' or '\uFFFF') continue;
            builder.Append(c);
        }
        return SecurityElement.Escape(builder.ToString()) ?? string.Empty;
    }

    private static string ContentTypes(int sheetCount)
    {
        var sheets = new StringBuilder();
        for (var i = 1; i <= sheetCount; i++)
            sheets.Append("<Override PartName=\"/xl/worksheets/sheet").Append(i)
                .Append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
               "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
               "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
               "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
               "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
               sheets +
               "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
               "</Types>";
    }

    private const string RootRels = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        </Relationships>
        """;

    private static string Workbook(IReadOnlyList<string> sheetNames)
    {
        var sheets = new StringBuilder();
        for (var i = 0; i < sheetNames.Count; i++)
            sheets.Append("<sheet name=\"").Append(SecurityElement.Escape(sheetNames[i]))
                .Append("\" sheetId=\"").Append(i + 1)
                .Append("\" r:id=\"rId").Append(i + 1).Append("\"/>");
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
               $"<workbook xmlns=\"{SheetNs}\" xmlns:r=\"{RelNs}\">" +
               "<sheets>" + sheets + "</sheets></workbook>";
    }

    private static string WorkbookRels(int sheetCount)
    {
        var rels = new StringBuilder();
        for (var i = 1; i <= sheetCount; i++)
            rels.Append("<Relationship Id=\"rId").Append(i)
                .Append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                .Append(i).Append(".xml\"/>");
        rels.Append("<Relationship Id=\"rId").Append(sheetCount + 1)
            .Append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
               "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
               rels + "</Relationships>";
    }

    private const string Styles = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <numFmts count="3">
            <numFmt numFmtId="164" formatCode="yyyy\-mm\-dd"/>
            <numFmt numFmtId="165" formatCode="yyyy\-mm\-dd\ hh:mm:ss"/>
            <numFmt numFmtId="166" formatCode="hh:mm:ss"/>
          </numFmts>
          <fonts count="2">
            <font><sz val="11"/><name val="Calibri"/></font>
            <font><b/><sz val="11"/><name val="Calibri"/></font>
          </fonts>
          <fills count="3">
            <fill><patternFill patternType="none"/></fill>
            <fill><patternFill patternType="gray125"/></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFE8F0EF"/><bgColor indexed="64"/></patternFill></fill>
          </fills>
          <borders count="1"><border/></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
          <cellXfs count="5">
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
            <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
            <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
            <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
            <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
          </cellXfs>
        </styleSheet>
        """;
}

