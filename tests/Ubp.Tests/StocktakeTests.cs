using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

public sealed class StocktakeTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public StocktakeTests(TestDb db) => _db = db;

    [Fact]
    public async Task Stocktake_post_creates_adjustment_document_and_updates_balance()
    {
        var branch = await _db.CreateBranchAsync("STK-B", "فرع الجرد");
        var warehouse = await _db.CreateWarehouseAsync("STK-W", "مخزن الجرد", branch);
        var item = await _db.CreateItemAsync("IT-STK", "صنف الجرد");
        var actor = await _db.AdminActorAsync();

        await _db.PostReceiptAsync(item, branch, warehouse, 10, 7);

        var code = await _db.StocktakeRepo.NextCodeAsync(branch, DateTime.UtcNow.Date);
        var stocktake = await _db.StocktakeRepo.CreateAsync(new StocktakeInput
        {
            BranchId = branch, WarehouseId = warehouse, Notes = "جرد شهري"
        }, code, actor.UserId);

        var detail = await _db.StocktakeRepo.GetDetailAsync(stocktake.Id);
        var line = Assert.Single(detail!.Lines);
        Assert.Equal(10, line.BookQty);

        await _db.StocktakeRepo.UpdateLinesAsync(stocktake.Id, new[]
        {
            new StocktakeLineInput
            {
                ItemId = item.Id, CountedQty = 8, UnitCost = line.UnitCost, Reason = "تلف"
            }
        });

        var adjustment = await _db.StockDocRepo.CreateDraftAsync(new StockDocumentInput
        {
            DocType = StockDocumentTypes.Adjustment,
            DocDate = DateTime.UtcNow.Date,
            BranchId = branch,
            WarehouseId = warehouse,
            Notes = "تسوية " + code,
            Lines =
            {
                new StockDocumentLineInput
                {
                    ItemId = item.Id, UnitId = item.BaseUnitId, ConversionFactor = 1,
                    Quantity = 2, UnitCost = line.UnitCost, Direction = "OUT"
                }
            }
        }, actor.UserId);
        await _db.StockDocRepo.LinkStocktakeAsync(adjustment.Id, stocktake.Id);
        await _db.StockPostingRepo.PostAsync(adjustment.Id, actor.UserId, false);
        await _db.StocktakeRepo.MarkPostedAsync(stocktake.Id, adjustment.Id, actor.UserId);

        Assert.Equal(8, await _db.OnHandAsync(item.Id, warehouse));
        var posted = await _db.StocktakeRepo.GetAsync(stocktake.Id);
        Assert.Equal("POSTED", posted!.Status);
        Assert.Equal(adjustment.Id, posted.DocumentId);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var linked = await connection.ExecuteScalarAsync<Guid?>(
            "SELECT stocktake_id FROM stock_documents WHERE id=@id", new { id = adjustment.Id });
        Assert.Equal(stocktake.Id, linked);
    }

    [Fact]
    public async Task Stocktake_lines_cannot_be_changed_after_posting()
    {
        var branch = await _db.CreateBranchAsync("STK2-B", "فرع جرد 2");
        var warehouse = await _db.CreateWarehouseAsync("STK2-W", "مخزن جرد 2", branch);
        await _db.CreateItemAsync("IT-STK2", "صنف جرد 2");
        var actor = await _db.AdminActorAsync();

        var code = await _db.StocktakeRepo.NextCodeAsync(branch, DateTime.UtcNow.Date);
        var stocktake = await _db.StocktakeRepo.CreateAsync(new StocktakeInput
        {
            BranchId = branch, WarehouseId = warehouse
        }, code, actor.UserId);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        await connection.ExecuteAsync(
            "UPDATE stocktakes SET status='POSTED' WHERE id=@id", new { id = stocktake.Id });

        var exception = await Assert.ThrowsAsync<PostgresException>(async () =>
            await connection.ExecuteAsync(
                "UPDATE stocktake_lines SET counted_qty = 5 WHERE stocktake_id=@id",
                new { id = stocktake.Id }));
        Assert.Equal("23514", exception.SqlState);
    }
}

