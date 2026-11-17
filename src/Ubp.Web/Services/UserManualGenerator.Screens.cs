using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Ubp.Core.Security;

namespace Ubp.Web.Services;

public sealed partial class UserManualGenerator
{
    private sealed record RazorButton(string Label, string Permission, string Handler, string Href);

    private static readonly Regex PageRouteRegex = new("@page\\s+\"([^\"]+)\"", RegexOptions.Compiled);
    private static readonly Regex PurposeRegex = new(
        "Subtitle=\"@T\\.T\\(\"([^\"]+)\"\\)\"", RegexOptions.Compiled);
    private static readonly Regex ColumnRegex = new(@"<MudTh[^>]*>(.*?)</MudTh>",
        RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex PermissionRegex = new(@"Can\(ActionCodes\.(\w+)\)",
        RegexOptions.Compiled);
    private static readonly Regex DisabledRegex = new("Disabled\\s*=\\s*\"([^\"]*)\"",
        RegexOptions.Compiled);
    private static readonly Regex MethodDeclarationRegex = new(
        @"(?:async\s+)?(?:Task(?:<[^>]+>)?|void)\s+([A-Za-z_]\w*)\s*\(", RegexOptions.Compiled);
    private static readonly Regex DialogShowRegex = new(
        @"Show(?:Async)?\s*<\s*([A-Za-z_][\w\.]*)\s*>", RegexOptions.Compiled);
    private static readonly Regex NavigationRegex = new(
        "NavigateTo\\s*\\(\\s*\\$?\"([^\"]+)\"", RegexOptions.Compiled);
    private static readonly Regex ServiceCallRegex = new(
        @"([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*\(", RegexOptions.Compiled);
    private static readonly Regex DialogTitleRegex = new(
        @"<TitleContent>(.*?)</TitleContent>", RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly string[] FieldTags =
    [
        "MudTextField", "MudSelect", "MudAutocomplete", "MudDatePicker", "MudTimePicker",
        "MudNumericField", "MudCheckBox", "MudSwitch", "MudRadioGroup", "MudFileUpload",
        "MudColorPicker", "MudRating", "MudSlider", "MudMask", "MudRangeInput"
    ];

    private static readonly IReadOnlyDictionary<string, string> GroupPurpose =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [AppRegistry.GroupMain] = "لوحة التحكم والإشعارات: قراءة مؤشرات الأداء والاختصارات.",
            [AppRegistry.GroupDefinitions] = "التعريفات الأساسية: الفروع، المخازن، العملات، الضرائب، الفترات.",
            [AppRegistry.GroupSecurity] = "المستخدمون والأدوار وسجل الأنشطة.",
            [AppRegistry.GroupInventory] = "الأصناف والمخزون والمستندات والجرد.",
            [AppRegistry.GroupPartners] = "العملاء والموردون وتصنيفاتهم.",
            [AppRegistry.GroupAccounting] = "المحاسبة والخزينة والأصول والمشتريات.",
            [AppRegistry.GroupSales] = "الحجوزات والمواعيد والتنفيذ والفواتير وPOS.",
            [AppRegistry.GroupReports] = "التقارير القياسية والمحاسبية والمخزنية.",
            [AppRegistry.GroupSystem] = "التشغيل والصحة وقاعدة البيانات ودليل المستخدم."
        };

    private List<ManualScreenDoc> BuildScreens(ManualSourceSet source, string language)
    {
        var pageRoutes = new Dictionary<string, ManualSourceFile>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in source.Pages)
            foreach (Match match in PageRouteRegex.Matches(file.Text))
                pageRoutes[NormalizeRoute(match.Groups[1].Value)] = file;

        var screens = new List<ManualScreenDoc>();
        foreach (var screen in AppRegistry.Screens)
        {
            var file = FindSource(screen.Route, pageRoutes);
            var purpose = file is null ? "" : FindPurpose(file.Text, language);
            var columns = file is null ? [] : FindColumns(file.Text, language);
            var buttons = file is null ? [] : ParseButtons(file.Text, language, screen);
            if (buttons.Count == 0) buttons = FallbackButtons(screen, language);
            var fields = file is null ? [] : FindFields(file.Text, language);
            var tabs = file is null ? [] : FindTabs(file.Text, language);
            var notes = file is null ? [] : BuildNotes(file.Text, columns, fields, tabs, buttons);
            var limits = BuildScreenLimits(file?.Text ?? "", screen, buttons);

            screens.Add(new ManualScreenDoc(screen.Code, screen.Route,
                _translator.Get(language, screen.TitleKey),
                screen.GroupKey, _translator.Get(language, screen.GroupKey),
                purpose, columns, buttons,
                screen.Actions.Select(a => a.Code).ToList(), file is not null)
            {
                Fields = fields,
                Tabs = tabs,
                Notes = notes,
                Limits = limits
            });
        }
        return screens;
    }

