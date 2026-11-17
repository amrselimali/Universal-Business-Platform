using System.Net;
using System.Text;

namespace Ubp.Web.Services;

/// <summary>
/// يرسم صورة SVG توضيحية لكل شاشة قبل التقاط لقطة حقيقية:
/// إطار الشاشة + الفلاتر + أعمدة الجدول + الأزرار + الشرح المرقّم على الصورة.
/// اللقطة الحقيقية (PNG) تستبدلها تلقائيًا بعد الضغط على «التقاط لقطة».
/// </summary>
public static class ManualScreenIllustration
{
    private const int Width = 1200;

    public static string Render(ManualScreenDoc screen)
    {
        var annotations = ManualScreenshotAnnotations.Build(screen).Take(9).ToList();
        var height = Math.Max(640, 190 + annotations.Count * 62);
        var sb = new StringBuilder(12 * 1024);
        sb.Append($"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {Width} {height}\" " +
                  $"role=\"img\" aria-label=\"{Esc(screen.Title)}\" " +
                  "style=\"width:100%;max-width:900px;margin-inline:auto;height:auto;display:block;background:#F3F6F8;font-family:Cairo,Segoe UI,sans-serif\">");
        var shadowId = "shadow-" + screen.Code;
        sb.Append($"<defs><filter id=\"{shadowId}\" x=\"-5%\" y=\"-5%\" width=\"110%\" height=\"110%\">" +
                  "<feDropShadow dx=\"0\" dy=\"3\" stdDeviation=\"6\" flood-color=\"#0F172A\" flood-opacity=\"0.10\"/>" +
                  "</filter></defs>");
        sb.Append($"<rect width=\"{Width}\" height=\"{height}\" fill=\"#F3F6F8\"/>");
        AppendHeader(sb, screen);
        var points = AppendMock(sb, screen, 390, 104, Width - 390 - 26, height - 130);
        AppendMarkers(sb, screen, annotations, points);
        AppendLegend(sb, annotations, 22, 104, 340, height - 130);
        sb.Append("</svg>");
        return sb.ToString();
    }

    private static void AppendHeader(StringBuilder sb, ManualScreenDoc screen)
    {
        sb.Append("<rect width=\"").Append(Width).Append("\" height=\"82\" fill=\"#0F766E\"/>");
        Txt(sb, Width - 24, 32, screen.Title, 24, "#FFFFFF", "bold", "end");
        Txt(sb, Width - 24, 62, screen.GroupTitle, 14, "#CCFBF1", null, "end");
        Txt(sb, 24, 40, "مخطط توضيحي — الشرح مكتوب على الصورة", 15, "#FFFFFF", "bold", "start");
        Txt(sb, 24, 62, "التقط لقطة حقيقية من الزر أعلى البطاقة", 12, "#CCFBF1", null, "start");
    }

    private static Dictionary<string, (int X, int Y)> AppendMock(StringBuilder sb,
        ManualScreenDoc screen, int x, int y, int w, int h)
    {
        var shadowId = "shadow-" + screen.Code;
        sb.Append($"<rect x=\"{x}\" y=\"{y}\" width=\"{w}\" height=\"{h}\" rx=\"14\" fill=\"#FFFFFF\" " +
                  $"stroke=\"#E2E8F0\" filter=\"url(#{shadowId})\"/>");
        var right = x + w - 22;
        var top = y + 22;
        var points = new Dictionary<string, (int X, int Y)>(StringComparer.OrdinalIgnoreCase)
        {
            ["@title"] = (right - 150, top + 8),
            ["@desc"] = (right - 300, top + 34)
        };
        Txt(sb, right, top, screen.Title, 18, "#0F172A", "bold", "end");
        Txt(sb, right, top + 24, Trim(screen.Purpose, 110), 12, "#64748B", null, "end");

        var toolbarY = top + 72;
        sb.Append($"<rect x=\"{x + 22}\" y=\"{toolbarY}\" width=\"{w - 44}\" height=\"44\" rx=\"10\" " +
                  "fill=\"#F8FAFC\" stroke=\"#E2E8F0\"/>");
        var chipX = right - 10;
        Txt(sb, x + 34, toolbarY + 28, "فلاتر/حقول:", 12, "#475569", "bold", "start");
        foreach (var field in screen.Fields.Take(3))
        {
            var width = Math.Clamp(field.Length * 7 + 34, 80, 190);
            chipX -= width;
            sb.Append($"<rect x=\"{chipX}\" y=\"{toolbarY + 8}\" width=\"{width}\" height=\"28\" rx=\"14\" " +
                      "fill=\"#FFFFFF\" stroke=\"#CBD5E1\"/>");
            Txt(sb, chipX + width - 12, toolbarY + 27, Trim(field, 22), 11, "#334155", null, "end");
            points["field:" + field] = (chipX + width / 2, toolbarY - 6);
            chipX -= 8;
            if (chipX < x + 150) break;
        }
        foreach (var tab in screen.Tabs.Take(2))
            points["tab:" + tab] = (x + 120, toolbarY - 6);

        var tableY = toolbarY + 62;
        var tableH = Math.Min(250, h - (tableY - y) - 100);
        sb.Append($"<rect x=\"{x + 22}\" y=\"{tableY}\" width=\"{w - 44}\" height=\"{tableH}\" rx=\"8\" " +
                  "fill=\"#FFFFFF\" stroke=\"#CBD5E1\"/>");
        sb.Append($"<rect x=\"{x + 22}\" y=\"{tableY}\" width=\"{w - 44}\" height=\"36\" rx=\"8\" fill=\"#ECFDF5\"/>");
        var columns = screen.Columns.Take(4).ToList();
        if (columns.Count == 0) columns.Add("البيانات");
        var colW = (w - 44) / Math.Max(columns.Count, 1);
        for (var i = 0; i < columns.Count; i++)
        {
            var cx = right - 12 - (i * colW);
            Txt(sb, cx, tableY + 23, Trim(columns[i], 20), 11, "#0F766E", "bold", "end");
            points["column:" + columns[i]] = (cx - 55, tableY - 4);
            if (i > 0)
                sb.Append($"<line x1=\"{right - (i * colW) + 6}\" y1=\"{tableY + 6}\" " +
                          $"x2=\"{right - (i * colW) + 6}\" y2=\"{tableY + tableH - 6}\" stroke=\"#E2E8F0\"/>");
        }
        var rows = Math.Max(2, (tableH - 36) / 38);
        for (var row = 0; row < rows; row++)
        {
            var ry = tableY + 36 + row * 38;
            sb.Append($"<line x1=\"{x + 22}\" y1=\"{ry}\" x2=\"{x + w - 22}\" y2=\"{ry}\" stroke=\"#F1F5F9\"/>");
            sb.Append($"<rect x=\"{right - 120}\" y=\"{ry + 10}\" width=\"96\" height=\"16\" rx=\"8\" fill=\"#F1F5F9\"/>");
        }

        var buttonsY = Math.Min(y + h - 54, tableY + tableH + 38);
        Txt(sb, right, buttonsY + 18, "الأزرار:", 12, "#475569", "bold", "end");
        var buttonX = right - 58;
        foreach (var button in screen.Buttons.Take(5))
        {
            var width = Math.Clamp(button.Label.Length * 7 + 34, 78, 150);
            buttonX -= width;
            sb.Append($"<rect x=\"{buttonX}\" y=\"{buttonsY}\" width=\"{width}\" height=\"28\" rx=\"8\" " +
                      "fill=\"#0F766E\"/>");
            Txt(sb, buttonX + width - 10, buttonsY + 19, Trim(button.Label, 18), 11, "#FFFFFF", "bold", "end");
            points["button:" + button.Label] = (buttonX + width / 2, buttonsY - 20);
            buttonX -= 7;
            if (buttonX < x + 120) break;
        }

        return points;
    }

