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
    public async Task Editing_plips_updates_the_fixed_asset_meter_through_the_adjustment_cycle()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerReceivable,
            chart["1110"].Id);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.SalesRevenue,
            chart["4100"].Id);
        var branch = await _db.CreateBranchAsync("EE-B-3", "فرع تعديل البلصات");
        var warehouse = await _db.CreateWarehouseAsync("EE-W-3", "مخزن تعديل البلصات", branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = "EE-U-3", NameAr = "وحدة تعديل البلصات" });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "EE-SV-3", NameAr = "خدمة تعديل البلصات", ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        var categoryId = Guid.CreateVersion7();
        var assetId = Guid.CreateVersion7();
        await using (var c = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await c.OpenAsync();
            await c.ExecuteAsync("""
                INSERT INTO asset_categories
                    (id, code, name_ar, depreciation_method, useful_life_months, is_metered)
                VALUES (@id, 'EE-AC-3', 'تصنيف بلصات', 'LINEAR', 60, true)
                """, new { id = categoryId });
            await c.ExecuteAsync("""
                INSERT INTO fixed_assets
                    (id, code, name_ar, category_id, branch_id, purchase_date, cost, is_metered,
                     meter_type, current_meter_value)
                VALUES (@id, 'EE-AS-3', 'ماكينة بلصات', @category, @branch, current_date, 1000,
                        true, 'UNITS', 0)
                """, new { id = assetId, category = categoryId, branch });
            await c.ExecuteAsync("UPDATE items SET is_metered = true WHERE id = @id",
                new { id = service.Id });
        }

        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "EE-C-3", NameAr = "عميل تعديل البلصات" });
        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        { Code = "EE-E-3", NameAr = "موظف تعديل البلصات", IsServiceExecutor = true },
            actor.UserId);

        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branch, BookingDate = DateTime.Today, CustomerId = customer.Id,
            AssignedEmployeeId = employeeId,
            Lines = { new BookingLineInput { ItemId = service.Id, UnitId = service.BaseUnitId,
                WarehouseId = warehouse, Quantity = 1, UnitPrice = 100 } }
        });
        await _db.BookingService().ConfirmAsync(actor, booking.Id);
        var line = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single();

        // تسجيل الخدمة بـ 3 بلصات: تُرحَّل فوراً (لا شفت مفتوح) فيصبح عداد الأصل 3.
        var execution = await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = line.Id, Quantity = 1, MeteredAssetId = assetId, MeterUnits = 3 });
        Assert.Equal(3m, execution.MeterValueAfter);

        var shift = await _db.TreasuryService().OpenShiftAsync(actor,
            new ShiftInput { NormalShift = true, BranchId = branch });
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var executionLineId = await connection.ExecuteScalarAsync<Guid>(
            "SELECT id FROM booking_execution_lines WHERE execution_id = @id",
            new { id = execution.ExecutionId });

        // تعديل عدد البلصات من 3 إلى 5: عكسي −3 + معدّل 5 (لا يُخزَّن رقم مستقل بمعزل عن العداد).
        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = shift.Id, EntityType = "booking_execution", DocId = execution.ExecutionId,
            LineId = executionLineId, Field = "meter_units", NewValue = "5"
        });

        var rows = (await connection.QueryAsync<(string Type, decimal MeterUnits, string Status)>(
            """
            SELECT e.execution_type, el.meter_units, e.status
            FROM booking_executions e JOIN booking_execution_lines el ON el.execution_id = e.id
            WHERE e.parent_execution_id = @id ORDER BY e.execution_type
            """, new { id = execution.ExecutionId })).ToList();
        Assert.Contains(rows, x => x.Type == ExecutionTypes.Reversal && x.MeterUnits == -3m);
        Assert.Contains(rows, x => x.Type == ExecutionTypes.Adjusted && x.MeterUnits == 5m &&
                                   x.Status == ExecutionStatuses.Draft);

        // البلصات تظهر في سطور تقرير الشفت القابلة للتعديل من عمود العداد نفسه.
        var editable = await _db.ShiftEdit().ListAsync(actor, shift.Id);
        var editableLine = Assert.Single(editable.Where(l => l.EntityType == "booking_execution"));
        Assert.Equal(assetId, editableLine.MeteredAssetId);
        Assert.Equal(5m, editableLine.MeterUnits);
        Assert.Contains("meter_units", editableLine.Fields);

        await _db.TreasuryService().CloseShiftAsync(actor, shift.Id);
        await _db.TreasuryService().PostShiftToAccountsAsync(actor, shift.Id);
        Assert.Equal(5m, await connection.ExecuteScalarAsync<decimal>(
            "SELECT current_meter_value FROM fixed_assets WHERE id = @id", new { id = assetId }));
        Assert.Equal(5m, await connection.ExecuteScalarAsync<decimal>(
            "SELECT COALESCE(SUM(delta), 0) FROM asset_meter_readings WHERE asset_id = @id",
            new { id = assetId }));
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
