using System.Text;
using System.Text.RegularExpressions;
using Ubp.Core.Security;

namespace Ubp.Web.Services;

public sealed partial class UserManualGenerator
{
    private static string AppearsFor(string text, string onClick, string href,
        HandlerEffects? effects = null)
    {
        if (!string.IsNullOrWhiteSpace(href))
            return href.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? $"يفتح/ينزّل الرابط `{href}`."
                : $"ينتقل إلى `{href}`.";

        var handler = onClick.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(onClick)) return "—";
        if (handler.Contains("print")) return "نافذة الطباعة.";
        if (handler.Contains("export")) return "تنزيل ملف.";
        if (handler.Contains("reload") || handler.Contains("refresh") || handler.Contains("load") ||
            handler.Contains("search")) return "تحديث/فلترة الجدول في نفس الصفحة.";

        effects ??= AnalyzeHandler(text, onClick);
        if (effects.Dialogs.Count > 0)
        {
            var dialogs = string.Join("، ", effects.Dialogs.Select(name => $"**{name}**"));
            return $"يفتح حوار {dialogs}.";
        }
        if (effects.Confirm) return "نافذة تأكيد (نعم/إلغاء) ثم تنفيذ العملية.";
        if (effects.Navigate.Length > 0) return $"ينتقل إلى `{effects.Navigate}`.";
        if (effects.Services.Count > 0)
        {
            var mutation = effects.Services.FirstOrDefault(service =>
                service.Contains("Create", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Update", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Delete", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Save", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Post", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Reverse", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Set", StringComparison.OrdinalIgnoreCase) ||
                service.Contains("Confirm", StringComparison.OrdinalIgnoreCase)) ?? effects.Services[0];
            return $"لا يفتح حوارًا؛ ينفّذ `{mutation}` ويعرض رسالة نجاح/خطأ.";
        }
        if (handler == "cancel" || handler.Contains("mudialog.cancel") ||
            handler == "close" || handler.Contains("mudialog.close"))
            return "يغلق الحوار.";
        return "يبقى في الصفحة (تحديث/رسالة).";
    }

    private static string LimitsFor(string actionCode, string onClick, string label, string tag)
    {
        var limits = new List<string>();
        if (!string.IsNullOrWhiteSpace(actionCode) && Guide.TryGetValue(actionCode, out var guide))
            limits.Add(guide.Limits);
        else
        {
            var inferred = InferLimits(onClick, label);
            if (inferred.Length > 0) limits.Add(inferred);
        }

        var disabled = DisabledRegex.Match(tag);
        if (disabled.Success)
        {
            var condition = CleanCondition(disabled.Groups[1].Value);
            if (condition.Length > 0) limits.Add($"يُعطَّل عندما: {condition}");
        }
        return limits.Count == 0 ? "لا قيود إضافية ظاهرة." : string.Join(" · ", limits);
    }

    private static string InferLimits(string onClick, string label)
    {
        var handler = onClick.ToLowerInvariant();
        if (handler.Contains("delete")) return "السجل المستخدم يتحول إلى تعطيل؛ يلزم تأكيد.";
        if (handler.Contains("toggle")) return "قد يُمنع تعطيل آخر سجل نشط أو آخر مدير عام.";
        if (handler.Contains("post")) return "مسودة فقط، فترة مفتوحة، توازن/كميات كافية.";
        if (handler.Contains("reverse")) return "المرحّل فقط وفترة مفتوحة؛ لا يحذف الأصل.";
        if (handler.Contains("save")) return "حقول إلزامية وكشف تعارض النسخة.";
        if (handler.Contains("confirm")) return "حسب حالة السجل وصلاحيتك.";
        if (handler.Contains("print") || handler.Contains("export")) return "قراءة فقط.";
        if (label.Contains("إضافة") || label.Contains("تعديل")) return "حقول إلزامية وتحقق من التكرار.";
        return "";
    }

    private static string CleanCondition(string value)
    {
        var text = value.Trim();
        if (text.StartsWith("@(", StringComparison.Ordinal) && text.EndsWith(")", StringComparison.Ordinal))
            text = text[2..^1].Trim();
        text = text.TrimStart('!');
        var can = Regex.Match(text, @"Can\(ActionCodes\.(\w+)\)");
        if (can.Success) return $"لا تملك صلاحية `{ResolveAction(can.Groups[1].Value)}`";
        if (text.Length == 0 || text == "false") return "";
        return $"`{text}`";
    }

    private static string AuditFor(string actionCode, string onClick)
    {
        if (!string.IsNullOrWhiteSpace(actionCode) && Guide.TryGetValue(actionCode, out var guide))
            return guide.Audit;
        var handler = onClick.ToLowerInvariant();
        if (handler.Contains("delete")) return "DELETE/UPDATE";
        if (handler.Contains("toggle")) return "UPDATE";
        if (handler.Contains("post")) return "UPDATE + قيود";
        if (handler.Contains("reverse")) return "INSERT + UPDATE";
        if (handler.Contains("save") || handler.Contains("add") || handler.Contains("edit") ||
            handler.Contains("create")) return "INSERT/UPDATE";
        return "لا شيء";
    }

    private sealed record HandlerEffects(
        IReadOnlyList<string> Dialogs,
        bool Confirm,
        string Navigate,
        IReadOnlyList<string> Services);

    private static HandlerEffects AnalyzeHandler(string text, string onClick)
    {
        var dialogs = new List<string>();
        var services = new List<string>();
        var confirm = false;
        var navigate = "";
        var bodies = new List<string>();
        foreach (var method in HandlerMethods(onClick))
        {
            var body = ExtractMethodBody(text, method);
            if (body.Length > 0) bodies.Add(body);
        }
        if (bodies.Count == 0) bodies.Add(onClick);
        foreach (var body in bodies)
        {
            foreach (Match match in DialogShowRegex.Matches(body))
            {
                var name = match.Groups[1].Value.Split('.').Last();
                if (!dialogs.Contains(name)) dialogs.Add(name);
            }
            if (body.Contains("ShowMessageBoxAsync", StringComparison.Ordinal)) confirm = true;
            var nav = NavigationRegex.Match(body);
            if (nav.Success && navigate.Length == 0) navigate = nav.Groups[1].Value;
            foreach (Match match in ServiceCallRegex.Matches(body))
            {
                var receiver = match.Groups[1].Value;
                var calledMethod = match.Groups[2].Value;
                if (!calledMethod.EndsWith("Async", StringComparison.Ordinal)) continue;
                if (receiver is "T" or "DialogService" or "MudDialog" or "Snackbar" or
                    "Navigation" or "NavigationManager" or "Console" or "Task" or "String" or
                    "Regex" or "Path" or "File" or "Enumerable" or "Convert" or "Guid" or "Math" or
                    "UserContext" or "UiCulture")
                    continue;
                var service = $"{receiver}.{calledMethod}";
                if (!services.Contains(service)) services.Add(service);
            }
        }
        return new HandlerEffects(dialogs, confirm, navigate, services);
    }

    private static IEnumerable<string> HandlerMethods(string onClick)
    {
        if (string.IsNullOrWhiteSpace(onClick)) yield break;
        var cleaned = onClick.Replace("@", " ");
        var found = false;
        foreach (Match match in Regex.Matches(cleaned, @"([A-Za-z_]\w*)\s*\("))
        {
            var name = match.Groups[1].Value;
            if (name is "async" or "await" or "new" or "Task" or "T" or "Can" or
                "true" or "false" or "null") continue;
            found = true;
            yield return name;
        }
        var inline = cleaned.Trim();
        if (!found && Regex.IsMatch(inline, @"^[A-Za-z_]\w*$")) yield return inline;
    }

    private static string ExtractMethodBody(string text, string methodName)
    {
        foreach (Match match in MethodDeclarationRegex.Matches(text))
        {
            if (!string.Equals(match.Groups[1].Value, methodName, StringComparison.Ordinal)) continue;
            var paren = text.IndexOf('(', match.Index + match.Length - 1);
            if (paren < 0) continue;
            var depth = 0;
            var i = paren;
            for (; i < text.Length; i++)
            {
                if (text[i] == '(') depth++;
                else if (text[i] == ')')
                {
                    depth--;
                    if (depth == 0) { i++; break; }
                }
            }
            if (i >= text.Length) continue;
            var brace = text.IndexOf('{', i);
            if (brace < 0 || brace - i > 600) continue;
            return SliceBlock(text, brace);
        }
        return "";
    }

    private static string SliceBlock(string text, int start)
    {
        var depth = 0;
        var quote = '\0';
        var escaped = false;
        for (var i = start; i < text.Length; i++)
        {
            var c = text[i];
            if (quote != '\0')
            {
                if (escaped) { escaped = false; continue; }
                if (c == '\\' && quote == '"') { escaped = true; continue; }
                if (c == quote) quote = '\0';
                continue;
            }
            if (c is '"' or '\'') { quote = c; continue; }
            if (c == '{') depth++;
            else if (c == '}')
            {
                depth--;
                if (depth == 0) return text[start..(i + 1)];
            }
        }
        return "";
    }

}
