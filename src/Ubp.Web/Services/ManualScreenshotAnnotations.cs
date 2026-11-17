namespace Ubp.Web.Services;

/// <summary>ملاحظة واحدة تُرسم على صورة الشاشة: عنصر الهدف + الشرح المكتوب.</summary>
public sealed record ManualAnnotation(string Target, string Text);

/// <summary>
/// يبني الشرح المكتوب على صورة كل شاشة من بيانات الدليل نفسها:
/// العنوان، الوصف، الحقول، الأعمدة، كل زر (ما يظهر/القيود/السجل)، وقيود الصفحة.
/// </summary>
public static class ManualScreenshotAnnotations
{
    public static IReadOnlyList<ManualAnnotation> Build(ManualScreenDoc screen)
    {
        var annotations = new List<ManualAnnotation>
        {
            new(screen.Title, $"عنوان الشاشة: {screen.Title}."),
            new(screen.Title, $"الوصف: {Trim(screen.Purpose.Length > 0 ? screen.Purpose : screen.Notes.FirstOrDefault() ?? "شاشة النظام", 220)}")
        };

        if (screen.Fields.Count > 0)
            annotations.Add(new(screen.Fields[0], $"الحقول والفلاتر الظاهرة: {Join(screen.Fields, 8)}."));
        if (screen.Columns.Count > 0)
            annotations.Add(new(screen.Columns[0], $"أعمدة الجدول: {Join(screen.Columns, 8)}."));
        if (screen.Tabs.Count > 0)
            annotations.Add(new(screen.Tabs[0], $"التبويبات: {Join(screen.Tabs, 8)}."));

        foreach (var button in screen.Buttons.Where(b => !string.IsNullOrWhiteSpace(b.Label)).Take(6))
            annotations.Add(new(button.Label,
                $"زر «{button.Label}» ({button.Permission}): عند الضغط {Trim(button.Appears, 140)} " +
                $"القيود: {Trim(button.Limits, 120)} السجل: {Trim(button.Audit, 60)}."));

        if (screen.Limits.Count > 0)
            annotations.Add(new("", $"قيود الصفحة: {Join(screen.Limits, 3)}."));
        if (screen.Notes.Count > 0)
            annotations.Add(new("", $"ملاحظات الظاهر: {Join(screen.Notes, 3)}."));

        return annotations.Take(12)
            .Select(annotation => annotation with { Text = Clean(annotation.Text) })
            .ToList();
    }

    private static string Clean(string text) => text.Replace("**", "").Replace("`", "");

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

    /// <summary>تجهيز الملاحظات لاستدعاء JavaScript بصيغة { target, text }.</summary>
    public static IReadOnlyList<object> ToJsPayload(IReadOnlyList<ManualAnnotation> annotations) =>
        annotations.Select(a => (object)new { target = a.Target, text = a.Text }).ToList();
}
