namespace Ubp.Web.Services;

/// <summary>
/// نص رسالة خطأ مع استبدال المعاملات المسمّاة <c>{key}</c> — للحوارات التي لا ترث SecurePageBase
/// (وإلا ظهرت الرسالة بالـ placeholders الخام مثل «{treasury}»).
/// </summary>
public static class ErrorText
{
    public static string Of(UiCulture t, Ubp.Core.Results.AppException ex)
    {
        var text = t.T(ex.Code);
        foreach (var arg in ex.Args)
            text = text.Replace("{" + arg.Key + "}", arg.Value);
        return text;
    }
}
