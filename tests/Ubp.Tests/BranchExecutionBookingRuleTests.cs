using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// 0213 — إعداد الفرع: عند التفعيل لا تُسجَّل خدمة محجوزة إلا بوجود حجز مؤكد لنفس العميل مع نفس
/// الموظف في نفس اليوم؛ وعند التعطيل يُقبل التسجيل بدون هذا الشرط.
/// </summary>
public sealed class BranchExecutionBookingRuleTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public BranchExecutionBookingRuleTests(TestDb db) => _db = db;

    private async Task<(Guid BranchId, Guid WarehouseId, Guid UnitId, Guid ServiceId)>
        ScaffoldAsync(string code, bool requireConfirmed)
    {
        var branchId = await _db.CreateBranchAsync($"{code}-B", $"فرع {code}");
        var warehouseId = await _db.CreateWarehouseAsync($"{code}-W", $"مخزن {code}", branchId);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = $"{code}-U", NameAr = $"وحدة {code}" });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = $"{code}-SV", NameAr = $"خدمة {code}", ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });

        var branch = (await _db.BranchRepo.GetAsync(branchId))!;
        await _db.BranchRepo.UpdateAsync(branchId, branch.Version, new BranchInput
        {
            Code = branch.Code, NameAr = branch.NameAr, NameEn = branch.NameEn,
            Address = branch.Address, Phone = branch.Phone, IsActive = true,
            RequireConfirmedBookingForExecution = requireConfirmed,
            CustomFields = branch.CustomFields
        });

        return (branchId, warehouseId, unit.Id, service.Id);
    }

    private async Task<Guid> BookingAsync(string code, Guid branchId, Guid warehouseId,
        Guid serviceId, Guid unitId, Guid customerId, Guid employeeId, DateTime bookingDate)
    {
        var actor = await _db.AdminActorAsync();
        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branchId, BookingDate = bookingDate, CustomerId = customerId,
            AssignedEmployeeId = employeeId,
            Lines =
            {
                new BookingLineInput
                {
                    ItemId = serviceId, UnitId = unitId, WarehouseId = warehouseId,
                    Quantity = 1, UnitPrice = 100
                }
            }
        });
        await _db.BookingRepo.ConfirmAsync(booking.Id, actor.UserId, reserveStock: false);
        return booking.Id;
    }

    private async Task<DateOnly> TodayAsync() =>
        BookingExecutionRules.TodayIn((await _db.Settings().GetAsync()).TimeZone,
            DateTimeOffset.UtcNow);

    [Fact]
    public async Task Enabled_branch_allows_execution_when_a_confirmed_booking_exists_today()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var (branchId, warehouseId, unitId, serviceId) =
            await ScaffoldAsync("CEB1", requireConfirmed: true);

        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer,
            new PartnerInput { Code = "CEB1-C", NameAr = "عميل شرط الحجز" });
        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        { Code = "CEB1-E", NameAr = "موظف شرط الحجز", IsServiceExecutor = true }, actor.UserId);

        var today = await TodayAsync();
        var bookingId = await BookingAsync("CEB1", branchId, warehouseId, serviceId, unitId,
            customer.Id, employeeId, today.ToDateTime(TimeOnly.MinValue));

        var branch = (await _db.BranchRepo.GetAsync(branchId))!;
        Assert.True(branch.RequireConfirmedBookingForExecution);

        var line = (await _db.BookingService().GetAsync(actor, bookingId)).Lines.Single();
        var result = await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = line.Id, Quantity = 1 });
        Assert.Equal(1m, result.Quantity);
    }

    [Fact]
    public async Task Enabled_branch_blocks_execution_without_a_confirmed_booking_today()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var (branchId, warehouseId, unitId, serviceId) =
            await ScaffoldAsync("CEB2", requireConfirmed: true);

        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer,
            new PartnerInput { Code = "CEB2-C", NameAr = "عميل بلا حجز اليوم" });
        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        { Code = "CEB2-E", NameAr = "موظف بلا حجز اليوم", IsServiceExecutor = true },
            actor.UserId);

        // الحجز مؤكد لكنه لموعد بعد يومين ⇒ لا يوجد حجز مؤكد «اليوم».
        var later = (await TodayAsync()).AddDays(2).ToDateTime(TimeOnly.MinValue);
        var bookingId = await BookingAsync("CEB2", branchId, warehouseId, serviceId, unitId,
            customer.Id, employeeId, later);

        var line = (await _db.BookingService().GetAsync(actor, bookingId)).Lines.Single();
        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
            { BookingLineId = line.Id, Quantity = 1 }));
        Assert.Equal(BookingExecutionRules.Code, error.Code);

        var after = await _db.BookingService().GetAsync(actor, bookingId);
        Assert.Equal(0m, after.Lines.Single().DeliveredQty);
    }

    [Fact]
    public async Task Disabled_branch_accepts_execution_without_a_booking_today()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var (branchId, warehouseId, unitId, serviceId) =
            await ScaffoldAsync("CEB3", requireConfirmed: false);

        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer,
            new PartnerInput { Code = "CEB3-C", NameAr = "عميل تسجيل حر" });
        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        { Code = "CEB3-E", NameAr = "موظف تسجيل حر", IsServiceExecutor = true },
            actor.UserId);

        var later = (await TodayAsync()).AddDays(2).ToDateTime(TimeOnly.MinValue);
        var bookingId = await BookingAsync("CEB3", branchId, warehouseId, serviceId, unitId,
            customer.Id, employeeId, later);

        var branch = (await _db.BranchRepo.GetAsync(branchId))!;
        Assert.False(branch.RequireConfirmedBookingForExecution);

        var line = (await _db.BookingService().GetAsync(actor, bookingId)).Lines.Single();
        var result = await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = line.Id, Quantity = 1 });
        Assert.Equal(1m, result.Quantity);
    }
}
