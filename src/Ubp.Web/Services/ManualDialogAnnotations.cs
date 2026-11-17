namespace Ubp.Web.Services;

/// <summary>
/// الشرح المكتوب على صورة الحوار: الغرض والاستخدام، الحقول، التبويبات،
/// وكل زر داخل الحوار وما يظهر/القيود/السجل.
/// </summary>
public static class ManualDialogAnnotations
{
    public static IReadOnlyList<ManualAnnotation> Build(ManualDialogDoc dialog)
    {
        var display = string.IsNullOrWhiteSpace(dialog.DisplayName)
            ? dialog.Name
            : dialog.DisplayName;
        var annotations = new List<ManualAnnotation>
        {
            new(display, $"حوار «{display}» — {dialog.Kind}."),
            new(display, $"الاستخدام: {Trim(dialog.Purpose, 220)}")
        };

        if (dialog.Fields.Count > 0)
            annotations.Add(new(dialog.Fields[0], $"حقول الحوار: {Join(dialog.Fields, 10)}."));
        if (dialog.Tabs.Count > 0)
            annotations.Add(new(dialog.Tabs[0], $"التبويبات: {Join(dialog.Tabs, 8)}."));

        foreach (var button in dialog.Buttons.Where(b => !string.IsNullOrWhiteSpace(b.Label)).Take(6))
            annotations.Add(new(button.Label,
                $"زر «{button.Label}»: {Trim(button.Appears, 150)} " +
                $"{Trim(button.Behavior, 120)} القيود: {Trim(button.Limits, 120)} " +
                $"السجل: {ManualText.Audit(button.Audit)}."));

        return annotations.Take(12)
            .Select(annotation => annotation with
            {
                Text = ManualText.Simplify(annotation.Text)
            })
            .ToList();
    }

    private static string Join(IReadOnlyList<string> values, int max)
    {
        var text = values.Count <= max
            ? string.Join(" · ", values)
            : string.Join(" · ", values.Take(max)) + $" · … (+{values.Count - max})";
        return Trim(text, 260);
    }

    private static string Trim(string text, int max)
    {
        var clean = text.Trim();
        return clean.Length <= max ? clean : clean[..max].TrimEnd() + "…";
    }
}
