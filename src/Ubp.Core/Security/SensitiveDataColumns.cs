namespace Ubp.Core.Security;

/// <summary>
/// أعمدة لا يجوز عرضها أو تصديرها من شاشة إدارة قاعدة البيانات: كلمات المرور المشفرة،
/// رموز الجلسات/التحديث، والأسرار (مفاتيح API ومفاتيح واتساب). المقارنة بلا حساسية لحالة الأحرف.
/// </summary>
public static class SensitiveDataColumns
{
    private static readonly HashSet<string> Exact = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password_hash", "token_hash", "access_token", "refresh_token",
        "app_secret", "secret", "api_key", "client_secret", "private_key"
    };

    public static bool IsSensitive(string columnName)
    {
        if (string.IsNullOrWhiteSpace(columnName)) return false;
        var name = columnName.Trim();
        if (Exact.Contains(name)) return true;
        return name.Contains("password_hash", StringComparison.OrdinalIgnoreCase)
               || name.Contains("token_hash", StringComparison.OrdinalIgnoreCase)
               || name.Contains("api_key", StringComparison.OrdinalIgnoreCase)
               || name.Contains("session_token", StringComparison.OrdinalIgnoreCase)
               || name.EndsWith("_secret", StringComparison.OrdinalIgnoreCase)
               || name.StartsWith("secret_", StringComparison.OrdinalIgnoreCase);
    }
}
