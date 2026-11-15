using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
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
}
