using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تعديل خدمة منفذة بعد الترحيل بصلاحية مستقلة: عكسي سالب + معدّل مسودة،
/// وتقرير الشفت الجديد يعرض فرق التغيير فقط، ثم يُرحَّلان مع الشفت.
/// </summary>
public sealed class ExecutionEditTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public ExecutionEditTests(TestDb db) => _db = db;

    [Fact]
    public async Task Executed_service_can_be_adjusted_without_being_draft_or_shift_open()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerReceivable,
            chart["1110"].Id);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.SalesRevenue,
            chart["4100"].Id);
        var branch = await _db.CreateBranchAsync("EE-B-1", "فرع تعديل التنفيذ");
        var warehouse = await _db.CreateWarehouseAsync("EE-W-1", "مخزن تعديل التنفيذ", branch);
        var item = await _db.CreateItemAsync("EE-IT-1", "خدمة تعديل التنفيذ");
        await using (var c = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await c.OpenAsync();
            await c.ExecuteAsync(
                "UPDATE items SET item_type = 'SERVICE', execution_mode = 'direct' WHERE id = @id",
                new { id = item.Id });
        }
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "EE-C-1", NameAr = "عميل تعديل التنفيذ" });
        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branch, BookingDate = DateTime.Today, CustomerId = customer.Id,
            Lines = { new BookingLineInput { ItemId = item.Id, UnitId = item.BaseUnitId,
                WarehouseId = warehouse, Quantity = 5, UnitPrice = 100 } }
        });
        var line = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single();
        var execution = await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = line.Id, Quantity = 2 });

        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = branch });
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var executionLineId = await connection.ExecuteScalarAsync<Guid>(
            "SELECT id FROM booking_execution_lines WHERE execution_id = @id",
            new { id = execution.ExecutionId });

        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = shift.Id, EntityType = "booking_execution", DocId = execution.ExecutionId,
            LineId = executionLineId, Field = "quantity", NewValue = "3"
        });

        var original = await connection.QuerySingleAsync<(string Status, bool Reversed)>(
            "SELECT status, is_reversed FROM booking_executions WHERE id = @id",
            new { id = execution.ExecutionId });
        Assert.Equal("posted", original.Status);
        Assert.True(original.Reversed);
        var rows = (await connection.QueryAsync<(string Type, decimal Qty, string Status,
            Guid? ShiftId)>("""
            SELECT execution_type, el.quantity, e.status, e.shift_id
            FROM booking_executions e JOIN booking_execution_lines el ON el.execution_id = e.id
            WHERE e.parent_execution_id = @id ORDER BY execution_type
            """, new { id = execution.ExecutionId })).ToList();
        Assert.Contains(rows, x => x.Type == ExecutionTypes.Reversal && x.Qty == -2m &&
                                    x.Status == ExecutionStatuses.Draft && x.ShiftId == shift.Id);
        Assert.Contains(rows, x => x.Type == ExecutionTypes.Adjusted && x.Qty == 3m &&
                                    x.Status == ExecutionStatuses.Draft && x.ShiftId == shift.Id);

        // فرق الإيراد في الشفت الجديد = 300 − 200.
        var report = await _db.TreasuryService().GetShiftReportAsync(actor, shift.Id);
        Assert.Equal(100m, report.RevenuesTotal);

        await _db.TreasuryService().CloseShiftAsync(actor, shift.Id);
        await _db.TreasuryService().PostShiftToAccountsAsync(actor, shift.Id);
        var statuses = (await connection.QueryAsync<string>(
            "SELECT status FROM booking_executions WHERE parent_execution_id = @id",
            new { id = execution.ExecutionId })).ToList();
        Assert.All(statuses, s => Assert.Equal(ExecutionStatuses.Posted, s));
    }
    [Fact]
    public async Task Editing_executed_goods_reverses_and_reissues_stock_with_signed_cost()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerReceivable,
            chart["1110"].Id);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.SalesRevenue,
            chart["4100"].Id);
        var branch = await _db.CreateBranchAsync("EE-B-2", "فرع تعديل مخزون التنفيذ");
        var warehouse = await _db.CreateWarehouseAsync("EE-W-2", "مخزن تعديل مخزون التنفيذ", branch);
        var item = await _db.CreateItemAsync("EE-IT-2", "صنف تعديل التنفيذ");
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 50);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "EE-C-2", NameAr = "عميل تعديل مخزون التنفيذ" });
        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branch, BookingDate = DateTime.Today, CustomerId = customer.Id,
            Lines = { new BookingLineInput { ItemId = item.Id, UnitId = item.BaseUnitId,
                WarehouseId = warehouse, Quantity = 5, UnitPrice = 100 } }
        });
        await _db.BookingService().ConfirmAsync(actor, booking.Id);
        var line = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single();
        var execution = await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = line.Id, Quantity = 2 });
        Assert.Equal(8m, await _db.OnHandAsync(item.Id, warehouse));

        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = branch });
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var executionLineId = await connection.ExecuteScalarAsync<Guid>(
            "SELECT id FROM booking_execution_lines WHERE execution_id = @id",
            new { id = execution.ExecutionId });

        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = shift.Id, EntityType = "booking_execution", DocId = execution.ExecutionId,
            LineId = executionLineId, Field = "quantity", NewValue = "3"
        });

        var signedCost = (await connection.QueryAsync<(string Type, decimal Qty, decimal Cost)>("""
            SELECT e.execution_type, el.quantity, el.cost_total
            FROM booking_executions e JOIN booking_execution_lines el ON el.execution_id = e.id
            WHERE e.parent_execution_id = @id ORDER BY e.execution_type
            """, new { id = execution.ExecutionId })).ToList();
        Assert.Contains(signedCost, x => x.Type == ExecutionTypes.Reversal &&
                                         x.Qty == -2m && x.Cost == -100m);
        Assert.Contains(signedCost, x => x.Type == ExecutionTypes.Adjusted && x.Qty == 3m);

        await _db.TreasuryService().CloseShiftAsync(actor, shift.Id);
        await _db.TreasuryService().PostShiftToAccountsAsync(actor, shift.Id);
        Assert.Equal(7m, await _db.OnHandAsync(item.Id, warehouse));
    }

}
