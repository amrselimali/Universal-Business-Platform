using System.Text;
using Ubp.Core.Security;

namespace Ubp.Web.Services;

public sealed partial class UserManualGenerator
{
    private void AppendScreenSections(StringBuilder md, IReadOnlyList<ManualScreenDoc> screens,
        IReadOnlyList<ManualDialogDoc> dialogs, string language)
    {
        md.AppendLine("## 4. دليل الشاشات والأزرار — صفحة بصفحة");
        md.AppendLine();
        md.AppendLine("لكل صفحة **قسم مستقل**: ما يظهر عليها، ملاحظات على الظاهر، وكل زر مع الصلاحية " +
                      "وما يظهر عند الضغط والقيود وما يُسجَّل. الأزرار مستخرجة من ملفات `.razor` " +
                      "و`.razor.cs` الحالية، وما لا يوجد له مصدر يُعرض من أفعال `AppRegistry`.");
        md.AppendLine();

        md.AppendLine("### فهرس الشاشات");
        md.AppendLine();
        md.AppendLine("| # | الشاشة | المسار | الأزرار | الحقول |");
        md.AppendLine("|---:|---|---|---:|---:|");
        var index = 0;
        foreach (var screen in screens)
            md.AppendLine($"| {++index} | {screen.Title} | `{screen.Route}` | {screen.Buttons.Count} | " +
                          $"{screen.Fields.Count} |");
        md.AppendLine();

        foreach (var group in screens.GroupBy(s => (s.GroupKey, s.GroupTitle)))
        {
            md.AppendLine($"### {group.Key.GroupTitle}");
            md.AppendLine();
            if (GroupPurpose.TryGetValue(group.Key.GroupKey, out var purpose))
            {
                md.AppendLine(purpose);
                md.AppendLine();
            }
            foreach (var screen in group)
            {
                md.AppendLine($"#### `{screen.Route}` — {screen.Title}");
                md.AppendLine();
                md.AppendLine("**ما يظهر على الشاشة**");
                md.AppendLine();
                md.AppendLine(screen.Purpose.Length > 0 ? screen.Purpose : $"شاشة {screen.Title}.");
                md.AppendLine();
                if (screen.Columns.Count > 0)
                    md.AppendLine($"- **الأعمدة:** {JoinLimited(screen.Columns, 12)}.");
                if (screen.Fields.Count > 0)
                    md.AppendLine($"- **الحقول/الفلاتر:** {JoinLimited(screen.Fields, 15)}.");
                if (screen.Tabs.Count > 0)
                    md.AppendLine($"- **التبويبات:** {JoinLimited(screen.Tabs, 12)}.");
                if (screen.Columns.Count + screen.Fields.Count + screen.Tabs.Count == 0)
                    md.AppendLine("- لا حقول/أعمدة قابلة للاستخراج من المصدر؛ راجع الشاشة مباشرة.");
                md.AppendLine();

                md.AppendLine("**ملاحظات على الظاهر**");
                md.AppendLine();
                foreach (var note in screen.Notes) md.AppendLine($"- {note}");
                if (screen.Notes.Count == 0) md.AppendLine("- لا ملاحظات إضافية.");
                md.AppendLine();

                md.AppendLine("**الأزرار — ماذا يظهر عند الضغط، القيود، والسجل**");
                md.AppendLine();
                md.AppendLine("| الزر | الصلاحية | عند الضغط يظهر | ماذا يفعل | القيود | السجل | إلى أين |");
                md.AppendLine("|---|---|---|---|---|---|---|");
                foreach (var button in screen.Buttons)
                    md.AppendLine($"| {button.Label} | `{button.Permission}` | {button.Appears} | " +
                                  $"{button.Behavior} | {button.Limits} | {button.Audit} | {button.Destination} |");
                if (screen.Buttons.Count == 0)
                    md.AppendLine("| — | — | — | لا توجد أزرار تنفيذية. | — | — | — |");
                md.AppendLine();

                var related = dialogs.Where(dialog => screen.Buttons.Any(button =>
                    button.Appears.Contains($"**{dialog.Name}**", StringComparison.Ordinal))).ToList();
                if (related.Count > 0)
                {
                    md.AppendLine("**الحوارات التي تُفتح من هذه الشاشة**");
                    md.AppendLine();
                    foreach (var dialog in related)
                    {
                        var fields = dialog.Fields.Count > 0
                            ? $" — الحقول: {JoinLimited(dialog.Fields, 10)}"
                            : "";
                        md.AppendLine($"- **{dialog.Name}** ({dialog.Kind}): {dialog.Purpose}{fields}");
                    }
                    md.AppendLine();
                }

                md.AppendLine("**قيود الصفحة والصلاحيات**");
                md.AppendLine();
                foreach (var limit in screen.Limits) md.AppendLine($"- {limit}");
                if (screen.Limits.Count == 0) md.AppendLine("- لا قيود إضافية.");
                md.AppendLine();
                if (!screen.SourceAvailable)
                    md.AppendLine("> ملف المصدر غير متاح لهذه الشاشة في نسخة النشر؛ الأزرار معروضة من `AppRegistry`.");
                md.AppendLine("---");
                md.AppendLine();
            }
        }
    }

    private void AppendPermissionMatrix(StringBuilder md, IReadOnlyList<ManualScreenDoc> screens,
        string language)
    {
        md.AppendLine("## 7. مصفوفة الصلاحيات");
        md.AppendLine();
        md.AppendLine("| الشاشة | المسار | الأكواد المتاحة |");
        md.AppendLine("|---|---|---|");
        foreach (var screen in screens)
        {
            var definition = AppRegistry.ByCode.TryGetValue(screen.Code, out var found) ? found : null;
            var actions = string.Join(", ", screen.Actions.Select(action =>
                $"`{(definition is null ? $"{screen.Code}/{action}" : definition.PermissionKey(action))}`"));
            md.AppendLine($"| {screen.Title} | `{screen.Route}` | {actions} |");
        }
        md.AppendLine();
        md.AppendLine("> المدير `IsAdmin` يتجاوز كل هذه الأكواد؛ Super Admin يضيف إدارة أعلام المديرين وقاعدة البيانات.");
        md.AppendLine();
    }

}
