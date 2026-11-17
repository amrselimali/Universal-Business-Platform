using System.Net;
using System.Text;

namespace Ubp.Web.Services;

/// <summary>
/// صورة SVG توضيحية للحوارات التي تُفتح من الأزرار: شكل الحوار وحقوله وأزراره
/// مع شرح مرقّم مكتوب على الصورة. تُستبدل بلقطة حقيقية عند الضغط على «التقاط لقطة الحوار».
/// </summary>
public static class ManualDialogIllustration
{
    private const int Width = 1000;

    public static string Render(ManualDialogDoc dialog)
    {
        var annotations = ManualDialogAnnotations.Build(dialog).Take(8).ToList();
        var height = Math.Max(560, 210 + Math.Min(dialog.Fields.Count, 6) * 44 + 100);
        var sb = new StringBuilder(10 * 1024);
        sb.Append($"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {Width} {height}\" " +
                  $"role=\"img\" aria-label=\"{Esc(Display(dialog))}\" " +
                  "style=\"width:100%;max-width:900px;margin-inline:auto;height:auto;display:block;" +
                  "background:#F3F6F8;font-family:Cairo,Segoe UI,sans-serif\">");
        sb.Append($"<rect width=\"{Width}\" height=\"{height}\" fill=\"#F3F6F8\"/>");
        sb.Append("<rect width=\"").Append(Width).Append("\" height=\"74\" fill=\"#0F766E\"/>");
        Txt(sb, Width - 22, 30, $"حوار: {Display(dialog)}", 22, "#FFFFFF", "bold", "end");
        Txt(sb, Width - 22, 54, dialog.Kind, 13, "#CCFBF1", null, "end");
        Txt(sb, 22, 38, "حوار يُفتح من أزرار الشاشة", 14, "#FFFFFF", "bold", "start");
        Txt(sb, 22, 58, "الشرح مرقّم على الصورة", 12, "#CCFBF1", null, "start");

        var points = AppendDialog(sb, dialog, 24, 94, 620, height - 118);
        AppendMarkers(sb, dialog, annotations, points);
        AppendLegend(sb, annotations, 664, 94, 312, height - 118);
        sb.Append("</svg>");
        return sb.ToString();
    }

    private static Dictionary<string, (int X, int Y)> AppendDialog(StringBuilder sb,
        ManualDialogDoc dialog, int x, int y, int w, int h)
    {
        sb.Append($"<rect x=\"{x}\" y=\"{y}\" width=\"{w}\" height=\"{h}\" rx=\"14\" fill=\"#FFFFFF\" " +
                  "stroke=\"#E2E8F0\"/>");
        var right = x + w - 20;
        var points = new Dictionary<string, (int X, int Y)>(StringComparer.OrdinalIgnoreCase)
        {
            ["@title"] = (right - 10, y + 8),
            ["@usage"] = (right - 42, y + 8)
        };
        Txt(sb, right, y + 34, Display(dialog), 18, "#0F172A", "bold", "end");
        Txt(sb, right, y + 60, Trim(dialog.Purpose, 95), 12, "#64748B", null, "end");

        var rowY = y + 92;
        var tabX = right;
        foreach (var tab in dialog.Tabs.Take(2))
        {
            var width = Math.Clamp(tab.Length * 7 + 28, 70, 130);
            tabX -= width;
            sb.Append($"<rect x=\"{tabX}\" y=\"{rowY}\" width=\"{width}\" height=\"26\" rx=\"13\" " +
                      "fill=\"#ECFDF5\" stroke=\"#99F6E4\"/>");
            Txt(sb, tabX + width - 10, rowY + 18, Trim(tab, 16), 11, "#0F766E", "bold", "end");
            points["tab:" + tab] = (tabX + width / 2, rowY - 14);
            tabX -= 8;
        }
        rowY += dialog.Tabs.Count > 0 ? 42 : 12;

        foreach (var field in dialog.Fields.Take(6))
        {
            Txt(sb, right, rowY + 20, Trim(field, 30), 12, "#334155", "bold", "end");
            sb.Append($"<rect x=\"{x + 20}\" y=\"{rowY + 4}\" width=\"{w - 200}\" height=\"30\" " +
                      "rx=\"8\" fill=\"#F8FAFC\" stroke=\"#CBD5E1\"/>");
            sb.Append($"<rect x=\"{x + 40}\" y=\"{rowY + 15}\" width=\"{Math.Min(130, w - 300)}\" " +
                      "height=\"8\" rx=\"4\" fill=\"#E2E8F0\"/>");
            points["field:" + field] = (x + 32, rowY - 8);
            rowY += 44;
        }

        var buttonsY = Math.Min(y + h - 44, rowY + 18);
        Txt(sb, right, buttonsY + 16, "أزرار الحوار:", 12, "#475569", "bold", "end");
        var buttonX = right - 90;
        foreach (var button in dialog.Buttons.Take(4))
        {
            var width = Math.Clamp(button.Label.Length * 7 + 30, 70, 130);
            buttonX -= width;
            sb.Append($"<rect x=\"{buttonX}\" y=\"{buttonsY}\" width=\"{width}\" height=\"28\" " +
                      "rx=\"8\" fill=\"#0F766E\"/>");
            Txt(sb, buttonX + width - 10, buttonsY + 19, Trim(button.Label, 16), 11,
                "#FFFFFF", "bold", "end");
            points["button:" + button.Label] = (buttonX + width / 2, buttonsY - 18);
            buttonX -= 7;
        }
        return points;
    }

