using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Ubp.Web.Services;
using Xunit;

namespace Ubp.Tests;

public sealed class UserManualScreenshotTests
{
    private sealed class FakeEnvironment(string root) : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Ubp.Tests";
        public string ContentRootPath { get; set; } = root;
        public string WebRootPath { get; set; } = root;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static ManualScreenDoc Screen() => new(
        "ITEMS", "/inventory/items", "الأصناف", "group.inventory", "المخزون",
        "الأصناف ووحداتها والباركود.",
        ["الكود", "الاسم", "التصنيف"],
        [
            new ManualButtonDoc("إضافة", "ITEMS/ADD", "AddAsync",
                "يفتح حوار إنشاء سجل جديد.", "يبقى في الصفحة")
            {
                Appears = "يفتح حوار **ItemDialog**.",
                Limits = "حقول إلزامية + تحقق من التكرار.",
                Audit = "INSERT"
            },
            new ManualButtonDoc("حذف", "ITEMS/DELETE", "DeleteAsync",
                "حذف نهائي إن لم يُستخدم.", "يبقى في الصفحة")
            {
                Appears = "نافذة تأكيد (نعم/إلغاء).",
                Limits = "إن كان مستخدمًا يتحول إلى تعطيل.",
                Audit = "DELETE/UPDATE"
            }
        ],
        ["VIEW", "ADD", "DELETE"], true)
    {
        Fields = ["بحث", "التصنيف"],
        Tabs = ["البيانات", "الوحدات"],
        Notes = ["الجدول يُحمَّل من السيرفر."],
        Limits = ["البيانات مقصوصة على نطاق الصلاحية."]
    };

    [Fact]
    public async Task Store_saves_reads_and_deletes_a_screenshot()
    {
        var root = Path.Combine(Path.GetTempPath(), "ubp-shots-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var store = new ManualScreenshotStore(new FakeEnvironment(root),
                NullLogger<ManualScreenshotStore>.Instance);
            var userId = Guid.NewGuid();
            var png = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3 };

            Assert.True(await store.SaveAsync(userId, "ITEMS", png));
            Assert.True(store.Exists(userId, "ITEMS"));
            Assert.NotNull(store.UrlFor(userId, "ITEMS"));
            Assert.Contains("/api/v1/manual/screenshots/ITEMS?v=", store.UrlFor(userId, "ITEMS"));
            Assert.Equal(png, await File.ReadAllBytesAsync(store.PathForRead(userId, "ITEMS")!));
            Assert.Null(store.PathForRead(Guid.NewGuid(), "ITEMS"));
            Assert.Null(store.UrlFor(Guid.NewGuid(), "ITEMS"));

            Assert.True(store.Delete(userId, "ITEMS"));
            Assert.False(store.Exists(userId, "ITEMS"));
            Assert.Null(store.UrlFor(userId, "ITEMS"));
        }
        finally
        {
            Directory.Delete(root, true);
        }
    }

    [Fact]
    public async Task Store_rejects_invalid_codes_and_tiny_payloads()
    {
        var root = Path.Combine(Path.GetTempPath(), "ubp-shots-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var store = new ManualScreenshotStore(new FakeEnvironment(root),
                NullLogger<ManualScreenshotStore>.Instance);
            var userId = Guid.NewGuid();
            Assert.False(await store.SaveAsync(userId, "../escape", new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 }));
            Assert.False(await store.SaveAsync(userId, "OK", new byte[] { 1, 2 }));
            Assert.Null(store.UrlFor(userId, "../escape"));
        }
        finally
        {
            Directory.Delete(root, true);
        }
    }

    [Fact]
    public void Annotations_include_title_fields_columns_buttons_limits_and_audit()
    {
        var screen = Screen();
        var annotations = ManualScreenshotAnnotations.Build(screen);
        var text = string.Join(" | ", annotations.Select(a => a.Text));

        Assert.Contains("عنوان الشاشة: الأصناف", text);
        Assert.Contains("الحقول والفلاتر الظاهرة: بحث", text);
        Assert.Contains("أعمدة الجدول: الكود", text);
        Assert.Contains("زر «إضافة» (ITEMS/ADD)", text);
        Assert.Contains("يفتح حوار ItemDialog", text);
        Assert.Contains("القيود: حقول إلزامية", text);
        Assert.Contains("السجل: INSERT", text);
        Assert.Contains("زر «حذف»", text);
        Assert.Contains("قيود الصفحة:", text);
        Assert.Contains(annotations, annotation => annotation.Target == "إضافة");
    }

    [Fact]
    public void Dialog_annotations_include_usage_fields_and_buttons()
    {
        var dialog = Dialog();
        var text = string.Join(" | ", ManualDialogAnnotations.Build(dialog).Select(a => a.Text));
        Assert.Contains("حوار «ItemDialog» — حوار نموذج", text);
        Assert.Contains("الاستخدام: حوار ItemDialog", text);
        Assert.Contains("حقول الحوار: الكود", text);
        Assert.Contains("زر «حفظ» (SAVE)", text);
        Assert.Contains("القيود: حقول إلزامية", text);
        Assert.Contains("السجل: UPDATE", text);
    }

    [Fact]
    public void Dialog_illustration_is_svg_with_usage_and_fields()
    {
        var svg = ManualDialogIllustration.Render(Dialog());
        Assert.StartsWith("<svg", svg);
        Assert.EndsWith("</svg>", svg);
        Assert.Contains("حوار يُفتح من أزرار الشاشة", svg);
        Assert.Contains("ItemDialog", svg);
        Assert.Contains("الكود", svg);
        Assert.Contains("الاستخدام والشرح", svg);
        Assert.Contains("direction=\"rtl\"", svg);
        Assert.DoesNotContain("<script", svg);
    }

    private static ManualDialogDoc Dialog() => new(
        "ItemDialog", "حوار ItemDialog — تعديل / إضافة.",
        [
            new ManualButtonDoc("حفظ", "SAVE", "SaveAsync", "يحفظ النموذج.", "يغلق الحوار")
            {
                Appears = "يغلق الحوار ويعرض رسالة نجاح.",
                Limits = "حقول إلزامية.",
                Audit = "UPDATE"
            }
        ])
    {
        Fields = ["الكود", "الاسم بالعربية", "التصنيف"],
        Tabs = ["البيانات"],
        Kind = "حوار نموذج"
    };

    [Fact]
    public void Illustration_is_an_annotated_svg_with_escaped_text()
    {
        var screen = Screen();
        var svg = ManualScreenIllustration.Render(screen);

        Assert.StartsWith("<svg", svg);
        Assert.EndsWith("</svg>", svg);
        Assert.Contains("الشرح المكتوب على الصورة", svg);
        Assert.Contains("الأصناف", svg);
        Assert.Contains("/inventory/items", svg);
        Assert.Contains("ITEMS", svg);
        Assert.Contains("<circle", svg);
        Assert.Contains("direction=\"rtl\"", svg);
        Assert.DoesNotContain("<script", svg);
    }
}