    private static void AppendMarkers(StringBuilder sb, ManualScreenDoc screen,
        IReadOnlyList<ManualAnnotation> annotations,
        IReadOnlyDictionary<string, (int X, int Y)> points)
    {
        var titleUsed = false;
        for (var i = 0; i < annotations.Count; i++)
        {
            var target = annotations[i].Target;
            (int X, int Y) position;
            if (string.Equals(target, screen.Title, StringComparison.Ordinal))
            {
                position = titleUsed ? points["@desc"] : points["@title"];
                titleUsed = true;
            }
            else if (!points.TryGetValue("button:" + target, out position) &&
                     !points.TryGetValue("field:" + target, out position) &&
                     !points.TryGetValue("column:" + target, out position) &&
                     !points.TryGetValue("tab:" + target, out position))
                continue;
            Circle(sb, position.X, position.Y, i + 1);
        }
    }

    private static void AppendLegend(StringBuilder sb,
        IReadOnlyList<ManualAnnotation> annotations, int x, int y, int w, int h)
    {
        sb.Append($"<rect x=\"{x}\" y=\"{y}\" width=\"{w}\" height=\"{h}\" rx=\"14\" fill=\"#FFFFFF\" " +
                  "stroke=\"#E2E8F0\"/>");
        Txt(sb, x + w - 18, y + 30, "الشرح المكتوب على الصورة", 16, "#0F766E", "bold", "end");
        Txt(sb, x + w - 18, y + 52, "كل رقم يشير إلى الجزء الموضح", 11, "#64748B", null, "end");
        var cy = y + 78;
        for (var i = 0; i < annotations.Count; i++)
        {
            Circle(sb, x + w - 28, cy + 8, i + 1);
            var lines = Wrap(annotations[i].Text, 44, 3);
            for (var line = 0; line < lines.Count; line++)
                Txt(sb, x + w - 48, cy + 13 + line * 17, lines[line], 11, "#0F172A", null, "end");
            cy += 20 + lines.Count * 17;
            if (cy > y + h - 30) break;
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
        sb.Append($"<circle cx=\"{cx}\" cy=\"{cy}\" r=\"13\" fill=\"#F59E0B\" stroke=\"#FFFFFF\" stroke-width=\"2\"/>");
        Txt(sb, cx, cy + 4, number.ToString(), 12, "#FFFFFF", "bold", "middle");
    }

    private static void Txt(StringBuilder sb, int x, int y, string text, int size, string color,
        string? weight, string anchor)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        var actualAnchor = anchor switch
        {
            "start" => "end",
            "end" => "start",
            _ => "middle"
        };
        sb.Append($"<text x=\"{x}\" y=\"{y}\" font-size=\"{size}\" fill=\"{color}\" " +
                  $"text-anchor=\"{actualAnchor}\" direction=\"rtl\"");
        if (!string.IsNullOrWhiteSpace(weight)) sb.Append(" font-weight=\"").Append(weight).Append('"');
        sb.Append('>').Append(Esc(text)).Append("</text>");
    }

    private static void TxtCode(StringBuilder sb, int x, int y, string text, int size,
        string color, string anchor)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        sb.Append($"<text x=\"{x}\" y=\"{y}\" font-size=\"{size}\" fill=\"{color}\" " +
                  $"text-anchor=\"{anchor}\" direction=\"ltr\">")
            .Append(Esc(text)).Append("</text>");
    }

    private static string Trim(string text, int max) =>
        text.Length <= max ? text : text[..max].TrimEnd() + "…";

    private static string Esc(string text) => WebUtility.HtmlEncode(text);
}
