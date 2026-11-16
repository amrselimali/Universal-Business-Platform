using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// قوائم اختيار المخازن في الشاشات (الجرد/المستندات المخزنية) لا تشترط صلاحية شاشة
/// المخازن؛ مستخدم الفرع بصلاحية الجرد فقط يجب أن يرى مخازن فرعه ليعمل.
/// </summary>
public sealed class WarehouseOptionScopeTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public WarehouseOptionScopeTests(TestDb db) => _db = db;

    [Fact]
    public async Task Warehouse_options_are_available_without_the_warehouses_screen_permission()
    {
        var branch = await _db.CreateBranchAsync("OPT-B", "فرع خيارات المخازن");
        var warehouse = await _db.CreateWarehouseAsync("OPT-W", "مخزن خيارات المخازن", branch);
        var userId = await _db.CreateUserAsync("opt.warehouse.user", "Str0ng!Pass", new[] { branch });

        // مستخدم بلا أي دور/صلاحية شاشات: لا يملك warehouses:VIEW.
        var actor = new ActorContext
        {
            UserId = userId, Username = "opt.warehouse.user", IsAdmin = false,
            CurrentBranchId = branch, AllowedBranchIds = new[] { branch },
            AllBranchIds = new[] { branch }, TraceId = "test"
        };

        var warehouses = await _db.WarehouseService().OptionsAsync(actor);

        Assert.Contains(warehouses, w => w.Id == warehouse);
    }
}
