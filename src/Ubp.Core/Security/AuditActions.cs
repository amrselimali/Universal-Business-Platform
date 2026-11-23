namespace Ubp.Core.Security;

/// <summary>
/// قيم عمود audit_log.action المقبولة بقيد قاعدة البيانات (0095).
/// أي فعل آخر يُترجَم قبل الكتابة حتى لا يحدث 23514 audit_log_action_check.
/// </summary>
public static class AuditActions
{
    public const string Insert = "INSERT";
    public const string Update = "UPDATE";
    public const string Delete = "DELETE";
    public const string Login = "LOGIN";
    public const string Logout = "LOGOUT";
    public const string LoginFailed = "LOGIN_FAILED";
    public const string PermissionChange = "PERMISSION_CHANGE";
    public const string PasswordReset = "PASSWORD_RESET";
    public const string Migration = "MIGRATION";
    public const string Export = "EXPORT";

    public static IReadOnlySet<string> Allowed { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        Insert, Update, Delete, Login, Logout, LoginFailed, PermissionChange,
        PasswordReset, Migration, Export
    };

    /// <summary>يرجّع القيمة كما هي إن كانت مقبولة، وإلا يترجمها إلى أقرب قيمة مسموحة.</summary>
    public static string Normalize(string? action)
    {
        var value = (action ?? "").Trim().ToUpperInvariant();
        if (Allowed.Contains(value)) return value;
        return value switch
        {
            "" => Update,
            "DELETE" or "CANCEL" or "REVERSE" => Delete,
            "CREATE" or "REGISTER" or "REGISTER_BASIC" or "CALCULATE" or "IMPORT"
                or "SIMULATE" or "ACCRUE" or "COPY" or "TEMPLATE_APPLY" => Insert,
            _ => Update
        };
    }
}
