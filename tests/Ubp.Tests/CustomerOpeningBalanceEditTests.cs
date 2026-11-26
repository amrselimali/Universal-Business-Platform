using Dapper;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// التعديل المباشر للأرصدة الافتتاحية: قبل أي تنفيذ/تحصيل فقط، بصلاحية مستقلة،
/// وبلا أي قيد محاسبي، مع إعادة حساب الكميات والمسدد وظهورها في كل الشاشات.
/// </summary>
public sealed class CustomerOpeningBalanceEditTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public CustomerOpeningBalanceEditTests(TestDb db) => _db = db;

    private static string Unique() => Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
    private static string Phone(string prefix) =>
        prefix + Guid.NewGuid().ToString("N")[..8];

    private async Task<(Guid Branch, PartnerCategory Category, Item Service, Item ServiceB)>
        SetupAsync(string suffix)
    {
        var branch = await _db.CreateBranchAsync("OBE-B-" + suffix, "فرع تعديل الأرصدة " + suffix);
        await _db.CreateWarehouseAsync("OBE-W-" + suffix, "مخزن تعديل الأرصدة " + suffix, branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = "OBEU" + suffix, NameAr = "وحدة " + suffix });
        var category = await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer,
            new PartnerCategoryInput { Code = "OBE-C-" + suffix, NameAr = "تصنيف " + suffix });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "OBES1" + suffix, NameAr = "خدمة أولى " + suffix, ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        var serviceB = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "OBES2" + suffix, NameAr = "خدمة ثانية " + suffix, ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        return (branch, category, service, serviceB);
    }

    private static PartnerInput CustomerInput(string name, PartnerCategory category, Guid branch,
        string phone) => new()
    {
        NameAr = name, CategoryId = category.Id, ScopeType = "BRANCH", BranchId = branch,
        Phone = phone, WhatsAppPhone = phone
    };

    private static ActorContext LimitedActor(Guid userId, string username, Guid branch) => new()
    {
        UserId = userId, Username = username, IsAdmin = false, IsSuperAdmin = false,
        Language = "ar", AllowedBranchIds = new[] { branch }, CurrentBranchId = branch,
        TraceId = "opening-balance-edit-test"
    };

    private async Task SetPermissionsAsync(Guid userId, params string[] actions)
    {
        await _db.PermissionRepo.ReplaceUserPermissionsAsync(userId, actions.Select(action =>
            new PermissionEntry
            {
                ScreenCode = ScreenCodes.Customers, ActionCode = action, IsAllowed = true,
                Scope = PermissionScope.All
            }));
        PermissionService.InvalidateAll();
    }

    [Fact]
    public async Task Edit_updates_quantities_paid_and_all_screens_without_journal()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل تعديل " + suffix, category, branch, Phone("021"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 50 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.True(line.IsEditable);
        Assert.Equal(200m, line.TotalAmount);

        await using var connection = await _db.Factory.OpenAsync();
        var journalsBefore = await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM journal_entries WHERE branch_id = @branch",
            new { branch });

        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = 3, UnitPrice = 120, PaidAmount = 60
                }
            });

        Assert.Equal(1, result.Updated);
        Assert.Equal(0, result.Added);
        Assert.Equal(0, result.Removed);
        Assert.Equal(360m, result.NewTotal);
        Assert.Equal(60m, result.NewPaid);
        Assert.Equal(160m, result.ValueDifference);
        Assert.Equal(10m, result.CashDifference);

        var bookingLine = await connection.QuerySingleAsync<(decimal Qty, decimal Price, decimal Reserved)>(
            "SELECT quantity, unit_price, reserved_qty FROM booking_lines WHERE id = @id",
            new { id = line.BookingLineId });
        Assert.Equal(3m, bookingLine.Qty);
        Assert.Equal(120m, bookingLine.Price);
        Assert.Equal(3m, bookingLine.Reserved);

        var booking = await connection.QuerySingleAsync<(decimal Total, decimal Deposit)>(
            "SELECT total_amount, deposit_amount FROM bookings WHERE id = @id",
            new { id = line.BookingId });
        Assert.Equal(360m, booking.Total);
        Assert.Equal(60m, booking.Deposit);

        var reservation = Assert.Single((await new ReservationRepository(_db.Factory).ListAsync(
            new PageRequest { PageSize = 50 }, Array.Empty<Guid>(), customer.Id, true)).Items);
        Assert.Equal(3m, reservation.RemainingQty);
        Assert.Equal(360m, reservation.RemainingValue);

        var outstanding = Assert.Single(await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id));
        Assert.Equal(60m, outstanding.PaidAmount);
        Assert.Equal(300m, outstanding.RemainingAmount);

        var journalsAfter = await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM journal_entries WHERE branch_id = @branch",
            new { branch });
        Assert.Equal(journalsBefore, journalsAfter);

        var audit = await connection.ExecuteScalarAsync<int>("""
            SELECT count(*)::int FROM audit_log
            WHERE table_name = 'bookings' AND record_id = @id AND action = 'UPDATE'
            """, new { id = line.BookingId.ToString() });
        Assert.Equal(1, audit);
    }

    /// <summary>
    /// سعر وحدة بكسر عشري طويل (15 رقمًا) لا يمنع إدخال المسدد بقيمة الإجمالي الظاهرة:
    /// المقارنة والتخزين بدقة قرشين.
    /// </summary>
    [Fact]
    public async Task Paid_edit_accepts_the_displayed_total_with_long_decimal_unit_price()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل كسور " + suffix, category, branch, Phone("029"));
        // 3 × 666.666666666667 = 1999.999999999999 ⇒ الإجمالي المعروض 2000.00
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        {
            ServiceId = service.Id, Quantity = 3, UnitPrice = 666.666666666667m, PaidAmount = 0
        });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.Equal(2000m, line.TotalAmount);
        Assert.Equal(2000m, line.MaxPaidAmount);

        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = line.Quantity, UnitPrice = line.UnitPrice, PaidAmount = 2000m
                }
            });

        Assert.Equal(2000m, result.NewPaid);
        Assert.Equal(0m, result.ValueDifference);
        Assert.Equal(2000m, result.CashDifference);
        Assert.Equal(2000m, await ScalarAsync<decimal>(
            "SELECT deposit_amount FROM bookings WHERE id = @id", new { id = line.BookingId }));
    }

    /// <summary>
    /// الحالة الواقعية: السعر الأصلي بكسر طويل، والمسدد = الإجمالي الظاهر، والتسامح مع
    /// فروق الكسور ≤ 0.001 — سواء أرسلت الشاشة السعر الأصلي أو السعر المقرَّب للعرض.
    /// </summary>
    [Fact]
    public async Task Paid_edit_uses_the_original_unit_price_and_forgives_sub_cent_fractions()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل أصل السعر " + suffix, category, branch, Phone("030"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        {
            ServiceId = service.Id, Quantity = 3, UnitPrice = 666.666666666667m, PaidAmount = 0
        });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);
        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));

        // السعر الفعلي المخزَّن (بكل علاماته) هو المرجع — لا السعر المقرَّب للعرض.
        await using var connection = await _db.Factory.OpenAsync();
        var originalPrice = await connection.ExecuteScalarAsync<decimal>(
            "SELECT unit_price FROM booking_lines WHERE id = @id",
            new { id = line.BookingLineId });

        // (1) السعر الأصلي بكامل علاماته + مسدد = الإجمالي الظاهر.
        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = line.Quantity, UnitPrice = line.UnitPrice, PaidAmount = 2000m
                }
            });
        Assert.Equal(2000m, result.NewPaid);

        // (2) السعر المقرَّب للعرض (666.67) لا يُفقد السعر الأصلي دقته ولا يرفض المسدد.
        var edited = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = line.Quantity, UnitPrice = 666.67m, PaidAmount = 2000.001m
                }
            });
        Assert.Equal(2000.00m, edited.NewPaid);
        Assert.Equal(0m, edited.ValueDifference);

        var stored = await connection.QuerySingleAsync<(decimal Price, decimal Total)>(
            "SELECT l.unit_price, b.total_amount FROM booking_lines l " +
            "JOIN bookings b ON b.id = l.booking_id WHERE l.id = @id",
            new { id = line.BookingLineId });
        Assert.Equal(originalPrice, stored.Price);
        Assert.Equal(2000m, stored.Total);
    }

    /// <summary>
    /// العكس: الإجمالي أقل من المسدد بكسر ضئيل (3 × 666.66666 = 1999.99998 مقابل مسدد 2000)
    /// — يُقبل لأن الفرق 0.00002 أصغر من تسامح 0.001، والإجمالي المخزَّن يُقرَّب لقرشين (2000.00).
    /// </summary>
    [Fact]
    public async Task Paid_slightly_above_the_total_within_tolerance_is_accepted()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل زيادة كسر " + suffix, category, branch, Phone("031"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        {
            ServiceId = service.Id, Quantity = 3, UnitPrice = 666.66666m, PaidAmount = 0
        });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);
        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.Equal(2000m, line.TotalAmount);           // العرض: 2000.00
        Assert.Equal(1999.99998m, line.Quantity * line.UnitPrice);

        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = line.Quantity, UnitPrice = line.UnitPrice, PaidAmount = 2000m
                }
            });

        Assert.Equal(2000m, result.NewPaid);
        Assert.Equal(2000m, result.CashDifference);   // المسدد القديم كان صفرًا

        await using var connection = await _db.Factory.OpenAsync();
        var booking = await connection.QuerySingleAsync<(decimal Total, decimal Deposit)>(
            "SELECT total_amount, deposit_amount FROM bookings WHERE id = @id",
            new { id = line.BookingId });
        Assert.Equal(2000m, booking.Total);
        Assert.Equal(2000m, booking.Deposit);
    }

    [Fact]
    public async Task Edit_is_locked_after_collection()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل قفل التحصيل " + suffix, category, branch, Phone("023"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 0 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "OBET" + suffix, NameAr = "خزينة " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        var before = Assert.Single(await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id));
        await _db.BookingCollections().CollectAsync(actor, new BookingCollectionInput
        {
            BranchId = branch, CustomerId = customer.Id, DocDate = DateTime.Today,
            Lines = { new BookingCollectionLineInput { BookingId = before.BookingId, Amount = 100 } },
            Payments =
            {
                new PosPaymentInput { TreasuryId = treasuryId, TreasuryMethodId = methodId, Amount = 100 }
            }
        });

        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.False(line.IsEditable);
        Assert.Equal("opening_balances.lock_collected", line.LockReasonKey);

        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id,
                new[]
                {
                    new PartnerOpeningBalanceEditLine
                    {
                        BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                        Quantity = 2, UnitPrice = 100, PaidAmount = 0
                    }
                }));
        Assert.Equal("validation.opening_balance_locked", error.Code);
    }

    [Fact]
    public async Task Edit_requires_its_own_permission_and_supports_add_and_remove()
    {
        var suffix = Unique();
        var (branch, category, service, serviceB) = await SetupAsync(suffix);
        var username = "obe-" + suffix;
        var userId = await _db.CreateUserAsync(username, "Passw0rd!2026", new[] { branch });
        await SetPermissionsAsync(userId, ActionCodes.View, ActionCodes.Add,
            ActionCodes.AddOpeningBalances);
        var actor = LimitedActor(userId, username, branch);

        var input = CustomerInput("عميل صلاحية التعديل " + suffix, category, branch, Phone("025"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 0 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        // بدون صلاحية «تعديل الأرصدة الافتتاحية»: القراءة والتعديل ممنوعان.
        await Assert.ThrowsAsync<ForbiddenException>(() => _db.Partners()
            .ListOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => _db.Partners()
            .UpdateOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id,
                Array.Empty<PartnerOpeningBalanceEditLine>()));

        // بصلاحية التعديل: إضافة خدمة ثانية وحذف الأولى في حفظ واحد.
        await SetPermissionsAsync(userId, ActionCodes.View, ActionCodes.EditOpeningBalances);
        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                { ServiceId = serviceB.Id, Quantity = 4, UnitPrice = 25, PaidAmount = 20 }
            });

        Assert.Equal(1, result.Added);
        Assert.Equal(0, result.Updated);
        Assert.Equal(1, result.Removed);
        Assert.Equal(100m, result.NewTotal);
        Assert.Equal(20m, result.NewPaid);

        await using var connection = await _db.Factory.OpenAsync();
        var deleted = await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM bookings WHERE id = @id", new { id = line.BookingId });
        Assert.Equal(0, deleted);

        var added = await connection.QuerySingleAsync<(Guid Id, bool IsOpening, decimal Total)>(
            "SELECT id, is_opening_balance, total_amount FROM bookings " +
            "WHERE customer_id = @customerId AND is_opening_balance",
            new { customerId = customer.Id });
        Assert.True(added.IsOpening);
        Assert.Equal(100m, added.Total);
        var serviceId = await connection.ExecuteScalarAsync<Guid>(
            "SELECT item_id FROM booking_lines WHERE booking_id = @id", new { id = added.Id });
        Assert.Equal(serviceB.Id, serviceId);
    }

    [Fact]
    public async Task Paid_only_edit_stays_allowed_after_execution()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل مسدد منفذ " + suffix, category, branch, Phone("027"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 20 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);
        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));

        // محاكاة تنفيذ كامل: الكمية صُرفت والحجز أصبح completed.
        await using (var connection = await _db.Factory.OpenAsync())
        {
            await connection.ExecuteAsync(
                "UPDATE booking_lines SET delivered_qty = 1, reserved_qty = 0 WHERE id = @id",
                new { id = line.BookingLineId });
            await connection.ExecuteAsync(
                "UPDATE bookings SET status = 'completed' WHERE id = @id", new { id = line.BookingId });
        }

        var locked = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.False(locked.IsEditable);
        Assert.Equal("opening_balances.lock_executed", locked.LockReasonKey);
        Assert.True(locked.CanEditPaid);
        Assert.Equal(100m, locked.MaxPaidAmount);

        // تعديل الكمية ممنوع بعد التنفيذ.
        var blocked = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id,
                new[]
                {
                    new PartnerOpeningBalanceEditLine
                    {
                        BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                        Quantity = 2, UnitPrice = 100, PaidAmount = 20
                    }
                }));
        Assert.Equal("validation.opening_balance_locked", blocked.Code);

        // تعديل المسدد فقط مسموح وينعكس في التحصيلات.
        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = 1, UnitPrice = 100, PaidAmount = 80
                }
            });
        Assert.Equal(1, result.Updated);
        Assert.Equal(80m, result.NewPaid);
        Assert.Equal(60m, result.CashDifference);

        var outstanding = Assert.Single(await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id));
        Assert.Equal(80m, outstanding.PaidAmount);
        Assert.Equal(20m, outstanding.RemainingAmount);

        await using var check = await _db.Factory.OpenAsync();
        var deposit = await check.ExecuteScalarAsync<decimal>(
            "SELECT deposit_amount FROM bookings WHERE id = @id", new { id = line.BookingId });
        Assert.Equal(80m, deposit);
        var quantity = await check.ExecuteScalarAsync<decimal>(
            "SELECT quantity FROM booking_lines WHERE id = @id", new { id = line.BookingLineId });
        Assert.Equal(1m, quantity);
    }

    [Fact]
    public async Task Paid_edit_after_collection_is_capped_by_service_value_less_receipts()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل سقف المسدد " + suffix, category, branch, Phone("029"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 50 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "OBEC" + suffix, NameAr = "خزينة السقف " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        var before = Assert.Single(await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id));
        await _db.BookingCollections().CollectAsync(actor, new BookingCollectionInput
        {
            BranchId = branch, CustomerId = customer.Id, DocDate = DateTime.Today,
            Lines = { new BookingCollectionLineInput { BookingId = before.BookingId, Amount = 100 } },
            Payments =
            {
                new PosPaymentInput { TreasuryId = treasuryId, TreasuryMethodId = methodId, Amount = 100 }
            }
        });

        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.False(line.IsEditable);
        Assert.Equal("opening_balances.lock_collected", line.LockReasonKey);
        Assert.True(line.CanEditPaid);
        Assert.Equal(100m, line.MaxPaidAmount);   // 200 قيمة − 100 إيصال

        // تجاوز السقف مرفوض.
        var over = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id,
                new[]
                {
                    new PartnerOpeningBalanceEditLine
                    {
                        BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                        Quantity = 2, UnitPrice = 100, PaidAmount = 150
                    }
                }));
        Assert.Equal("validation.paid_exceeds_total", over.Code);

        // تعديل الكمية بعد التحصيل ممنوع.
        var structural = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id,
                new[]
                {
                    new PartnerOpeningBalanceEditLine
                    {
                        BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                        Quantity = 3, UnitPrice = 100, PaidAmount = 50
                    }
                }));
        Assert.Equal("validation.opening_balance_locked", structural.Code);

        // حتى السقف مسموح: المسدد الكلي = قيمة الخدمة، ولا يبقى مستحق.
        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = 2, UnitPrice = 100, PaidAmount = 100
                }
            });
        Assert.Equal(1, result.Updated);
        Assert.Equal(50m, result.CashDifference);

        Assert.Empty(await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id));
        await using var check = await _db.Factory.OpenAsync();
        var deposit = await check.ExecuteScalarAsync<decimal>(
            "SELECT deposit_amount FROM bookings WHERE id = @id", new { id = line.BookingId });
        Assert.Equal(100m, deposit);
    }

    /// <summary>
    /// الأرصدة الافتتاحية حجوزات خدمات وليست مواعيد عملاء: مصدرها `opening`
    /// فتُستبعد تلقائيًا من شاشة «حجز موعد» وطبعها، وتبقى في شاشة بنود الأرصدة
    /// والخدمات المحجوزة — 0104/0217.
    /// </summary>
    [Fact]
    public async Task Opening_balance_is_not_listed_as_an_appointment_booking()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل فصل المواعيد " + suffix, category, branch, Phone("031"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 1, UnitPrice = 120, PaidAmount = 20 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var repo = new BookingRepository(_db.Factory);
        var unfiltered = await repo.ListAsync(new BookingFilter
        {
            BranchIds = new[] { branch }
        }, new PageRequest { PageSize = 50 });
        var opening = Assert.Single(unfiltered.Items, b => b.CustomerId == customer.Id);
        Assert.Equal(BookingSources.OpeningBalance, opening.Source);

        // شاشة «حجز موعد» تصفّي مصدر manual فقط — لا تعرض أرصدة التكويد.
        var appointments = await repo.ListAsync(new BookingFilter
        {
            BranchIds = new[] { branch }, Source = BookingSources.Manual
        }, new PageRequest { PageSize = 50 });
        Assert.DoesNotContain(appointments.Items, b => b.CustomerId == customer.Id);

        // حماية إضافية لأي قائمة مواعيد لا تصفّي المصدر صراحةً.
        var excluded = await repo.ListAsync(new BookingFilter
        {
            BranchIds = new[] { branch }, ExcludeOpeningBalances = true
        }, new PageRequest { PageSize = 50 });
        Assert.DoesNotContain(excluded.Items, b => b.CustomerId == customer.Id);

        // يبقى بندًا افتتاحيًا ظاهرًا في شاشته الخاصة (حجز خدمة لا موعد).
        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));
        Assert.Equal(120m, line.TotalAmount);
    }

    /// <summary>
    /// المسدد يفتح للتعديل في كل الحالات — حتى بعد التسوية أو تحويل الخدمة — بنفس منطق
    /// الرصيد الافتتاحي: تحديث deposit_amount فقط بلا أي قيد محاسبي، وينعكس في كل الشاشات.
    /// </summary>
    [Fact]
    public async Task Paid_edit_stays_open_after_settlement_and_transfer()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, serviceB) = await SetupAsync(suffix);
        var input = CustomerInput("عميل مسدد مقفول " + suffix, category, branch, Phone("041"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 50 });
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = serviceB.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 50 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var lines = await _db.Partners().ListOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id);
        Assert.Equal(2, lines.Count);
        // بند مسوّى (استُهلكت كميته) وبند محوَّل — كلاهما مقفول بنيويًا.
        await using (var connection = await _db.Factory.OpenAsync())
        {
            await connection.ExecuteAsync(
                "UPDATE booking_lines SET settled_qty = 1 WHERE id = @id",
                new { id = lines.Single(l => l.ServiceId == service.Id).BookingLineId });
            await connection.ExecuteAsync(
                "UPDATE booking_lines SET transferred_qty = 1 WHERE id = @id",
                new { id = lines.Single(l => l.ServiceId == serviceB.Id).BookingLineId });
        }

        // إعادة القراءة بعد الحركتين: البند مقفول بنيويًا والمسدد يبقى مفتوحًا.
        lines = await _db.Partners().ListOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id);
        var settled = lines.Single(l => l.ServiceId == service.Id);
        var transferred = lines.Single(l => l.ServiceId == serviceB.Id);
        Assert.False(settled.IsEditable);
        Assert.Equal("opening_balances.lock_settled", settled.LockReasonKey);
        Assert.Equal("opening_balances.lock_transferred", transferred.LockReasonKey);
        Assert.True(settled.CanEditPaid);
        Assert.True(transferred.CanEditPaid);
        Assert.Equal(200m, settled.MaxPaidAmount);
        var journalsBefore = await CountAsync("journal_entries");
        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = settled.BookingLineId, ServiceId = settled.ServiceId,
                    Quantity = settled.Quantity, UnitPrice = settled.UnitPrice,
                    PaidAmount = 150
                },
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = transferred.BookingLineId,
                    ServiceId = transferred.ServiceId, Quantity = transferred.Quantity,
                    UnitPrice = transferred.UnitPrice, PaidAmount = 120
                }
            });

        Assert.Equal(2, result.Updated);
        Assert.Equal(170m, result.CashDifference); // 270 − 100
        Assert.Equal(journalsBefore, await CountAsync("journal_entries"));
        Assert.Equal(150m, await ScalarAsync<decimal>(
            "SELECT deposit_amount FROM bookings WHERE id = @id", new { id = settled.BookingId }));
        Assert.Equal(120m, await ScalarAsync<decimal>(
            "SELECT deposit_amount FROM bookings WHERE id = @id",
            new { id = transferred.BookingId }));
    }

    /// <summary>حد المسدد في الحجز متعدد البنود = إجمالي الحجز ناقص الإيصالات.</summary>
    [Fact]
    public async Task Paid_edit_uses_the_whole_booking_total_on_a_multi_line_booking()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, service, serviceB) = await SetupAsync(suffix);
        var input = CustomerInput("عميل متعدد البنود " + suffix, category, branch, Phone("042"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = service.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 40 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);
        var line = Assert.Single(await _db.Partners().ListOpeningBalancesAsync(actor,
            PartnerKind.Customer, customer.Id));

        // بند ثانٍ على نفس الحجز (بيانات قديمة/مرحّلة) => إجمالي الحجز 300.
        await using (var connection = await _db.Factory.OpenAsync())
        {
            await connection.ExecuteAsync("""
                INSERT INTO booking_lines (booking_id, line_no, item_id, unit_id, warehouse_id,
                    quantity, unit_price, net_amount, tax_amount, total_amount, reserved_qty)
                SELECT @booking, 2, @item, l.unit_id, l.warehouse_id, 2, 100, 200, 0, 200, 2
                FROM booking_lines l WHERE l.id = @line
                """, new { booking = line.BookingId, item = serviceB.Id,
                    line = line.BookingLineId });
            await connection.ExecuteAsync(
                "UPDATE bookings SET total_amount = 300 WHERE id = @id",
                new { id = line.BookingId });
        }

        var rows = await _db.Partners().ListOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id);
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.True(r.CanEditPaid));
        Assert.All(rows, r => Assert.Equal(300m, r.MaxPaidAmount));

        var over = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer, customer.Id,
                new[]
                {
                    new PartnerOpeningBalanceEditLine
                    {
                        BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                        Quantity = line.Quantity, UnitPrice = line.UnitPrice, PaidAmount = 350
                    }
                }));
        Assert.Equal("validation.paid_exceeds_total", over.Code);

        var result = await _db.Partners().UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
            customer.Id, new[]
            {
                new PartnerOpeningBalanceEditLine
                {
                    BookingLineId = line.BookingLineId, ServiceId = line.ServiceId,
                    Quantity = line.Quantity, UnitPrice = line.UnitPrice, PaidAmount = 300
                }
            });
        Assert.Equal(1, result.Updated);
        Assert.Equal(300m, await ScalarAsync<decimal>(
            "SELECT deposit_amount FROM bookings WHERE id = @id", new { id = line.BookingId }));
    }

    private async Task<int> CountAsync(string table)
    {
        await using var connection = await _db.Factory.OpenAsync();
        return await connection.ExecuteScalarAsync<int>(
            $"SELECT count(*)::int FROM {table}");
    }

    private async Task<T> ScalarAsync<T>(string sql, object args)
    {
        await using var connection = await _db.Factory.OpenAsync();
        return await connection.ExecuteScalarAsync<T>(sql, args);
    }
}
