using Ubp.Core.Models;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// عزل بيانات الفروع في تقرير الشفت: الخزينة العامة (خزينة الشركة) مشتركة بين الفروع،
/// لكن حركة اليوم والنقد المتوقع لكل فرع تُحسب من سندات فرع الشفت فقط.
/// </summary>
public sealed class ShiftBranchIsolationTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftBranchIsolationTests(TestDb db) => _db = db;

    [Fact]
    public async Task Shift_cash_counts_use_only_the_shift_branch_on_a_company_wide_treasury()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerAdvances,
            chart["1110"].Id);
        var branchA = await _db.CreateBranchAsync("SBI-B-A", "فرع أول");
        var branchB = await _db.CreateBranchAsync("SBI-B-B", "فرع ثانٍ");
        var warehouseA = await _db.CreateWarehouseAsync("SBI-W-A", "مخزن أول", branchA);
        var warehouseB = await _db.CreateWarehouseAsync("SBI-W-B", "مخزن ثانٍ", branchB);
        var itemA = await _db.CreateItemAsync("SBI-IT-A", "صنف أول");
        var itemB = await _db.CreateItemAsync("SBI-IT-B", "صنف ثانٍ");
        await _db.PostReceiptAsync(itemA, branchA, warehouseA, 10, 50);
        await _db.PostReceiptAsync(itemB, branchB, warehouseB, 10, 50);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SBI-C-1", NameAr = "عميل مشترك" });

        // خزينة عامة للشركة يستخدمها الفرعان معًا.
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branchA, IsCompanyWide = true, Code = "SBI-T-1",
            NameAr = "خزينة الشركة", TreasuryType = TreasuryTypes.Cash,
            AccountId = chart["1101"].Id, CollectionFeePercent = 5m,
            CollectionFeeAccountId = chart["5490"].Id
        }, actor.UserId);

        var treasury = _db.TreasuryService();
        var shiftA = await treasury.OpenShiftAsync(actor, new ShiftInput
        { BranchId = branchA, NormalShift = true });
        var shiftB = await treasury.OpenShiftAsync(actor, new ShiftInput
        { BranchId = branchB, NormalShift = true });

        // بيع 105 في الفرع الأول، وبيع 210 في الفرع الثاني على نفس الخزينة العامة.
        await SellAsync(actor, branchA, warehouseA, itemA, customer, treasuryId, 100, 105);
        await SellAsync(actor, branchB, warehouseB, itemB, customer, treasuryId, 200, 210);

        var reportA = await treasury.GetShiftReportAsync(actor, shiftA.Id);
        var countA = Assert.Single(reportA.CashCounts, c => c.TreasuryId == treasuryId);
        Assert.Equal(105m, countA.Movement);
        Assert.Equal(105m, countA.ExpectedCash);

        var reportB = await treasury.GetShiftReportAsync(actor, shiftB.Id);
        var countB = Assert.Single(reportB.CashCounts, c => c.TreasuryId == treasuryId);
        Assert.Equal(210m, countB.Movement);
        Assert.Equal(210m, countB.ExpectedCash);

        // إغلاق شفت الفرع الأول يحسب نقد فرعه فقط (105) لا مجموع الفروع.
        var closedA = await treasury.CloseShiftAsync(actor, shiftA.Id,
            new List<ShiftCashCountInput>());
        Assert.Equal(105m, closedA.ExpectedCash);
    }

    private async Task SellAsync(ActorContext actor, Guid branch, Guid warehouse, Item item,
        Partner customer, Guid treasuryId, decimal unitPrice, decimal paid)
        => await _db.Pos().CheckoutAsync(actor, new PosCheckoutInput
        {
            BranchId = branch, CustomerId = customer.Id, WarehouseId = warehouse,
            DocDate = DateTime.Today,
            Lines = { new PosLineInput { ItemId = item.Id, UnitId = item.BaseUnitId,
                Quantity = 1, UnitPrice = unitPrice } },
            Payments = { new PosPaymentInput { TreasuryId = treasuryId, Amount = paid } }
        });
}