public sealed class StocktakeReasonTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public StocktakeReasonTests(TestDb db) => _db = db;

    [Fact]
    public async Task Difference_without_reason_is_rejected_by_the_database()
    {
        var branch = await _db.CreateBranchAsync("RSN-B", "فرع سبب الفرق");
        var warehouse = await _db.CreateWarehouseAsync("RSN-W", "مخزن سبب الفرق", branch);
        var item = await _db.CreateItemAsync("IT-RSN", "صنف سبب الفرق");
        var actor = await _db.AdminActorAsync();
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 4);

        var code = await _db.StocktakeRepo.NextCodeAsync(branch, DateTime.UtcNow.Date);
        var stocktake = await _db.StocktakeRepo.CreateAsync(new StocktakeInput
        {
            BranchId = branch, WarehouseId = warehouse
        }, code, actor.UserId);

        var exception = await Assert.ThrowsAsync<Npgsql.PostgresException>(async () =>
            await _db.StocktakeRepo.UpdateLinesAsync(stocktake.Id, new[]
            {
                new StocktakeLineInput { ItemId = item.Id, CountedQty = 9, UnitCost = 4 }
            }));
        Assert.Equal("STOCKTAKE_REASON_REQUIRED", exception.MessageText);

        await _db.StocktakeRepo.UpdateLinesAsync(stocktake.Id, new[]
        {
            new StocktakeLineInput
            {
                ItemId = item.Id, CountedQty = 9, UnitCost = 4, Reason = "فقد أثناء النقل"
            }
        });
        var detail = await _db.StocktakeRepo.GetDetailAsync(stocktake.Id);
        Assert.Equal("فقد أثناء النقل", detail!.Lines.Single().Reason);
    }
}

public sealed class StocktakeCountSheetTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public StocktakeCountSheetTests(TestDb db) => _db = db;

    [Fact]
    public async Task Count_sheet_lists_active_goods_with_book_quantity_and_cost()
    {
        var branch = await _db.CreateBranchAsync("SHT-B", "فرع شاشة الجرد");
        var warehouse = await _db.CreateWarehouseAsync("SHT-W", "مخزن شاشة الجرد", branch);
        var item = await _db.CreateItemAsync("IT-SHT", "صنف شاشة الجرد");
        var actor = await _db.AdminActorAsync();
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 7);

        var rows = await _db.StocktakeService().GetCountSheetAsync(actor, branch, warehouse);
        var row = Assert.Single(rows, r => r.ItemId == item.Id);

        Assert.Equal("IT-SHT", row.ItemCode);
        Assert.Equal("صنف شاشة الجرد", row.ItemName);
        Assert.Equal(10, row.BookQty);
        Assert.Equal(7, row.UnitCost);
    }

    [Fact]
    public async Task New_count_sheet_can_be_saved_as_a_draft_with_entered_quantities_and_notes()
    {
        var branch = await _db.CreateBranchAsync("SHT2-B", "فرع حفظ الجرد");
        var warehouse = await _db.CreateWarehouseAsync("SHT2-W", "مخزن حفظ الجرد", branch);
        var item = await _db.CreateItemAsync("IT-SHT2", "صنف حفظ الجرد");
        var actor = await _db.AdminActorAsync();
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 7);
        var service = _db.StocktakeService();

        var sheet = await service.GetCountSheetAsync(actor, branch, warehouse);
        Assert.Contains(sheet, row => row.ItemId == item.Id);
        var created = await service.CreateAsync(actor, new StocktakeInput
        {
            BranchId = branch, WarehouseId = warehouse
        });
        var inputs = created.Lines.Select(line => new StocktakeLineInput
        {
            ItemId = line.ItemId,
            CountedQty = line.ItemId == item.Id ? 8 : line.CountedQty,
            UnitCost = line.UnitCost,
            Reason = line.ItemId == item.Id ? "عجز أثناء الجرد" : line.Reason
        }).ToList();
        var detail = await service.UpdateLinesAsync(actor, created.Header.Id, inputs);

        var saved = Assert.Single(detail.Lines, line => line.ItemId == item.Id);
        Assert.Equal(8, saved.CountedQty);
        Assert.Equal(-2, saved.Difference);
        Assert.Equal("عجز أثناء الجرد", saved.Reason);
    }
}
