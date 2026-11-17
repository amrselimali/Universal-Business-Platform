using System.Text;
using System.Text.RegularExpressions;
using Ubp.Core.Security;

namespace Ubp.Web.Services;

public sealed partial class UserManualGenerator
{
    private List<string> FindFields(string text, string language)
    {
        var fields = new List<string>();
        foreach (var tag in ExtractTags(text, FieldTags))
        {
            var attrs = ReadAttributes(tag.Tag);
            var value = "";
            if (attrs.TryGetValue("Label", out var label)) value = ResolveText(label, language);
            if (string.IsNullOrWhiteSpace(value) && attrs.TryGetValue("Placeholder", out var placeholder))
                value = ResolveText(placeholder, language);
            if (string.IsNullOrWhiteSpace(value) && attrs.TryGetValue("Title", out var title))
                value = ResolveText(title, language);
            if (string.IsNullOrWhiteSpace(value) || value.StartsWith("@", StringComparison.Ordinal)) continue;
            if (!fields.Contains(value)) fields.Add(value);
            if (fields.Count >= 25) break;
        }
        return fields;
    }

    private List<string> FindTabs(string text, string language)
    {
        var tabs = new List<string>();
        foreach (var tag in ExtractTags(text, "MudTabPanel"))
        {
            var attrs = ReadAttributes(tag.Tag);
            if (!attrs.TryGetValue("Text", out var value)) continue;
            var resolved = ResolveText(value, language);
            if (string.IsNullOrWhiteSpace(resolved) || resolved.StartsWith("@", StringComparison.Ordinal) ||
                tabs.Contains(resolved)) continue;
            tabs.Add(resolved);
            if (tabs.Count >= 12) break;
        }
        return tabs;
    }

    private static List<string> BuildNotes(string text,
        IReadOnlyList<string> columns, IReadOnlyList<string> fields, IReadOnlyList<string> tabs,
        IReadOnlyList<ManualButtonDoc> buttons)
    {
        var notes = new List<string>();
        if (columns.Count > 0)
            notes.Add($"الجدول يعرض {columns.Count} أعمدة: {JoinLimited(columns, 8)}.");
        if (fields.Count > 0)
            notes.Add($"الحقول/الفلاتر الظاهرة: {JoinLimited(fields, 10)}.");
        if (tabs.Count > 0)
            notes.Add($"الشاشة مقسّمة إلى تبويبات: {JoinLimited(tabs, 8)}.");
        if (text.Contains("ServerData=", StringComparison.Ordinal))
            notes.Add("الجدول يُحمَّل من السيرفر مع بحث/فرز/ترقيم صفحات (25 صفًا افتراضيًا).");
        if (text.Contains("<MudSwitch", StringComparison.Ordinal))
            notes.Add("مفاتيح التفعيل/الفلترة تغيّر العرض أو حالة السجل فورًا حسب صلاحيتك.");
        if (text.Contains("<MudMenu", StringComparison.Ordinal))
            notes.Add("أزرار الصف مضغوطة في قائمة (⋮) داخل عمود الإجراءات.");
        if (buttons.Count == 0)
            notes.Add("شاشة عرض فقط: لا توجد أزرار تنفيذية ظاهرة.");
        else
            notes.Add("كل زر يظهر فقط عند امتلاك صلاحيته (المنع افتراضيًا).");
        var withoutPermission = buttons.Count(b => b.Permission == "—");
        if (withoutPermission > 0)
            notes.Add($"يوجد {withoutPermission} زر/أزرار بلا صلاحية محددة في الواجهة؛ راجع تعريفات النظام.");
        return notes;
    }

