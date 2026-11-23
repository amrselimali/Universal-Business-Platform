using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// 0214 — لا يُنفَّذ حجز فرع بموظف مسؤول (أو منفّذ مختار) مسجّل على فرع آخر؛
/// موظف الشركة بلا فرع (branch_id NULL) يبقى مسموحاً.
/// </summary>
public sealed class ExecutionBranchScopeTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ExecutionBranchScopeTests(TestDb db) => _db = db;

    private async Task<(Guid BranchId, Guid WarehouseId, Guid ServiceId, Guid UnitId,
        Guid CustomerId)> ScaffoldAsync(string code)
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
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
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer,
            new PartnerInput { Code = $"{code}-C", NameAr = $"عميل {code}" });
        return (branchId, warehouseId, service.Id, unit.Id, customer.Id);
    }

    [Fact]
    public async Task Booking_cannot_be_assigned_to_an_employee_of_another_branch()
    {
        var actor = await _db.AdminActorAsync();
        var (branchA, warehouseA, serviceId, unitId, customerId) = await ScaffoldAsync("EBS0");
        var branchB = await _db.CreateBranchAsync("EBS0-B2", "فرع إسناد آخر");

        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        {
            Code = "EBS0-E", NameAr = "موظف إسناد فرع آخر", IsServiceExecutor = true,
            BranchId = branchB
        }, actor.UserId);

        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.BookingService().CreateAsync(actor, new BookingInput
            {
                BranchId = branchA, BookingDate = DateTime.Today, CustomerId = customerId,
                AssignedEmployeeId = employeeId,
                Lines = { new BookingLineInput { ItemId = serviceId, UnitId = unitId,
                    WarehouseId = warehouseA, Quantity = 1, UnitPrice = 100 } }
            }));
        Assert.Equal(BookingExecutionRules.BranchMismatchCode, error.Code);
    }

    [Fact]
    public async Task Execution_is_blocked_when_the_responsible_employee_belongs_to_another_branch()
    {
        var actor = await _db.AdminActorAsync();
        var (branchA, warehouseA, serviceId, unitId, customerId) = await ScaffoldAsync("EBS1");
        var branchB = await _db.CreateBranchAsync("EBS1-B2", "فرع آخر للتنفيذ");

        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        {
            Code = "EBS1-E", NameAr = "موظف فرع آخر", IsServiceExecutor = true, BranchId = branchB
        }, actor.UserId);

        // حجز مؤكد بلا موظف مسؤول، ثم إسناد قديم (بيانات سابقة) بموظف فرع آخر.
        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branchA, BookingDate = DateTime.Today, CustomerId = customerId,
            Lines = { new BookingLineInput { ItemId = serviceId, UnitId = unitId,
                WarehouseId = warehouseA, Quantity = 1, UnitPrice = 100 } }
        });
        await _db.BookingService().ConfirmAsync(actor, booking.Id);
        await using (var c = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await c.OpenAsync();
            await c.ExecuteAsync(
                "UPDATE bookings SET assigned_employee_id = @employee WHERE id = @id",
                new { employee = employeeId, id = booking.Id });
        }
        var line = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single();

        var preview = await _db.Executions().GetPreviewAsync(actor, line.Id);
        Assert.Equal(employeeId, preview.EmployeeId);
        Assert.Equal(branchB, preview.EmployeeBranchId);

        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
            { BookingLineId = line.Id, Quantity = 1 }));
        Assert.Equal(BookingExecutionRules.BranchMismatchCode, error.Code);

        var after = await _db.BookingService().GetAsync(actor, booking.Id);
        Assert.Equal(0m, after.Lines.Single().DeliveredQty);
    }

    [Fact]
    public async Task Explicit_executor_from_another_branch_is_rejected_on_the_server()
    {
        var actor = await _db.AdminActorAsync();
        var (branchA, warehouseA, serviceId, unitId, customerId) = await ScaffoldAsync("EBS2");
        var branchB = await _db.CreateBranchAsync("EBS2-B2", "فرع منفذ آخر");

        // خدمة مباشرة: لا تشترط موظفاً مسؤولاً على الحجز، فيبقى الفحص على المنفّذ المختار.
        await using (var c = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await c.OpenAsync();
            await c.ExecuteAsync(
                "UPDATE items SET execution_mode = 'direct' WHERE id = @id", new { id = serviceId });
        }

        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        { Code = "EBS2-E", NameAr = "منفذ فرع آخر", BranchId = branchB }, actor.UserId);

        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branchA, BookingDate = DateTime.Today, CustomerId = customerId,
            Lines = { new BookingLineInput { ItemId = serviceId, UnitId = unitId,
                WarehouseId = warehouseA, Quantity = 1, UnitPrice = 100 } }
        });
        var line = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single();

        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
            { BookingLineId = line.Id, Quantity = 1, EmployeeId = employeeId }));
        Assert.Equal(BookingExecutionRules.BranchMismatchCode, error.Code);
    }
}

