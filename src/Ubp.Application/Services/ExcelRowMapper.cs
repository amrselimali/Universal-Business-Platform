using System.Globalization;
using System.Text.Json;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

/// <summary>
/// تحويل صف JSON (ناتج row_to_json من PostgreSQL) إلى خلايا Excel بأنواع مناسبة:
/// الأعداد أرقام، القيم المنطقية منطقية، التواريخ تواريخ حقيقية بنمط عرض،
/// وكل ما عدا ذلك نص (بما فيه jsonb والمصفوفات).
/// </summary>
public static class ExcelRowMapper
{
    private static readonly DateTime ExcelEpoch = new(1899, 12, 30);

    public static IReadOnlyList<XlsxCell> ToCells(string json,
        IReadOnlyList<ColumnInfo> columns)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var cells = new XlsxCell[columns.Count];
        for (var i = 0; i < columns.Count; i++)
        {
            cells[i] = root.TryGetProperty(columns[i].Name, out var value)
                ? ToCell(value, columns[i].DataType)
                : XlsxCell.FromText(null);
        }
        return cells;
    }

    public static XlsxCell ToCell(JsonElement value, string dataType)
    {
        if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return XlsxCell.FromText(null);

        if (value.ValueKind is JsonValueKind.True or JsonValueKind.False)
            return XlsxCell.FromBoolean(value.GetBoolean());

        if (value.ValueKind == JsonValueKind.Number)
        {
            var raw = value.GetRawText();
            return FitsExcelPrecision(raw) ? XlsxCell.FromNumber(raw) : XlsxCell.FromText(raw);
        }

        if (value.ValueKind is JsonValueKind.Array or JsonValueKind.Object)
            return XlsxCell.FromText(value.GetRawText());

        var text = value.GetString() ?? string.Empty;
        var type = dataType.Trim().ToLowerInvariant();
        switch (type)
        {
            case "date":
                if (DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                        DateTimeStyles.None, out var date))
                    return XlsxCell.FromDate(Serial(new DateTime(date.Year, date.Month, date.Day)));
                break;
            case "timestamp with time zone":
                if (DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture,
                        DateTimeStyles.RoundtripKind, out var dto))
                    return XlsxCell.FromDateTime(Serial(dto.UtcDateTime));
                break;
            case "timestamp without time zone":
                if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None,
                        out var timestamp))
                    return XlsxCell.FromDateTime(Serial(timestamp));
                break;
            case "time without time zone":
                if (TimeSpan.TryParse(text, CultureInfo.InvariantCulture, out var time))
                    return XlsxCell.FromTime(time.TotalDays);
                break;
        }
        return XlsxCell.FromText(text);
    }

    /// <summary>Excel يحتفظ بدقة 15 رقماً فقط؛ الأعداد الأطول تُكتب كنص حتى لا تُقرَّب.</summary>
    private static bool FitsExcelPrecision(string raw)
    {
        if (raw.Contains('e') || raw.Contains('E')) return true;
        var digits = raw.TrimStart('-').Replace(".", string.Empty).TrimStart('0').Length;
        return digits <= 15;
    }

    private static double Serial(DateTime value) =>
        Math.Round((value - ExcelEpoch).TotalDays, 8);
}
