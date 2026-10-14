using System.Text.Json;
using Dapper;

namespace Erp.Common.Metadata;

/// <summary>
/// تعريف عمود واحد داخل كيان. يأتي من جدول core.entity_fields في الإنتاج.
/// </summary>
public sealed class ColumnDefinition
{
    public required string Name { get; init; }
    public string LabelAr { get; init; } = string.Empty;
    public string LabelEn { get; init; } = string.Empty;
    public string DataType { get; init; } = "string";
    public bool IsReadOnly { get; init; }
    public bool IsPrimaryKey { get; init; }
}

/// <summary>
/// تعريف كيان (Entity) يربط رمز منطقي مثل core.branch بجدول PostgreSQL فعلي.
/// هو أساس الـ Generic Data API: لا تُكتب شاشات CRUD يدوياً.
/// </summary>
public sealed class EntityDefinition
{
    public required string Module { get; init; }
    public required string Entity { get; init; }
    public required string Schema { get; init; }
    public required string Table { get; init; }
    public required IReadOnlyList<ColumnDefinition> Columns { get; init; }
    public string? DisplayNameAr { get; init; }

    /// <summary>مثال: core.branch</summary>
    public string Code => $"{Module}.{Entity}";

    /// <summary>مثال: core.branches — يُستخدم في الرسائل فقط.</summary>
    public string FullTableName => $"{Schema}.{Table}";

    /// <summary>اسم الجدول مُقتبساً وآمناً لاستخدامه في SQL ديناميكي.</summary>
    public string QualifiedTableName =>
        $"{SqlIdentifier.Quote(Schema)}.{SqlIdentifier.Quote(Table)}";

    /// <summary>
    /// الأعمدة المسموح للمستخدم بكتابتها. تُستثنى أعمدة النظام
    /// (id, tenant_id, version, created_*, updated_*, deleted_at) لأن
    /// الـ Triggers وقاعدة البيانات هي التي تديرها.
    /// </summary>
    public IEnumerable<ColumnDefinition> WritableColumns =>
        Columns.Where(c => !c.IsReadOnly && !SqlIdentifier.SystemColumns.Contains(c.Name));

    /// <summary>
    /// قائمة SELECT صريحة — لا نستخدم SELECT * أبداً
    /// (يسمح باستخدام Covering Index ويمنع جلب أعمدة ضخمة بلا داعٍ).
    /// </summary>
    public string BuildSelectList() =>
        string.Join(", ", Columns.Select(c => SqlIdentifier.Quote(c.Name)));

    /// <summary>
    /// يبني جُمل SET المُعاملة (parameterized) للتحديث من جسم الطلب،
    /// ويقبل فقط الأعمدة المعروفة في الـ Metadata (Allow-list صارم).
    /// </summary>
    public (string Sql, DynamicParameters Parameters) BuildUpdateAssignments(JsonElement payload)
    {
        var parameters = new DynamicParameters();
        var assignments = new List<string>();
        var index = 0;

        foreach (var column in WritableColumns)
        {
            if (!payload.TryGetProperty(column.Name, out var value))
                continue;

            var parameterName = $"@c{index++}";
            assignments.Add($"{SqlIdentifier.Quote(column.Name)} = {parameterName}");
            parameters.Add(parameterName[1..], ConvertValue(value, column.DataType));
        }

        if (assignments.Count == 0)
            throw new InvalidOperationException(
                $"لا يوجد أي حقل قابل للتعديل في الطلب للكيان [{Code}].");

        return (string.Join(", ", assignments), parameters);
    }

    private static object? ConvertValue(JsonElement value, string dataType) => value.ValueKind switch
    {
        JsonValueKind.Null or JsonValueKind.Undefined => null,
        JsonValueKind.String => dataType == "date" ? value.GetDateTime() : value.GetString(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Number => dataType == "number" ? value.GetDecimal() : (object)value.GetInt64(),
        _ => value.GetRawText()
    };
}
