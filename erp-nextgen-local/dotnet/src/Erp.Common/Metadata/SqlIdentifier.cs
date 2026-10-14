using System.Text.RegularExpressions;

namespace Erp.Common.Metadata;

/// <summary>
/// حماية أسماء المعرّفات (Identifiers) المستخدمة في SQL الديناميكي.
/// هذا هو خط الدفاع الأساسي ضد SQL Injection في الـ Generic Data API،
/// لأن أسماء الجداول والأعمدة لا يمكن تمريرها كـ Parameters عادية.
/// </summary>
public static partial class SqlIdentifier
{
    [GeneratedRegex(@"^[A-Za-z_][A-Za-z0-9_]{0,62}$")]
    private static partial Regex ValidIdentifier();

    /// <summary>أعمدة يديرها النظام ولا يُسمح للعميل بكتابتها.</summary>
    public static readonly HashSet<string> SystemColumns = new(StringComparer.OrdinalIgnoreCase)
    {
        "id", "tenant_id", "version",
        "created_at", "created_by", "updated_at", "updated_by", "deleted_at"
    };

    /// <summary>
    /// يقتبس المعرّف بأمان بعد التحقق من صيغته.
    /// يرفض أي اسم يحتوي على مسافة أو فاصلة أو شرطة أو علامة اقتباس.
    /// </summary>
    public static string Quote(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier) || !ValidIdentifier().IsMatch(identifier))
        {
            throw new ArgumentException(
                $"معرّف SQL غير صالح: '{identifier}'. يُسمح فقط بالحروف والأرقام والشرطة السفلية.",
                nameof(identifier));
        }

        return $"\"{identifier}\"";
    }

    /// <summary>يقتبس مسار جدول بصيغة schema.table بأمان.</summary>
    public static string QuoteQualified(string schema, string table)
        => $"{Quote(schema)}.{Quote(table)}";
}
