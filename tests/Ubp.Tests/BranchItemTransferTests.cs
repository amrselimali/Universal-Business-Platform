using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// زر «تحويل صنف إلى فرع آخر» في شاشة المصروفات التشغيلية: يسجّل مسودة تحويل
/// مخزنية بين الفرعين، وتظهر حركتها في كارت الصنف بصادر من فرع المصدر وداخل
/// إلى فرع الوجهة قبل الترحيل، بلا أي أثر على الأرصدة.
/// </summary>
public sealed class BranchItemTransferTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public BranchItemTransferTests(TestDb db) => _db = db;

    private static string Unique() => Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private static ActorContext LimitedActor(Guid userId, string username, Guid branch) => new()
    {
        UserId = userId, Username = username, IsAdmin = false, IsSuperAdmin = false,
        Language = "ar", AllowedBranchIds = new[] { branch }, CurrentBranchId = branch,
        TraceId = "branch-transfer-test"
    };

    [Fact]
    public async Task Transfer_draft_appears_in_item_card_for_both_branches()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var fromBranch = await _db.CreateBranchAsync("BT-B1-" + suffix, "فرع المرسل " + suffix);
        var fromWarehouse = await _db.CreateWarehouseAsync("BT-W1-" + suffix,
            "مخزن المرسل " + suffix, fromBranch);
        var toBranch = await _db.CreateBranchAsync("BT-B2-" + suffix, "فرع المستقبل " + suffix);
        var toWarehouse = await _db.CreateWarehouseAsync("BT-W2-" + suffix,
            "مخزن المستقبل " + suffix, toBranch);
        var item = await _db.CreateItemAsync("BT-IT-" + suffix, "صنف التحويل " + suffix);
        await _db.PostReceiptAsync(item, fromBranch, fromWarehouse, 10, 5);

        var draft = await _db.StockDocumentService().CreateBranchTransferDraftAsync(actor,
            new StockDocumentInput
            {
                DocType = StockDocumentTypes.Transfer, DocDate = DateTime.UtcNow.Date,
                BranchId = fromBranch, WarehouseId = fromWarehouse,
                ToBranchId = toBranch, ToWarehouseId = toWarehouse,
                Lines =
                {
                    new StockDocumentLineInput
                    {
                        ItemId = item.Id, UnitId = item.BaseUnitId, Quantity = 4
                    }
                }
            });

        Assert.Equal(StockDocumentTypes.Transfer, draft.Document.DocType);
        Assert.Equal(StockStatuses.Draft, draft.Document.Status);
        Assert.Equal(fromBranch, draft.Document.BranchId);
        Assert.Equal(toBranch, draft.Document.ToBranchId);
        Assert.Equal(4m, draft.Lines.Single().Quantity);

        // كارت الصنف: استلام مرحَّل في المخزن المرسل + صادر مسودة منه + داخل مسودة للمستقبل.
        var card = await _db.StockReportRepo.ListMovementsAsync(
            new PageRequest { PageSize = 50 }, item.Id, null, null, null);
        Assert.Equal(3, card.Total);
        Assert.Contains(card.Items, m => m.Status == StockStatuses.Posted &&
                                          m.Direction == "IN" && m.WarehouseId == fromWarehouse);
        Assert.Contains(card.Items, m => m.Status == StockStatuses.Draft &&
                                          m.Direction == "OUT" && m.WarehouseId == fromWarehouse &&
                                          m.Quantity == 4);
        Assert.Contains(card.Items, m => m.Status == StockStatuses.Draft &&
                                          m.Direction == "IN" && m.WarehouseId == toWarehouse &&
                                          m.Quantity == 4);

        // المسودة لا تحرّك الأرصدة: الرصيد كما هو في المصدر وصفر في الوجهة.
        Assert.Equal(10m, await _db.OnHandAsync(item.Id, fromWarehouse));
        Assert.Equal(0m, await _db.OnHandAsync(item.Id, toWarehouse));
    }

    [Fact]
    public async Task Transfer_to_the_same_branch_is_rejected()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var branch = await _db.CreateBranchAsync("BT-SB-" + suffix, "فرع واحد " + suffix);
        var warehouse = await _db.CreateWarehouseAsync("BT-SW-" + suffix,
            "مخزن واحد " + suffix, branch);
        var other = await _db.CreateWarehouseAsync("BT-SW2-" + suffix,
            "مخزن ثانٍ " + suffix, branch);
        var item = await _db.CreateItemAsync("BT-SI-" + suffix, "صنف الفرع " + suffix);

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.StockDocumentService().CreateBranchTransferDraftAsync(actor,
                new StockDocumentInput
                {
                    BranchId = branch, WarehouseId = warehouse,
                    ToBranchId = branch, ToWarehouseId = other,
                    Lines =
                    {
                        new StockDocumentLineInput
                        {
                            ItemId = item.Id, UnitId = item.BaseUnitId, Quantity = 1
                        }
                    }
                }));
    }

    [Fact]
    public async Task Company_branch_options_list_every_active_branch_not_only_user_scope()
    {
        var suffix = Unique();
        var branchA = await _db.CreateBranchAsync("CBO-A-" + suffix, "فرع أ " + suffix);
        var branchB = await _db.CreateBranchAsync("CBO-B-" + suffix, "فرع ب " + suffix);
        var inactive = await _db.CreateBranchAsync("CBO-C-" + suffix, "فرع معطل " + suffix);
        await _db.BranchRepo.SetActiveAsync(inactive, false);

        var username = "cbo-" + suffix;
        var userId = await _db.CreateUserAsync(username, "Passw0rd!2026", new[] { branchA });
        var actor = LimitedActor(userId, username, branchA);

        var company = await _db.BranchService().CompanyOptionsAsync(actor);
        Assert.Contains(company, b => b.Id == branchA);
        Assert.Contains(company, b => b.Id == branchB);
        Assert.DoesNotContain(company, b => b.Id == inactive);

        // قائمة نطاق المستخدم تبقى مقيّدة بفرعه فقط.
        var scoped = await _db.BranchService().OptionsAsync(actor);
        Assert.Contains(scoped, b => b.Id == branchA);
        Assert.DoesNotContain(scoped, b => b.Id == branchB);
    }

    [Fact]
    public async Task Branch_limited_user_can_transfer_to_any_company_branch()
    {
        var suffix = Unique();
        var fromBranch = await _db.CreateBranchAsync("CBT-A-" + suffix, "فرع المصدر " + suffix);
        var fromWarehouse = await _db.CreateWarehouseAsync("CBT-W1-" + suffix,
            "مخزن المصدر " + suffix, fromBranch);
        var toBranch = await _db.CreateBranchAsync("CBT-B-" + suffix, "فرع الوجهة " + suffix);
        var toWarehouse = await _db.CreateWarehouseAsync("CBT-W2-" + suffix,
            "مخزن الوجهة " + suffix, toBranch);
        var item = await _db.CreateItemAsync("CBT-IT-" + suffix, "صنف تحويل الفروع " + suffix);

        var username = "cbt-" + suffix;
        var userId = await _db.CreateUserAsync(username, "Passw0rd!2026", new[] { fromBranch });
        await _db.PermissionRepo.ReplaceUserPermissionsAsync(userId, new[]
        {
            new PermissionEntry
            {
                ScreenCode = ScreenCodes.OperatingExpenses, ActionCode = ActionCodes.Create,
                IsAllowed = true, Scope = PermissionScope.All
            }
        });
        PermissionService.InvalidateAll();
        var actor = LimitedActor(userId, username, fromBranch);

        // بدون تمرير مخازن: تُستنتج من الفرعين على مستوى الشركة.
        var detail = await _db.StockDocumentService().CreateBranchTransferDraftAsync(actor,
            new StockDocumentInput
            {
                DocType = StockDocumentTypes.Transfer, DocDate = DateTime.UtcNow.Date,
                BranchId = fromBranch, ToBranchId = toBranch,
                Lines =
                {
                    new StockDocumentLineInput
                    {
                        ItemId = item.Id, UnitId = item.BaseUnitId, Quantity = 2
                    }
                }
            });

        Assert.Equal(StockStatuses.Draft, detail.Document.Status);
        Assert.Equal(fromBranch, detail.Document.BranchId);
        Assert.Equal(toBranch, detail.Document.ToBranchId);
        Assert.Equal(fromWarehouse, detail.Document.WarehouseId);
        Assert.Equal(toWarehouse, detail.Document.ToWarehouseId);
    }
}
