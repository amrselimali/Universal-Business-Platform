using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Ubp.Web.Services;

/// <summary>ملف تصدير جاهز للتنزيل: المسار والاسم والمستخدم وصلاحية الوصول والانتهاء.</summary>
public sealed record DatabaseExportTicket(string FilePath, string FileName, Guid UserId,
    string PermissionAction, DateTimeOffset ExpiresAt);

/// <summary>
/// مخزن مؤقت لملفات تصدير قاعدة البيانات. الملفات تُكتب على القرص على دفعات (لا في الذاكرة)،
/// ويُسلَّم كل ملف برمز عشوائي لمرة واحدة، لمستخدم واحد، ولصلاحية محددة، وبعد فحصها على الخادم.
/// </summary>
public sealed class DatabaseExportFileStore : IDisposable
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    private readonly ConcurrentDictionary<string, DatabaseExportTicket> _tickets = new();
    private readonly string _root = Path.Combine(Path.GetTempPath(), "ubp-db-exports");

    public string NewFilePath()
    {
        Directory.CreateDirectory(_root);
        return Path.Combine(_root, Guid.NewGuid().ToString("N") + ".xlsx");
    }

    public string Register(string filePath, string fileName, Guid userId,
        string permissionAction)
    {
        Cleanup();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        _tickets[token] = new DatabaseExportTicket(filePath, fileName, userId,
            permissionAction, DateTimeOffset.UtcNow.Add(Lifetime));
        return token;
    }

    /// <summary>يُستخدم مرة واحدة: إزالة التذكرة وإرجاعها إن كانت صالحة وغير منتهية.</summary>
    public DatabaseExportTicket? Take(string token)
    {
        if (string.IsNullOrWhiteSpace(token) ||
            !_tickets.TryRemove(token, out var ticket))
            return null;
        if (ticket.ExpiresAt < DateTimeOffset.UtcNow)
        {
            DeleteFile(ticket.FilePath);
            return null;
        }
        return ticket;
    }

    public void Discard(DatabaseExportTicket ticket) => DeleteFile(ticket.FilePath);

    private void Cleanup()
    {
        foreach (var pair in _tickets)
        {
            if (pair.Value.ExpiresAt >= DateTimeOffset.UtcNow) continue;
            if (_tickets.TryRemove(pair.Key, out var expired))
                DeleteFile(expired.FilePath);
        }
    }

    private static void DeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (IOException) { /* ملف قيد التنزيل: يُحذف لاحقاً */ }
        catch (UnauthorizedAccessException) { /* لا شيء */ }
    }

    public void Dispose()
    {
        foreach (var pair in _tickets)
            if (_tickets.TryRemove(pair.Key, out var ticket))
                DeleteFile(ticket.FilePath);
    }
}
