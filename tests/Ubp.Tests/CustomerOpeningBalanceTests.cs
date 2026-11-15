using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// الأرصدة الافتتاحية للخدمات عند تكويد عميل جديد: تُحفظ مع العميل في معاملة
/// واحدة، وتظهر كخدمات محجوزة للتنفيذ ومستحقات في تحصيلات الخدمات المحجوزة،
/// ويُخصم المسدد سابقًا مرة واحدة فقط — 0104.
/// </summary>
public sealed class CustomerOpeningBalanceTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public CustomerOpeningBalanceTests(TestDb db) => _db = db;

    private static string Unique() => Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private static string Phone(string prefix) =>
        prefix + Guid.NewGuid().ToString("N")[..8];

    private async Task<PartnerCategory> CreateCategoryAsync(string suffix) =>
        await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer, new PartnerCategoryInput
        {
            Code = "OBC-" + suffix, NameAr = "تصنيف أرصدة " + suffix
        });

    private async Task<Item> CreateServiceAsync(string code, string name, Guid unitId) =>
        await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = code, NameAr = name, ItemType = "SERVICE", BaseUnitId = unitId,
            Units = new List<ItemUnitInput> { new() { UnitId = unitId, ConversionFactor = 1 } }
        });

    private async Task<(Guid Branch, PartnerCategory Category, Item ServiceA, Item ServiceB)>
        SetupAsync(string suffix)
    {
        var branch = await _db.CreateBranchAsync("OBB-" + suffix, "فرع الأرصدة " + suffix);
        await _db.CreateWarehouseAsync("OBW-" + suffix, "مخزن الأرصدة " + suffix, branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = "OBU" + suffix, NameAr = "وحدة الأرصدة " + suffix });
        var category = await CreateCategoryAsync(suffix);
        var serviceA = await CreateServiceAsync("OBS1" + suffix, "خدمة أولى " + suffix, unit.Id);
        var serviceB = await CreateServiceAsync("OBS2" + suffix, "خدمة ثانية " + suffix, unit.Id);
        return (branch, category, serviceA, serviceB);
    }

    private static PartnerInput CustomerInput(string name, PartnerCategory category, Guid branch,
        string phone) => new()
    {
        NameAr = name, CategoryId = category.Id, ScopeType = "BRANCH", BranchId = branch,
        Phone = phone, WhatsAppPhone = phone
    };

    [Fact]
    public async Task Opening_balances_show_as_reserved_services_and_outstanding_collections()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, serviceA, serviceB) = await SetupAsync(suffix);
        var input = CustomerInput("عميل الأرصدة " + suffix, category, branch, Phone("010"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = serviceA.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 50 });
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = serviceB.Id, Quantity = 1, UnitPrice = 200, PaidAmount = 200 });

        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        Assert.NotEqual(Guid.Empty, customer.Id);
        Assert.False(string.IsNullOrWhiteSpace(customer.Code));

        var bookings = await _db.BookingRepo.ListAsync(
            new BookingFilter { CustomerId = customer.Id }, new PageRequest { PageSize = 50 });
        Assert.Equal(2, bookings.Total);
        Assert.All(bookings.Items, b => Assert.Equal(BookingStatuses.Confirmed, b.Status));
        Assert.Contains(bookings.Items, b => b.TotalAmount == 200m && b.DepositAmount == 50m);
        Assert.Contains(bookings.Items, b => b.TotalAmount == 200m && b.DepositAmount == 200m);

        // الخدمات المحجوزة للتنفيذ: الكمية والمتبقي وقيمة المتبقي.
        var reservations = await new ReservationRepository(_db.Factory).ListAsync(
            new PageRequest { PageSize = 50 }, Array.Empty<Guid>(), customer.Id, true);
        Assert.Equal(2, reservations.Total);
        var rowA = Assert.Single(reservations.Items.Where(r => r.ItemId == serviceA.Id));
        Assert.Equal(2m, rowA.ReservedQty);
        Assert.Equal(2m, rowA.RemainingQty);
        Assert.Equal(200m, rowA.RemainingValue);

        // التحصيلات: الخدمة المسددة بالكامل لا تظهر كمستحقة، والمسدد لا يُحتسب مرتين.
        var outstanding = await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id);
        var collectible = Assert.Single(outstanding);
        Assert.Equal(200m, collectible.TotalAmount);
        Assert.Equal(50m, collectible.PaidAmount);
        Assert.Equal(150m, collectible.RemainingAmount);
        Assert.Contains("خدمة أولى", collectible.Services);
    }

    [Fact]
    public async Task Invalid_opening_balance_rolls_back_customer_and_bookings()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var (branch, category, serviceA, _) = await SetupAsync(suffix);
        var phone = Phone("012");
        var input = CustomerInput("عميل مرفوض " + suffix, category, branch, phone);
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = serviceA.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 10 });
        // مسدد أكبر من الإجمالي: يُرفض داخل المعاملة بعد إدراج العميل => تراجع كامل.
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = serviceA.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 500 });

        await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Partners().CreateAsync(actor, PartnerKind.Customer, input));

        Assert.False(await _db.PartnerRepo.PhoneExistsAsync(PartnerKind.Customer, phone, null));
    }

    [Fact]
    public async Task Later_collection_reduces_remaining_and_paid_stays_single()
    {
        var suffix = Unique();
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var (branch, category, serviceA, _) = await SetupAsync(suffix);
        var input = CustomerInput("عميل التحصيل " + suffix, category, branch, Phone("015"));
        input.OpeningBalances.Add(new ServiceOpeningBalanceInput
        { ServiceId = serviceA.Id, Quantity = 1, UnitPrice = 100, PaidAmount = 40 });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, input);

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "OBT" + suffix, NameAr = "خزينة الأرصدة " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        var before = Assert.Single(await _db.BookingCollections()
            .ListOutstandingAsync(actor, branch, customer.Id));
        Assert.Equal(40m, before.PaidAmount);
        Assert.Equal(60m, before.RemainingAmount);

        await _db.BookingCollections().CollectAsync(actor, new BookingCollectionInput
        {
            BranchId = branch, CustomerId = customer.Id, DocDate = DateTime.Today,
            Lines = { new BookingCollectionLineInput { BookingId = before.BookingId, Amount = 60 } },
            Payments =
            {
                new PosPaymentInput { TreasuryId = treasuryId, TreasuryMethodId = methodId, Amount = 60 }
            }
        });

        Assert.Empty(await _db.BookingCollections().ListOutstandingAsync(actor, branch, customer.Id));
        // المسدد سابقًا (40) بقي في deposit_amount ولم يُضاعف بالتحصيل اللاحق.
        var booking = (await _db.BookingRepo.ListAsync(
            new BookingFilter { CustomerId = customer.Id }, new PageRequest { PageSize = 10 })).Items
            .Single();
        Assert.Equal(40m, booking.DepositAmount);
    }
}
