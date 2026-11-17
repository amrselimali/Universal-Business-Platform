using System.Text.RegularExpressions;

namespace Ubp.Web.Services;

/// <summary>
/// تبسيط الشرح لمستخدم مبتدئ: ترجمة أكواد الصلاحيات والسجل إلى عربي واضح،
/// وإزالة أسماء الدوال/الخصائص/المسارات الإنجليزية من النص المكتوب على الصور.
/// </summary>
public static class ManualText
{
    private static readonly Dictionary<string, string> Glossary =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Default Deny"] = "المنع افتراضيًا",
            ["Default (Deny)"] = "المنع افتراضيًا",
            ["Super Admin"] = "المدير الأعلى",
            ["IsSuperAdmin"] = "المدير الأعلى",
            ["IsAdmin"] = "المدير",
            ["QA"] = "مركز الجودة",
            ["Excel"] = "ملف إكسل",
            ["audit_log"] = "سجل النظام",
            ["audit"] = "سجل النظام",
            ["Trace"] = "رقم التتبع",
            ["SQL"] = "قاعدة البيانات",
            ["AppRegistry"] = "تعريفات النظام",
            ["old/new data"] = "البيانات قبل وبعد",
            ["INSERT"] = "إضافة",
            ["UPDATE"] = "تعديل",
            ["DELETE"] = "حذف"
        };

    public static string Audit(string audit)
    {
        var value = (audit ?? "").Trim();
        if (value.Length == 0 || value == "لا شيء") return "لا يُسجَّل شيء";
        var key = value.ToUpperInvariant();
        return key switch
        {
            "INSERT" => "إضافة سجل جديد",
            "UPDATE" => "تعديل السجل",
            "DELETE" => "حذف السجل",
            "DELETE/UPDATE" => "حذف السجل أو تعطيله",
            "INSERT + قيود" => "إضافة سجل مع قيود محاسبية",
            "UPDATE + قيود" => "تعديل السجل مع قيود محاسبية",
            "INSERT + UPDATE" => "إضافة وتعديل سجلات",
            "BOOKINGS:INSERT" => "إضافة حجز",
            "BOOKINGS:UPDATE" => "تعديل حجز",
            "ASSET_METER_READINGS" => "تسجيل قراءة عدّاد",
            "PASSWORD_RESET" => "تغيير كلمة المرور",
            "PERMISSION_CHANGE" => "تغيير الصلاحيات",
            "MIGRATION" => "تحديث قاعدة البيانات",
            "EXPORT" => "تصدير ملف",
            _ when key.Contains("INSERT", StringComparison.Ordinal) => "إضافة سجل جديد",
            _ when key.Contains("UPDATE", StringComparison.Ordinal) => "تعديل السجل",
            _ when key.Contains("DELETE", StringComparison.Ordinal) => "حذف السجل",
            _ => "تسجيل العملية في سجل النظام"
        };
    }

    public static string Permission(string permission)
    {
        var value = (permission ?? "").Trim();
        if (value.Length == 0 || value == "—") return "بدون صلاحية محددة";
        var code = value.Split('/', '.').LastOrDefault() ?? value;
        return code.ToUpperInvariant() switch
        {
            "VIEW" => "عرض",
            "ADD" or "CREATE" => "إضافة",
            "EDIT" => "تعديل",
            "DELETE" => "حذف",
            "TOGGLE_ACTIVE" => "تفعيل أو تعطيل",
            "POST" => "ترحيل",
            "REVERSE" => "عكس",
            "RECEIVE" => "استلام",
            "PRINT" => "طباعة",
            "EXPORT" => "تصدير",
            "IMPORT" => "استيراد",
            "APPROVE" => "اعتماد",
            "CONFIRM" => "تأكيد",
            "CLOSE" => "إغلاق",
            "REOPEN" => "إعادة فتح",
            "MANAGE" => "إدارة",
            "RUN_TESTS" => "تشغيل الفحوص",
            "RESET_PASSWORD" => "إعادة تعيين كلمة المرور",
            "UNLOCK" => "فك القفل",
            _ => "صلاحية خاصة"
        };
    }

    public static string Simplify(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        var value = text.Replace("**", "").Replace("`", "");
        foreach (var pair in Glossary.OrderByDescending(pair => pair.Key.Length))
            value = value.Replace(pair.Key, pair.Value, StringComparison.OrdinalIgnoreCase);
        value = Regex.Replace(value, @"\b[A-Za-z][A-Za-z0-9_./:-]*\b", " ");
        value = Regex.Replace(value, @"\s{2,}", " ");
        value = value.Trim().Trim('،', ':', '·', '-', '—', '.');
        return value.Length == 0 ? "تفاصيل إضافية." : value;
    }
}
