using System.Globalization;
using System.Text;

namespace Ubp.Application.Services;

/// <summary>ورقة تصدير: اسم + رؤوس أعمدة + صفوف قيم (نصوص/أرقام/تواريخ).</summary>
public sealed class PayrollSheet
{
    public PayrollSheet(string name, IReadOnlyList<string> headers, IReadOnlyList<IReadOnlyList<object?>> rows)
    {
        Name = name;
        Headers = headers;
        Rows = rows;
    }

    public string Name { get; }
    public IReadOnlyList<string> Headers { get; }
    public IReadOnlyList<IReadOnlyList<object?>> Rows { get; }
}

/// <summary>
/// مصنّف Excel متعدد الأوراق بصيغة SpreadsheetML (يفتح في Excel وLibreOffice) — بلا أي مكتبة خارجية.
/// كل الأرقام بصيغة ثابتة (InvariantCulture) حتى لا تتغير الفواصل العشرية حسب لغة الخادم.
/// </summary>
public static class PayrollWorkbookBuilder
{
    private const int MaxSheetName = 31;
    private static readonly char[] InvalidSheetChars = { ':', '\\', '/', '?', '*', '[', ']' };

    public static string BuildWorkbookXml(IReadOnlyList<PayrollSheet> sheets)
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        builder.AppendLine("""<?mso-application progid="Excel.Sheet"?>""");
        builder.AppendLine("""<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" """ +
                           """xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">""");
        builder.AppendLine("""<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/></Style></Styles>""");

        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var sheet in sheets)
        {
            var name = UniqueName(SanitizeName(sheet.Name), used);
            builder.Append("<Worksheet ss:Name=\"").Append(Escape(name)).AppendLine("\"><Table>");
            if (sheet.Headers.Count > 0)
            {
                builder.AppendLine("<Row>");
                foreach (var header in sheet.Headers)
                    builder.Append("<Cell ss:StyleID=\"hdr\"><Data ss:Type=\"String\">")
                        .Append(Escape(header)).AppendLine("</Data></Cell>");
                builder.AppendLine("</Row>");
            }

            foreach (var row in sheet.Rows)
            {
                builder.AppendLine("<Row>");
                foreach (var value in row) builder.AppendLine(BuildCell(value));
                builder.AppendLine("</Row>");
            }

            builder.AppendLine("</Table></Worksheet>");
        }

        builder.AppendLine("</Workbook>");
        return builder.ToString();
    }

    public static string BuildCsv(PayrollSheet sheet)
    {
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(',', sheet.Headers.Select(Csv)));
        foreach (var row in sheet.Rows)
            builder.AppendLine(string.Join(',', row.Select(CsvValue)));
        return builder.ToString();
    }

    /// <summary>اسم ورقة صالح: بلا محارف محظورة، وبحد 31 محرفاً، وغير مكرر.</summary>
    public static string SanitizeName(string name)
    {
        var cleaned = new string((name ?? "").Where(c => !InvalidSheetChars.Contains(c)).ToArray()).Trim();
        if (cleaned.Length == 0) cleaned = "Sheet";
        return cleaned.Length > MaxSheetName ? cleaned[..MaxSheetName] : cleaned;
    }

    private static string UniqueName(string name, HashSet<string> used)
    {
        if (used.Add(name)) return name;
        for (var i = 2; i < 1000; i++)
        {
            var candidate = name.Length + 4 > MaxSheetName ? name[..(MaxSheetName - 4)] : name;
            candidate = $"{candidate}_{i}";
            if (used.Add(candidate)) return candidate;
        }
        return $"{name[..Math.Min(name.Length, 20)]}_{Guid.NewGuid():N}";
    }

    private static string BuildCell(object? value)
    {
        if (value is null) return "<Cell/>";
        if (IsNumeric(value))
            return $"<Cell><Data ss:Type=\"Number\">{Numeric(value)}</Data></Cell>";
        if (value is DateTime date)
            return $"<Cell><Data ss:Type=\"DateTime\">{date:yyyy-MM-ddTHH:mm:ss}</Data></Cell>";
        if (value is DateOnly day)
            return $"<Cell><Data ss:Type=\"DateTime\">{day:yyyy-MM-dd}T00:00:00</Data></Cell>";
        return $"<Cell><Data ss:Type=\"String\">{Escape(value.ToString())}</Data></Cell>";
    }

    private static bool IsNumeric(object value) =>
        value is decimal or double or float or int or long or short or byte;

    private static string Numeric(object value) =>
        Convert.ToDecimal(value, CultureInfo.InvariantCulture).ToString("0.####", CultureInfo.InvariantCulture);

    private static string CsvValue(object? value) => value switch
    {
        null => "",
        DateTime date => Csv(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
        DateOnly day => Csv(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
        _ when IsNumeric(value) => Numeric(value),
        _ => Csv(value.ToString() ?? "")
    };

    private static string Csv(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;

    private static string Escape(string? value) => (value ?? "")
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
        .Replace("\"", "&quot;").Replace("'", "&apos;");
}
