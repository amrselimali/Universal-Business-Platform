using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تعديل دوام الموظف من شاشة مواعيد الموظفين: التاريخ الجديد لا يسبق اليوم، والحجوزات
/// المؤكدة الواقعة خارج الوقت الجديد تُنبَّه أولاً ثم تعود مسودات عند التأكيد فقط.
/// </summary>
public sealed class AppointmentEditTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public AppointmentEditTests(TestDb db) => _db = db;

    private async Task<(Guid Branch, Guid Warehouse, Item Item, Partner Customer,
        Partner Customer2, Employee Employee)> SetupAsync(string suffix)
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("APE-B-" + suffix, "فرع تعديل الدوام " + suffix);
        var warehouse = await _db.CreateWarehouseAsync("APE-W-" + suffix, "مخزن " + suffix, branch);
        var item = await _db.CreateItemAsync("APE-IT-" + suffix, "صنف " + suffix);
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 50);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "APE-C-" + suffix, NameAr = "عميل أول " + suffix });
        var customer2 = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "APE-C2-" + suffix, NameAr = "عميل ثانٍ " + suffix });

        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        {
            Code = "APE-E-" + suffix, NameAr = "موظف دوام " + suffix, IsServiceExecutor = true
        }, actor.UserId);
        var employee = (await _db.EmployeeRepo.GetAsync(employeeId))!;
        return (branch, warehouse, item, customer, customer2, employee);
    }

    private async Task<Booking> ConfirmedBookingAsync(Guid branch, Guid warehouse, Item item,
        Partner customer, Guid employeeId, DateTimeOffset start, int minutes = 30)
    {
        var actor = await _db.AdminActorAsync();
        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branch, BookingDate = start.UtcDateTime.Date, CustomerId = customer.Id,
            AssignedEmployeeId = employeeId, StartsAt = start, EndsAt = start.AddMinutes(minutes),
            Lines = { new BookingLineInput { ItemId = item.Id, UnitId = item.BaseUnitId,
                WarehouseId = warehouse, Quantity = 1, UnitPrice = 100 } }
        });
        return await _db.BookingService().ConfirmAsync(actor, booking.Id);
    }

    [Fact]
    public async Task Editing_a_shift_to_a_past_date_is_rejected()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("1");
        var start = DateTimeOffset.UtcNow.Date.AddHours(9);
        var shift = await _db.Fulfillment().CreateAppointmentAsync(actor, new AppointmentInput
        {
            BranchId = f.Branch, EmployeeId = f.Employee.Id, StartsAt = start,
            EndsAt = start.AddHours(4)
        });

        var past = start.AddDays(-2);
        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Fulfillment().UpdateAppointmentAsync(actor, shift.Id, shift.Version,
                new AppointmentInput
                {
                    BranchId = f.Branch, EmployeeId = f.Employee.Id,
                    StartsAt = past, EndsAt = past.AddHours(4)
                }, revertOutsideBookings: false));
        Assert.Equal(AppointmentEditRules.DateInPastCode, error.Code);
    }

    [Fact]
    public async Task Confirmed_bookings_outside_the_new_window_become_drafts_after_confirmation()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("2");
        var start = DateTimeOffset.UtcNow.Date.AddHours(9); // دوام 09:00 — 13:00
        var shift = await _db.Fulfillment().CreateAppointmentAsync(actor, new AppointmentInput
        {
            BranchId = f.Branch, EmployeeId = f.Employee.Id, StartsAt = start,
            EndsAt = start.AddHours(4)
        });

        var inside = await ConfirmedBookingAsync(f.Branch, f.Warehouse, f.Item, f.Customer,
            f.Employee.Id, start.AddHours(1));                    // 10:00 — 10:30
        var tail = await ConfirmedBookingAsync(f.Branch, f.Warehouse, f.Item, f.Customer2,
            f.Employee.Id, start.AddHours(2).AddMinutes(45));     // 11:45 — 12:15

        // الوقت الجديد 09:00 — 12:00: حجز 11:45 يخرج عنه، وحجز 10:00 يبقى داخله.
        var newEnd = start.AddHours(3);
        var impact = await _db.Fulfillment().GetAppointmentEditImpactAsync(actor, shift.Id,
            start, newEnd);
        var affected = Assert.Single(impact);
        Assert.Equal(tail.Id, affected.BookingId);
        Assert.Equal(tail.DocNo, affected.BookingNo);
        Assert.Equal(f.Customer2.NameAr, affected.CustomerName);

        // بدون تأكيد: لا يتغير أي حجز.
        await _db.Fulfillment().UpdateAppointmentAsync(actor, shift.Id, shift.Version,
            new AppointmentInput
            {
                BranchId = f.Branch, EmployeeId = f.Employee.Id, StartsAt = start, EndsAt = newEnd
            }, revertOutsideBookings: false);
        Assert.Equal(BookingStatuses.Confirmed,
            (await _db.BookingService().GetAsync(actor, tail.Id)).Status);

        // بعد التأكيد: الحجز الخارج عن الوقت الجديد يعود مسودة وتُحرَّر كميته المحجوزة.
        var current = (await _db.AppointmentRepo.GetAsync(shift.Id))!;
        var result = await _db.Fulfillment().UpdateAppointmentAsync(actor, current.Id,
            current.Version, new AppointmentInput
            {
                BranchId = f.Branch, EmployeeId = f.Employee.Id, StartsAt = start, EndsAt = newEnd
            }, revertOutsideBookings: true);
        Assert.Equal(1, result.RevertedBookings);
        Assert.Equal(newEnd, result.Appointment.EndsAt.ToUniversalTime());

        var reverted = await _db.BookingService().GetAsync(actor, tail.Id);
        Assert.Equal(BookingStatuses.Draft, reverted.Status);
        Assert.Null(reverted.AssignedEmployeeId);
        Assert.Equal(0m, reverted.Lines.Single().ReservedQty);

        // الحجز داخل الوقت الجديد يبقى مؤكدًا.
        Assert.Equal(BookingStatuses.Confirmed,
            (await _db.BookingService().GetAsync(actor, inside.Id)).Status);
    }
}
