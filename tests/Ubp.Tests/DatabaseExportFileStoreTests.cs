using Ubp.Core.Security;
using Ubp.Web.Services;
using Xunit;

namespace Ubp.Tests;

/// <summary>رموز تنزيل ملفات التصدير: عشوائية، لمرة واحدة، ومربوطة بالمستخدم والصلاحية.</summary>
public sealed class DatabaseExportFileStoreTests
{
    [Fact]
    public void Download_ticket_is_single_use_and_carries_user_and_permission()
    {
        using var store = new DatabaseExportFileStore();
        var path = store.NewFilePath();
        File.WriteAllText(path, "xlsx");
        var userId = Guid.NewGuid();

        var token = store.Register(path, "users.xlsx", userId, ActionCodes.ExportTable);
        Assert.Equal(48, token.Length);

        var ticket = store.Take(token);
        Assert.NotNull(ticket);
        Assert.Equal("users.xlsx", ticket!.FileName);
        Assert.Equal(userId, ticket.UserId);
        Assert.Equal(ActionCodes.ExportTable, ticket.PermissionAction);
        Assert.Null(store.Take(token));

        store.Discard(ticket);
        Assert.False(File.Exists(path));
    }
}
