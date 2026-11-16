using Ubp.Application.Services;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// شاشة إدارة قاعدة البيانات تبقى محصورة بالمخوَّلين على الخادم: استعراض البيانات وتصدير
/// جدول/قاعدة كاملة ترفض أي مستخدم غير مخوَّل قبل لمس أي بيانات.
/// </summary>
public sealed class DatabaseAdminAuthorizationTests
{
    [Fact]
    public async Task Browse_and_exports_are_forbidden_for_unauthorized_users()
    {
        var db = new TestDb();
        var service = Service(db);
        var actor = new ActorContext
        {
            UserId = Guid.NewGuid(),
            Username = "not-a-dba",
            IsAdmin = false,
            IsSuperAdmin = false
        };

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.GetRowsPageAsync(actor, "users", 1, 25, null));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.ExportTableAsync(actor, "users", new MemoryStream()));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.ExportDatabaseAsync(actor, new MemoryStream()));
    }

    private static DatabaseAdminService Service(TestDb db) =>
        new(new SchemaAdminRepository(db.Factory), null!, null!, db.Permissions(),
            db.Settings(), new AuditService(db.AuditRepo));
}
