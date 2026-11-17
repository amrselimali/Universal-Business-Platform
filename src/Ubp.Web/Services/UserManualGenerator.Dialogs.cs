using System.Text;

namespace Ubp.Web.Services;

public sealed partial class UserManualGenerator
{
    private List<ManualDialogDoc> BuildDialogs(ManualSourceSet source, string language)
    {
        var dialogs = new List<ManualDialogDoc>();
        foreach (var file in source.Pages)
        {
            if (PageRouteRegex.IsMatch(file.Text)) continue;
            var buttons = ParseButtons(file.Text, language, null);
            var fields = FindFields(file.Text, language);
            if (buttons.Count == 0 && fields.Count == 0) continue;
            var name = Path.GetFileNameWithoutExtension(file.RelativePath);
            var kind = file.Text.Contains("ShowMessageBoxAsync", StringComparison.Ordinal)
                ? "تأكيد"
                : file.Text.Contains("<MudDialog", StringComparison.Ordinal) ? "حوار نموذج" : "مكوّن";
            var title = FindDialogTitle(file.Text, language);
            var displayName = string.IsNullOrWhiteSpace(title) ? name : title;
            var purpose = string.IsNullOrWhiteSpace(title) ? $"حوار {name}." : $"حوار {title}.";
            dialogs.Add(new ManualDialogDoc(name, purpose, buttons)
            {
                Fields = fields,
                Tabs = FindTabs(file.Text, language),
                Kind = kind,
                DisplayName = displayName
            });
        }
        return dialogs;
    }

    private string FindDialogTitle(string text, string language)
    {
        var match = DialogTitleRegex.Match(text);
        if (!match.Success) return "";
        var value = ResolveText(match.Groups[1].Value, language);
        return value.Length > 60 ? "" : value;
    }

    private static void AppendDialogSections(StringBuilder md, IReadOnlyList<ManualDialogDoc> dialogs)
    {
        if (dialogs.Count == 0) return;
        md.AppendLine("### الحوارات");
        md.AppendLine();
        md.AppendLine("لكل حوار: نوعه، الحقول الظاهرة، أزراره، وما يظهر عند الضغط، والقيود، وما يُسجَّل. " +
                      "الصلاحية تُورَث من الشاشة الأم إن لم تظهر على الزر.");
        md.AppendLine();
        foreach (var dialog in dialogs)
        {
            var display = string.IsNullOrWhiteSpace(dialog.DisplayName) ? dialog.Name : dialog.DisplayName;
            md.AppendLine($"#### {display}");
            md.AppendLine();
            md.AppendLine($"**النوع:** {dialog.Kind} · {dialog.Purpose}");
            md.AppendLine();
            if (dialog.Fields.Count > 0)
                md.AppendLine($"**الحقول الظاهرة:** {JoinLimited(dialog.Fields, 15)}.");
            if (dialog.Tabs.Count > 0)
                md.AppendLine($"**التبويبات:** {JoinLimited(dialog.Tabs, 12)}.");
            if (dialog.Fields.Count + dialog.Tabs.Count > 0) md.AppendLine();
            md.AppendLine("| الزر | الصلاحية | عند الضغط يظهر | ماذا يفعل | القيود | السجل | إلى أين |");
            md.AppendLine("|---|---|---|---|---|---|---|");
            foreach (var button in dialog.Buttons)
                md.AppendLine($"| {button.Label} | `{button.Permission}` | {button.Appears} | " +
                              $"{button.Behavior} | {button.Limits} | {button.Audit} | {button.Destination} |");
            if (dialog.Buttons.Count == 0) md.AppendLine("| — | — | — | لا أزرار. | — | — | — |");
            md.AppendLine();
        }
    }
}
