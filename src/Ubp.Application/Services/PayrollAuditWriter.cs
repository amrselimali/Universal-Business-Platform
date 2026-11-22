using Ubp.Core.Security;

namespace Ubp.Application.Services;

/// <summary>
/// كاتب تدقيق المرتبات: جدول audit_log يقيد عمود action بقيم محددة
/// (INSERT/UPDATE/DELETE/...)، لذلك تُحوَّل أفعال المرتبات (CALCULATE/APPROVE/POST/PAY)
/// إلى القيمة المسموحة مع حفظ الفعل الأصلي داخل new_data حتى لا يُفقد أي أثر.
/// </summary>
public sealed class PayrollAuditWriter
{
    private const string TablePrefix = "payroll";
    private readonly AuditService _audit;

    public PayrollAuditWriter(AuditService audit) => _audit = audit;

    public Task WriteAsync(ActorContext actor, string tableName, string recordId, string action,
        object? oldData, object? newData, CancellationToken ct = default) =>
        _audit.WriteAsync(actor, EnsurePrefix(tableName), recordId, MapAction(action),
            oldData, WithOriginalAction(action, newData), ct);

    public static string MapAction(string action) => action.ToUpperInvariant() switch
    {
        "DELETE" => "DELETE",
        "INSERT" or "CREATE" or "CALCULATE" or "IMPORT" or "SIMULATE" => "INSERT",
        _ => "UPDATE"
    };

    private static string EnsurePrefix(string tableName) =>
        tableName.StartsWith(TablePrefix, StringComparison.OrdinalIgnoreCase)
            ? tableName
            : $"payroll_{tableName}";

    private static object? WithOriginalAction(string action, object? newData)
    {
        var payload = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["audit_action"] = action.ToUpperInvariant()
        };
        if (newData is not null)
        {
            foreach (var property in newData.GetType().GetProperties())
                payload[property.Name] = property.GetValue(newData);
        }
        return payload;
    }
}
