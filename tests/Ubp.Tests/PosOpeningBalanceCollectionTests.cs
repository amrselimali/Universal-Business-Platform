using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// الخدمات المحجوزة الناتجة عن الأرصدة الافتتاحية تظهر في نافذة التحصيل بنقطة البيع
/// بأي مبلغ متبقٍ ولو صغيرًا — 0101.
/// </summary>
public sealed class PosOpeningBalanceCollectionTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public PosOpeningBalanceCollectionTests(TestDb db) => _db = db;

    [Fact]
    public async Task Opening_balance_services_are_listed_in_pos_collection()
    {
        var actor = await _db.AdminActorAsync();
        var branch = await _db.CreateBranchAsync("OB-B", "فرع أرصدة");
        await _db.CreateWarehouseAsync("OB-W", "مخزن أرصدة", branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
            { Code = "OB-U", NameAr = "وحدة أرصدة" });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "OB-SV", NameAr = "خدمة أرصدة", ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });

        var category = await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer,
            new PartnerCategoryInput { Code = "OBC", NameAr = "تصنيف أرصدة" });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, new PartnerInput
        {
            Code = "OB-C", NameAr = "عميل أرصدة", Phone = "01000000001", WhatsAppPhone = "01000000001",
            ScopeType = "BRANCH", BranchId = branch, CategoryId = category.Id,
            OpeningBalances =
            {
                new ServiceOpeningBalanceInput
                {
                    ServiceId = service.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 150
                }
            }
        });

        var rows = await _db.BookingCollections().ListOutstandingAsync(actor, branch,
            customer.Id);
        var row = Assert.Single(rows);
        Assert.Equal(50, row.RemainingAmount);
        Assert.Contains("خدمة أرصدة", row.Services);
    }

    [Fact]
    public async Task Tiny_remaining_amount_is_still_listed()
    {
        var actor = await _db.AdminActorAsync();
        var branch = await _db.CreateBranchAsync("OB2-B", "فرع أرصدة صغيرة");
        await _db.CreateWarehouseAsync("OB2-W", "مخزن أرصدة صغيرة", branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
            { Code = "OB2-U", NameAr = "وحدة أرصدة صغيرة" });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "OB2-SV", NameAr = "خدمة أرصدة صغيرة", ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });

        var category = await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer,
            new PartnerCategoryInput { Code = "OBC2", NameAr = "تصنيف أرصدة صغيرة" });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer, new PartnerInput
        {
            Code = "OB2-C", NameAr = "عميل أرصدة صغيرة", Phone = "01000000002", WhatsAppPhone = "01000000002",
            ScopeType = "BRANCH", BranchId = branch, CategoryId = category.Id,
            OpeningBalances =
            {
                new ServiceOpeningBalanceInput
                {
                    ServiceId = service.Id, Quantity = 1, UnitPrice = 10, PaidAmount = 9.99m
                }
            }
        });

        var rows = await _db.BookingCollections().ListOutstandingAsync(actor, branch,
            customer.Id);
        var row = Assert.Single(rows);
        Assert.Equal(0.01m, row.RemainingAmount);
    }
}