    private static List<string> BuildScreenLimits(string text, ScreenDefinition screen,
        IReadOnlyList<ManualButtonDoc> buttons)
    {
        var limits = new List<string>
        {
            "صلاحية العرض مطلوبة: بدونها لا تظهر الشاشة.",
            "البيانات مقصوصة على نطاق الصلاحية (`0` سجلاتي، `1` فروعي، `2` الكل) والفرع النشط."
        };

        var actions = screen.Actions.Select(a => a.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (actions.Contains(ActionCodes.Post) || actions.Contains(ActionCodes.Reverse))
            limits.Add("بعد الترحيل لا يُعدَّل المستند؛ التصحيح بعكس القيد/المستند فقط.");
        if (actions.Contains(ActionCodes.Delete))
            limits.Add("الحذف قد يتحول تلقائيًا إلى تعطيل إذا كان السجل مستخدمًا وله تاريخ.");
        if (actions.Contains(ActionCodes.ClosePeriod) || actions.Contains(ActionCodes.ReopenPeriod))
            limits.Add("الفترة المغلقة تمنع الترحيل/العكس داخلها.");
        if (text.Contains("ShowMessageBoxAsync", StringComparison.Ordinal))
            limits.Add("العمليات الحساسة (حذف/عكس/إغلاق) تطلب نافذة تأكيد قبل التنفيذ.");
        if (text.Contains("RowVersion", StringComparison.Ordinal) ||
            text.Contains("Concurrency", StringComparison.Ordinal))
            limits.Add("تعارض النسخة (تعديل متزامن) يمنع الحفظ ويطلب إعادة التحميل.");
        var disabled = buttons.Count(b => b.Limits.Contains("يُعطَّل عندما", StringComparison.Ordinal));
        if (disabled > 0)
            limits.Add($"يوجد {disabled} زر/أزرار تظهر معطّلة حسب حالة السجل أو الصلاحية.");

        if (screen.Actions.Count > 0)
            limits.Add($"عدد الصلاحيات المتاحة على الشاشة: {screen.Actions.Count}.");
        return limits;
    }

    private static string JoinLimited(IReadOnlyList<string> values, int max) =>
        values.Count <= max
            ? string.Join(" · ", values)
            : string.Join(" · ", values.Take(max)) + $" · … (+{values.Count - max})";

    private static Dictionary<string, string> ReadAttributes(string tag)
    {
        var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in Regex.Matches(tag, @"([A-Za-z_@][\w:-]*)\s*=\s*"""))
        {
            var name = match.Groups[1].Value;
            if (attributes.ContainsKey(name)) continue;
            attributes[name] = ReadQuotedValue(tag, match.Index + match.Length);
        }
        return attributes;
    }

    private static string ReadQuotedValue(string tag, int start)
    {
        var depth = 0;
        var innerQuote = false;
        var value = new StringBuilder();
        for (var i = start; i < tag.Length; i++)
        {
            var c = tag[i];
            if (c == '"')
            {
                if (depth > 0)
                {
                    innerQuote = !innerQuote;
                    value.Append(c);
                    continue;
                }
                break;
            }
            if (!innerQuote)
            {
                if (c == '(') depth++;
                else if (c == ')' && depth > 0) depth--;
            }
            value.Append(c);
        }
        return value.ToString();
    }

    private sealed record RazorTag(string Tag, string Inner, int Line);

    private static IEnumerable<RazorTag> ExtractTags(string text, params string[] names)
    {
        foreach (var name in names)
        {
            var search = "<" + name;
            var index = 0;
            while ((index = text.IndexOf(search, index, StringComparison.Ordinal)) >= 0)
            {
                var start = index;
                var i = index + search.Length;
                if (i < text.Length && !char.IsWhiteSpace(text[i]) && text[i] != '>' && text[i] != '/')
                {
                    index += search.Length;
                    continue;
                }
                var j = i;
                char? quote = null;
                while (j < text.Length)
                {
                    var c = text[j];
                    if (quote is not null) { if (c == quote) quote = null; }
                    else if (c is '"' or '\'') quote = c;
                    else if (c == '>') break;
                    j++;
                }
                if (j >= text.Length) break;
                var tag = text[start..(j + 1)];
                var close = text.IndexOf("</" + name + ">", j, StringComparison.Ordinal);
                var inner = close >= 0 ? text[(j + 1)..close] : "";
                var line = text[..start].Count(c => c == '\n') + 1;
                yield return new RazorTag(tag, inner, line);
                index = close >= 0 ? close + name.Length + 3 : j + 1;
            }
        }
    }
}