    private static void AppendMarkers(StringBuilder sb, ManualDialogDoc dialog,
        IReadOnlyList<ManualAnnotation> annotations,
        IReadOnlyDictionary<string, (int X, int Y)> points)
    {
        var titleUsed = false;
        for (var i = 0; i < annotations.Count; i++)
        {
            var target = annotations[i].Target;
            (int X, int Y) position;
            if (string.Equals(target, dialog.DisplayName, StringComparison.Ordinal) ||
                string.Equals(target, dialog.Name, StringComparison.Ordinal))
            {
                position = titleUsed ? points["@usage"] : points["@title"];
                titleUsed = true;
            }
            else if (!points.TryGetValue("field:" + target, out position) &&
                     !points.TryGetValue("tab:" + target, out position) &&
                     !points.TryGetValue("button:" + target, out position))
                continue;
            Circle(sb, position.X, position.Y, i + 1);
        }
    }

    private static void AppendLegend(StringBuilder sb,
        IReadOnlyList<ManualAnnotation> annotations, int x, int y, int w, int h)
    {
        sb.Append($"<rect x=\"{x}\" y=\"{y}\" width=\"{w}\" height=\"{h}\" rx=\"14\" fill=\"#FFFFFF\" " +
                  "stroke=\"#E2E8F0\"/>");
        Txt(sb, x + w - 16, y + 28, "الاستخدام والشرح", 15, "#0F766E", "bold", "end");
        var cy = y + 54;
        for (var i = 0; i < annotations.Count; i++)
        {
            Circle(sb, x + w - 24, cy + 8, i + 1);
            var lines = Wrap(annotations[i].Text, 38, 3);
            for (var line = 0; line < lines.Count; line++)
                Txt(sb, x + w - 42, cy + 12 + line * 16, lines[line], 10, "#0F172A", null, "end");
            cy += 18 + lines.Count * 16;
            if (cy > y + h - 24) break;
        }
    }

    private static List<string> Wrap(string text, int lineLength, int maxLines)
    {
        var lines = new List<string>();
        var remaining = text.Trim();
        while (remaining.Length > 0 && lines.Count < maxLines)
        {
            if (remaining.Length <= lineLength)
            {
                lines.Add(remaining);
                break;
            }
            var cut = remaining.LastIndexOf(' ', Math.Min(lineLength, remaining.Length - 1));
            if (cut <= 10) cut = lineLength;
            lines.Add(remaining[..cut].Trim());
            remaining = remaining[cut..].Trim();
        }
        if (remaining.Length > 0 && lines.Count == maxLines)
            lines[^1] = lines[^1].TrimEnd('…') + "…";
        return lines;
    }

    private static void Circle(StringBuilder sb, int cx, int cy, int number)
    {
        sb.Append($"<circle cx=\"{cx}\" cy=\"{cy}\" r=\"12\" fill=\"#F59E0B\" " +
                  "stroke=\"#FFFFFF\" stroke-width=\"2\"/>");
        Txt(sb, cx, cy + 4, number.ToString(), 11, "#FFFFFF", "bold", "middle");
    }

    private static void Txt(StringBuilder sb, int x, int y, string text, int size, string color,
        string? weight, string anchor)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        var actualAnchor = anchor switch { "start" => "end", "end" => "start", _ => "middle" };
        sb.Append($"<text x=\"{x}\" y=\"{y}\" font-size=\"{size}\" fill=\"{color}\" " +
                  $"text-anchor=\"{actualAnchor}\" direction=\"rtl\"");
        if (!string.IsNullOrWhiteSpace(weight)) sb.Append(" font-weight=\"").Append(weight).Append('"');
        sb.Append('>').Append(Esc(text)).Append("</text>");
    }

    private static string Trim(string text, int max) =>
        text.Length <= max ? text : text[..max].TrimEnd() + "…";

    private static string Display(ManualDialogDoc dialog) =>
        string.IsNullOrWhiteSpace(dialog.DisplayName) ? dialog.Name : dialog.DisplayName;

    private static string Esc(string text) => WebUtility.HtmlEncode(text);
}
