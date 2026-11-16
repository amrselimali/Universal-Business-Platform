using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// شاشة تسويات الجرد: فلترة بالفترة والمخزن، عرض التفاصيل، وترحيل موحّد وذرّي
/// (جرد + تسوية مخزنية + قيد محاسبي) بصلاحيات مستقلة.
/// </summary>
public sealed class StocktakeSettlementTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public StocktakeSettlementTests(TestDb db) => _db = db;

    [Fact]
    public async Task Post_settles_stock_and_generates_a_posted_accounting_entry()
    {
        var actor = await _db.AdminActorAsync();
        var (item, branch, warehouse) = await PrepareWithAccountsAsync("SET");
        var receipt = await _db.PostReceiptAsync(item, branch, warehouse, 10, 5);
        await _db.StockAccountingService().GenerateAsync(actor, receipt.Id);

        var stocktake = await CreateDraftAsync(branch, warehouse, item, 8, "عجز جرد");
        var result = await _db.StocktakeSettlementService().PostAsync(actor, stocktake.Id);

        Assert.NotNull(result.DocumentNo);
        Assert.Equal(1, result.LinesCount);
        Assert.Equal(10m, result.TotalCost);
        Assert.Equal(8, await _db.OnHandAsync(item.Id, warehouse));

        var posted = await _db.StocktakeRepo.GetAsync(stocktake.Id);
        Assert.Equal("POSTED", posted!.Status);
        Assert.Equal(result.DocumentId, posted.DocumentId);

        var entry = await _db.JournalEntryRepo.GetBySourceAsync(
            EntrySources.StockDocument, result.DocumentId);
        Assert.NotNull(entry);
        Assert.Equal(EntryStatuses.Posted, entry!.Status);
        Assert.Equal(10m, entry.TotalDebit);
        Assert.Equal(10m, entry.TotalCredit);

        var reports = await _db.AccountingReports().StockVsGlAsync(actor);
        var row = Assert.Single(reports, r => r.StockValue != 0 || r.GlBalance != 0);
        Assert.Equal(40m, row.StockValue);
        Assert.Equal(40m, row.GlBalance);
        Assert.True(row.IsMatched);
    }

    [Fact]
    public async Task Post_rolls_back_stock_and_stocktake_when_accounts_are_missing()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SETX-B", "فرع فشل التسوية");
        var warehouse = await _db.CreateWarehouseAsync("SETX-W", "مخزن فشل التسوية", branch);
        var item = await _db.CreateItemAsync("IT-SETX", "صنف فشل التسوية");
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 5);

        var stocktake = await CreateDraftAsync(branch, warehouse, item, 8, "عجز");
        var exception = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.StocktakeSettlementService().PostAsync(actor, stocktake.Id));
        Assert.Equal("validation.stock_accounts_missing", exception.Code);

        Assert.Equal(10, await _db.OnHandAsync(item.Id, warehouse));
        var stillDraft = await _db.StocktakeRepo.GetAsync(stocktake.Id);
        Assert.Equal("DRAFT", stillDraft!.Status);
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        Assert.Equal(0, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM stock_documents WHERE stocktake_id=@id",
            new { id = stocktake.Id }));
    }

    [Fact]
    public async Task List_filters_by_date_range_and_warehouse()
    {
        var actor = await _db.AdminActorAsync();
        var (item, branch, warehouse) = await PrepareWithAccountsAsync("SETL");
        var stocktake = await CreateDraftAsync(branch, warehouse, item, 9, "فرق يسير");
        var today = DateTime.UtcNow.Date;

        var included = await _db.StocktakeSettlementService().ListAsync(actor,
            new PageRequest { Page = 1, PageSize = 25 }, today, today, warehouse);
        Assert.Contains(included.Items, s => s.Id == stocktake.Id);

        var excludedByDate = await _db.StocktakeSettlementService().ListAsync(actor,
            new PageRequest { Page = 1, PageSize = 25 }, today.AddDays(1), null, warehouse);
        Assert.DoesNotContain(excludedByDate.Items, s => s.Id == stocktake.Id);

        var excludedByWarehouse = await _db.StocktakeSettlementService().ListAsync(actor,
            new PageRequest { Page = 1, PageSize = 25 }, today, today, Guid.NewGuid());
        Assert.DoesNotContain(excludedByWarehouse.Items, s => s.Id == stocktake.Id);
    }

    [Fact]
    public async Task Screen_permissions_are_independent_from_the_stocktake_screen()
    {
        var actor = new ActorContext
        {
            UserId = Guid.NewGuid(), Username = "viewer", IsAdmin = false, IsSuperAdmin = false
        };
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _db.StocktakeSettlementService().ListAsync(actor,
                new PageRequest { Page = 1, PageSize = 25 }, null, null, null));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _db.StocktakeSettlementService().PostAsync(actor, Guid.NewGuid()));
    }

    private async Task<(Item Item, Guid Branch, Guid Warehouse)> PrepareWithAccountsAsync(
        string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync(suffix + "-B", "فرع " + suffix);
        var warehouse = await _db.CreateWarehouseAsync(suffix + "-W", "مخزن " + suffix, branch);
        var category = await _db.ItemCategoryRepo.CreateAsync(new ItemCategoryInput
        {
            Code = "CAT-" + suffix, NameAr = "تصنيف " + suffix
        });
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        {
            Code = "U-" + suffix, NameAr = "وحدة " + suffix
        });
        var item = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "IT-" + suffix, NameAr = "صنف " + suffix, CategoryId = category.Id,
            BaseUnitId = unit.Id,
            Units = { new ItemUnitInput { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        await _db.AccountingSettings().SaveCategoryAccountAsync(actor, new ItemCategoryAccountInput
        {
            CategoryId = category.Id, InventoryAccountId = chart["1120"].Id,
            CogsAccountId = chart["5100"].Id,
            AdjustmentGainAccountId = chart["5410"].Id,
            AdjustmentLossAccountId = chart["5420"].Id
        });
        return (item, branch, warehouse);
    }

    private async Task<Stocktake> CreateDraftAsync(Guid branch, Guid warehouse, Item item,
        decimal counted, string reason)
    {
        var actor = await _db.AdminActorAsync();
        var code = await _db.StocktakeRepo.NextCodeAsync(branch, DateTime.UtcNow.Date);
        var stocktake = await _db.StocktakeRepo.CreateAsync(new StocktakeInput
        {
            BranchId = branch, WarehouseId = warehouse
        }, code, actor.UserId);
        var detail = await _db.StocktakeRepo.GetDetailAsync(stocktake.Id);
        var line = Assert.Single(detail!.Lines, l => l.ItemId == item.Id);
        await _db.StocktakeRepo.UpdateLinesAsync(stocktake.Id, new[]
        {
            new StocktakeLineInput
            {
                ItemId = item.Id, CountedQty = counted, UnitCost = line.UnitCost, Reason = reason
            }
        });
        return stocktake;
    }
}