    private static string NormalizeRoute(string route) =>
        Regex.Replace(route.Trim().ToLowerInvariant(), @"\{[^}]+\}", "{x}").TrimEnd('/');

    private static ManualSourceFile? FindSource(string route,
        IReadOnlyDictionary<string, ManualSourceFile> pages)
    {
        var normalized = NormalizeRoute(route);
        if (pages.TryGetValue(normalized, out var exact)) return exact;
        var prefix = normalized.Split('{')[0];
        return pages.FirstOrDefault(pair => pair.Key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)).Value;
    }

    private string FindPurpose(string text, string language)
    {
        var match = PurposeRegex.Match(text);
        return match.Success ? _translator.Get(language, match.Groups[1].Value) : "";
    }

    private List<string> FindColumns(string text, string language)
    {
        var columns = new List<string>();
        foreach (Match match in ColumnRegex.Matches(text))
        {
            var value = ResolveText(match.Groups[1].Value, language);
            if (!string.IsNullOrWhiteSpace(value) && !columns.Contains(value)) columns.Add(value);
            if (columns.Count >= 12) break;
        }
        return columns;
    }

    private string ResolveText(string text, string language)
    {
        var clean = Regex.Replace(text, "<[^>]+>", " ");
        clean = Regex.Replace(clean, @"\s+", " ").Trim();
        var match = Regex.Match(clean, "^@T\\.T\\(\\s*\"([^\"]+)\"\\s*\\)$");
        if (match.Success) return _translator.Get(language, match.Groups[1].Value);
        var keys = Regex.Matches(clean, "T\\.T\\(\\s*\"([^\"]+)\"\\s*\\)");
        if (keys.Count > 0)
        {
            var parts = keys.Select(key => _translator.Get(language, key.Groups[1].Value))
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Distinct(StringComparer.Ordinal)
                .ToList();
            if (parts.Count > 0) return string.Join(" / ", parts);
        }
        return clean;
    }

    private List<ManualButtonDoc> ParseButtons(string text, string language, ScreenDefinition? screen)
    {
        var lines = text.Replace("\r\n", "\n").Split('\n');
        var buttons = new List<ManualButtonDoc>();
        foreach (var tag in ExtractTags(text, "MudButton", "MudIconButton", "MudMenuItem"))
        {
            var attrs = ReadAttributes(tag.Tag);
            var label = ResolveText(tag.Inner, language);
            if (string.IsNullOrWhiteSpace(label) && attrs.TryGetValue("Label", out var labelAttr))
                label = ResolveText(labelAttr, language);
            if (string.IsNullOrWhiteSpace(label) && attrs.TryGetValue("title", out var titleAttr))
                label = ResolveText(titleAttr, language);
            if (string.IsNullOrWhiteSpace(label) && attrs.TryGetValue("Icon", out var icon))
                label = icon.Split('.').LastOrDefault() ?? "زر";
            if (string.IsNullOrWhiteSpace(label)) label = "زر";

            var actionCode = FindPermission(lines, tag.Line, tag.Tag);
            attrs.TryGetValue("OnClick", out var onClick);
            attrs.TryGetValue("Href", out var href);
            onClick ??= ""; href ??= "";
            if (string.IsNullOrWhiteSpace(actionCode) && screen is not null)
                actionCode = InferAction(onClick, label);
            var permission = string.IsNullOrWhiteSpace(actionCode)
                ? "—"
                : (screen is null ? actionCode : screen.PermissionKey(actionCode));
            var behavior = BehaviorFor(actionCode, onClick, href, label);
            var destination = DestinationFor(onClick, href);
            var effects = AnalyzeHandler(text, onClick);
            var appears = AppearsFor(text, onClick, href, effects);
            var limits = LimitsFor(actionCode, onClick, label, tag.Tag);
            var audit = AuditFor(actionCode, onClick);
            if (buttons.Any(b => b.Label == label && b.Permission == permission &&
                                 b.Handler == onClick && b.Destination == destination)) continue;
            buttons.Add(new ManualButtonDoc(label, permission, onClick, behavior, destination)
            {
                Appears = appears,
                Limits = limits,
                Audit = audit,
                DialogNames = effects.Dialogs
            });
            if (buttons.Count >= 40) break;
        }
        return buttons;
    }

    private static string InferAction(string onClick, string label)
    {
        var handler = onClick.ToLowerInvariant();
        if (handler.Contains("cancel") || handler.Contains("close") || handler.Contains("mudialog"))
            return "";
        if (handler.Contains("delete")) return ActionCodes.Delete;
        if (handler.Contains("toggle")) return ActionCodes.ToggleActive;
        if (handler.Contains("reverse")) return ActionCodes.Reverse;
        if (handler.Contains("receive")) return ActionCodes.Receive;
        if (handler.Contains("post")) return ActionCodes.Post;
        if (handler.Contains("confirm")) return ActionCodes.Confirm;
        if (handler.Contains("print")) return ActionCodes.Print;
        if (handler.Contains("export")) return ActionCodes.Export;
        if (handler.Contains("add") || handler.Contains("create") ||
            label.Contains("إضافة") || label.Contains("جديد")) return ActionCodes.Add;
        if (handler.Contains("edit") || handler.Contains("update") || label.Contains("تعديل"))
            return ActionCodes.Edit;
        if (handler.Contains("save")) return ActionCodes.Save;
        return "";
    }

    private static string FindPermission(IReadOnlyList<string> lines, int line, string tag)
    {
        var tagMatches = PermissionRegex.Matches(tag);
        if (tagMatches.Count > 0) return ResolveAction(tagMatches[^1].Groups[1].Value);

        var start = Math.Max(0, line - 15);
        for (var i = line - 2; i >= start; i--)
        {
            var text = lines[i];
            if (text.Contains("</MudButton>", StringComparison.Ordinal) ||
                text.Contains("</MudIconButton>", StringComparison.Ordinal) ||
                text.Contains("</MudMenuItem>", StringComparison.Ordinal)) break;
            var matches = PermissionRegex.Matches(text);
            if (matches.Count > 0) return ResolveAction(matches[^1].Groups[1].Value);
        }
        return "";
    }

    private static string ResolveAction(string name) =>
        typeof(ActionCodes).GetField(name, BindingFlags.Public | BindingFlags.Static)
            ?.GetValue(null) as string ?? name;

    private static string BehaviorFor(string actionCode, string onClick, string href, string label)
    {
        if (!string.IsNullOrWhiteSpace(href)) return $"ينتقل إلى `{href}`.";

        var handler = onClick.ToLowerInvariant();
        if (handler == "cancel" || handler.Contains("mudialog.cancel"))
            return "يغلق الحوار دون حفظ.";
        if (handler.Contains("cancelasync"))
            return "يلغي السجل بعد التأكيد.";
        if (handler == "close" || handler.Contains("mudialog.close"))
            return "يغلق الحوار.";
        if (handler.Contains("confirm"))
            return "ينفّذ العملية ويغلق الحوار.";
        if (handler.Contains("reload") || handler.Contains("refresh") || handler.Contains("load") ||
            handler.Contains("search")) return "يعيد تحميل/يفلتر البيانات.";
        if (handler.Contains("print")) return "يفتح نافذة الطباعة.";
        if (handler.Contains("export")) return "ينزّل ملفًا.";
        if (handler.Contains("addline") || handler.Contains("removeline") ||
            handler.Contains("addrow") || handler.Contains("remove")) return "يعدّل البنود في الذاكرة قبل الحفظ.";
        if (handler.Contains("save"))
            return "يحفظ النموذج بعد التحقق من الحقول.";
        if (handler.Contains("cancel"))
            return "يلغي السجل بعد التأكيد.";
        if (!string.IsNullOrWhiteSpace(actionCode) && Guide.TryGetValue(actionCode, out var guide))
            return guide.Does;
        if (handler.Contains("delete")) return "يحذف/يعطّل السجل بعد التأكيد.";
        if (handler.Contains("post")) return "يرحّل المستند/القيد.";
        if (handler.Contains("reverse")) return "يعكس الأثر.";
        return label.Contains("إضافة") || label.Contains("تعديل") ? "يفتح حوارًا ويحفظ بعد التحقق." : "ينفّذ إجراءً على الشاشة.";
    }
    private static string DestinationFor(string onClick, string href)
    {
        if (!string.IsNullOrWhiteSpace(href)) return href;
        var handler = onClick.ToLowerInvariant();
        if (handler.Contains("reload") || handler.Contains("refresh") || handler.Contains("load") ||
            handler.Contains("search")) return "يبقى في الصفحة";
        if (handler.Contains("print") || handler.Contains("export")) return "لا ينتقل";
        return "يبقى في الصفحة (حوار/تحديث)";
    }

    private List<ManualButtonDoc> FallbackButtons(ScreenDefinition screen, string language) =>
        screen.Actions.Select(action =>
        {
            var known = Guide.TryGetValue(action.Code, out var guide);
            return new ManualButtonDoc(
                ActionTitle(action.Code, language),
                screen.PermissionKey(action.Code), "",
                known ? guide.Does : "إجراء مسجل.",
                "حسب الشاشة")
            {
                Appears = "حسب الشاشة/الحوار المرتبط.",
                Limits = known ? guide.Limits : "راجع الخدمة/الشاشة.",
                Audit = known ? guide.Audit : "حسب الخدمة"
            };
        }).ToList();
}
