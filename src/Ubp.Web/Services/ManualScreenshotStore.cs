using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;

namespace Ubp.Web.Services;

/// <summary>
/// يحفظ لقطات شاشات دليل المستخدم على القرص لكل مستخدم على حدة (عزل البيانات)،
/// وتُعرض عبر نقطة نهاية محمية وليست ملفات ثابتة عامة. الصور تُولَّد في المتصفح (html2canvas).
/// </summary>
public sealed class ManualScreenshotStore
{
    private const string FolderName = "manual-screenshots";
    private static readonly Regex CodePattern = new("^[A-Za-z0-9_]{1,80}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<ManualScreenshotStore> _logger;

    public ManualScreenshotStore(IWebHostEnvironment environment,
        ILogger<ManualScreenshotStore> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    public string DirectoryPath
    {
        get
        {
            var root = string.IsNullOrWhiteSpace(_environment.ContentRootPath)
                ? AppContext.BaseDirectory
                : _environment.ContentRootPath;
            return Path.Combine(root, FolderName);
        }
    }

    public string? UrlFor(Guid userId, string code)
    {
        if (!IsValid(code)) return null;
        var path = PathFor(userId, code);
        return File.Exists(path)
            ? $"/api/v1/manual/screenshots/{code}?v={File.GetLastWriteTimeUtc(path).Ticks:x}"
            : null;
    }

    public string? PathForRead(Guid userId, string code)
    {
        if (!IsValid(code)) return null;
        var path = PathFor(userId, code);
        return File.Exists(path) ? path : null;
    }

    public bool Exists(Guid userId, string code) =>
        IsValid(code) && File.Exists(PathFor(userId, code));

    public async Task<bool> SaveAsync(Guid userId, string code, ReadOnlyMemory<byte> png,
        CancellationToken ct = default)
    {
        if (!IsValid(code) || !IsPng(png.Span)) return false;
        var path = PathFor(userId, code);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllBytesAsync(temp, png.ToArray(), ct);
            File.Move(temp, path, overwrite: true);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not save the manual screenshot for {Code}", code);
            TryDelete(temp);
            return false;
        }
    }

    public bool Delete(Guid userId, string code)
    {
        if (!IsValid(code)) return false;
        var path = PathFor(userId, code);
        try
        {
            if (!File.Exists(path)) return false;
            File.Delete(path);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete the manual screenshot for {Code}", code);
            return false;
        }
    }

    private string PathFor(Guid userId, string code) =>
        Path.Combine(DirectoryPath, userId.ToString("N"), code + ".png");

    private static bool IsValid(string code) =>
        !string.IsNullOrWhiteSpace(code) && CodePattern.IsMatch(code);

    private static bool IsPng(ReadOnlySpan<byte> bytes) =>
        bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E &&
        bytes[3] == 0x47 && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A &&
        bytes[7] == 0x0A;

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
            // ملف مؤقت — تجاهل فشل التنظيف.
        }
    }
}
