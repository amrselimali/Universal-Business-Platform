using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// نطاق البيانات: الأصناف إما للشركة كلها (branch_id = NULL) أو لفرع محدد،
/// والخزائن إما لفرع محدد أو خزينة شركة تظهر في كل الفروع — 0107.
/// </summary>
public sealed class CompanyScopeTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public CompanyScopeTests(TestDb db) => _db = db;

    private static ActorContext BranchActor(Guid branch) => new()
    {
        UserId = Guid.NewGuid(), Username = "scope-" + branch.ToString("N")[..6],
        IsAdmin = false, CurrentBranchId = branch,
        AllowedBranchIds = new[] { branch }, AllBranchIds = new[] { branch },
        TraceId = "company-scope-test"
    };

    [Fact]
    public async Task Items_are_visible_as_company_wide_or_for_their_branch_only()
    {
        var admin = await _db.AdminActorAsync();
        var lookup = _db.LookupService();
        var branchA = await _db.CreateBranchAsync("CS-B-A", "فرع نطاق أ");
        var branchB = await _db.CreateBranchAsync("CS-B-B", "فرع نطاق ب");
        var warehouseA = await _db.CreateWarehouseAsync("CS-W-A", "مخزن نطاق أ", branchA);

        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        {
            Code = "CS-U", NameAr = "وحدة نطاق"
        });
        async Task<Guid> CreateItemAsync(string code, Guid? branchId)
        {
            var item = await _db.ItemRepo.CreateAsync(new ItemInput
            {
                BranchId = branchId, Code = code, NameAr = code, BaseUnitId = unit.Id,
                Units = { new ItemUnitInput { UnitId = unit.Id, ConversionFactor = 1 } }
            });
            return item.Id;
        }

        var companyItem = await CreateItemAsync("CS-IT-COMPANY", null);
        var branchAItem = await CreateItemAsync("CS-IT-A", branchA);
        var branchBItem = await CreateItemAsync("CS-IT-B", branchB);

        var actorA = BranchActor(branchA);
        var visibleForA = await lookup.ItemsAsync(actorA, "CS-IT-", 50, false, null, branchA);
        Assert.Contains(visibleForA, i => i.Id == companyItem);
        Assert.Contains(visibleForA, i => i.Id == branchAItem);
        Assert.DoesNotContain(visibleForA, i => i.Id == branchBItem);

        // بدون تمرير فرع: يُستخدم فرع المستخدم الحالي تلقائيًا.
        Assert.DoesNotContain(await lookup.ItemsAsync(actorA, "CS-IT-", 50),
            i => i.Id == branchBItem);

        // المدير الأعلى بلا فرع يرى الجميع.
        var all = await lookup.ItemsAsync(admin, "CS-IT-", 50);
        Assert.Contains(all, i => i.Id == companyItem);
        Assert.Contains(all, i => i.Id == branchAItem);
        Assert.Contains(all, i => i.Id == branchBItem);

        // شاشة الجرد تعرض أصناف الشركة + أصناف الفرع المحدد فقط.
        var sheet = await _db.StocktakeService().GetCountSheetAsync(admin, branchA, warehouseA);
        Assert.Contains(sheet, r => r.ItemId == companyItem);
        Assert.Contains(sheet, r => r.ItemId == branchAItem);
        Assert.DoesNotContain(sheet, r => r.ItemId == branchBItem);

        // إنشاء جلسة الجرد نفسها لا يُدرج أصناف فرع آخر.
        var stocktake = await _db.StocktakeRepo.CreateAsync(new StocktakeInput
        {
            BranchId = branchA, WarehouseId = warehouseA
        }, "CS-STK-1", admin.UserId);
        var detail = await _db.StocktakeRepo.GetDetailAsync(stocktake.Id);
        Assert.Contains(detail!.Lines, l => l.ItemId == companyItem);
        Assert.Contains(detail.Lines, l => l.ItemId == branchAItem);
        Assert.DoesNotContain(detail.Lines, l => l.ItemId == branchBItem);
    }

    [Fact]
    public async Task Company_wide_treasury_is_available_in_every_branch()
    {
        var admin = await _db.AdminActorAsync();
        var lookup = _db.LookupService();
        var chart = await _db.SeedAccountingAsync();
        var branchA = await _db.CreateBranchAsync("CS-TB-A", "فرع خزينة نطاق أ");
        var branchB = await _db.CreateBranchAsync("CS-TB-B", "فرع خزينة نطاق ب");

        var branchTreasury = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(branchTreasury, new TreasuryInput
        {
            BranchId = branchA, IsCompanyWide = false, Code = "CS-T-A",
            NameAr = "خزينة فرع أ", TreasuryType = TreasuryTypes.Cash,
            AccountId = chart["1101"].Id
        }, admin.UserId);

        var companyTreasury = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(companyTreasury, new TreasuryInput
        {
            BranchId = branchA, IsCompanyWide = true, Code = "CS-T-COMPANY",
            NameAr = "خزينة الشركة", TreasuryType = TreasuryTypes.Cash,
            AccountId = chart["1101"].Id
        }, admin.UserId);

        var actorB = BranchActor(branchB);
        var forB = await lookup.TreasuriesAsync(actorB, branchB);
        Assert.Contains(forB, t => t.Id == companyTreasury && t.IsCompanyWide);
        Assert.DoesNotContain(forB, t => t.Id == branchTreasury);

        var forA = await lookup.TreasuriesAsync(BranchActor(branchA), branchA);
        Assert.Contains(forA, t => t.Id == companyTreasury);
        Assert.Contains(forA, t => t.Id == branchTreasury);

        // طرق التحصيل المكوَّدة في خزينة الشركة متاحة لفرع آخر أيضًا.
        var methodsForB = await lookup.TreasuryMethodsAsync(actorB, branchB);
        Assert.Contains(methodsForB, m => m.TreasuryId == companyTreasury);
        Assert.DoesNotContain(methodsForB, m => m.TreasuryId == branchTreasury);
    }
}
