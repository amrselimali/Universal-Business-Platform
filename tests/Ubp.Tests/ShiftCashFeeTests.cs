using Ubp.Core.Models;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حركة اليوم في جزء عدّ النقدية = إجمالي المحصَّل (شامل عمولة العميل) − عمولة مزود الخدمة،
/// وتُحسب ديناميكيًا عند أي تسجيل/تعديل، مع سطر عمولة واحد لكل خزينة في المصروفات.
/// </summary>
public sealed class ShiftCashFeeTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftCashFeeTests(TestDb db) => _db = db;

    [Fact]
    public async Task Cash_count_expected_cash_reflects_both_fees_and_updates_on_every_change()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerAdvances,
            chart["1110"].Id);
        var branch = await _db.CreateBranchAsync("SCF-B-1", "فرع عمولات العد");
        var warehouse = await _db.CreateWarehouseAsync("SCF-W-1", "مخزن العد", branch);
        var item = await _db.CreateItemAsync("SCF-IT-1", "صنف العد");
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 50);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SCF-C-1", NameAr = "عميل العد" });
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "SCF-T-1", NameAr = "خزينة العد",
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id,
            CollectionFeePercent = 5m, CollectionFeeAccountId = chart["5490"].Id,
            ProviderFeePercent = 0m, ProviderFeeAmount = 2m,
            ProviderFeeAccountId = chart["5420"].Id
        }, actor.UserId);

        var treasury = _db.TreasuryService();
        var shift = await treasury.OpenShiftAsync(actor, new ShiftInput
        { BranchId = branch, NormalShift = true });

        // إيصال 1: إجمالي 105 ⇒ عمولة عميل 5، عمولة مزود ثابتة 2 ⇒ النقد المتوقع 103.
        await SellAsync(actor, branch, warehouse, item, customer, treasuryId, 100, 105);

        var report = await treasury.GetShiftReportAsync(actor, shift.Id);
        var count = Assert.Single(report.CashCounts, c => c.TreasuryId == treasuryId);
        // حركة اليوم = إجمالي المحصَّل 105 شامل عمولة العميل 5 − عمولة المزود 2 = 103.
        Assert.Equal(103m, count.Movement);
        Assert.Equal(103m, count.ExpectedCash);
        // سطر واحد للعمولتين معًا لهذه الخزينة: مزود 2 − عميل 5 = −3.
        var feeLine = Assert.Single(report.Expenses, e => e.Description.Contains("عمولة التحصيل"));
        Assert.Equal(-3m, feeLine.Amount);

        // العدّ 100: الفرق يُحسب على المتوقع الديناميكي (103) لا على قيمة مخزَّنة قديمة.
        await treasury.SaveCountedCashAsync(actor, shift.Id, treasuryId, 100);
        var saved = Assert.Single(await treasury.ListCashCountsAsync(actor, shift.Id),
            c => c.TreasuryId == treasuryId);
        Assert.Equal(103m, saved.ExpectedCash);
        Assert.Equal(100m, saved.CountedCash);
        Assert.Equal(-3m, saved.Variance);

        // إيصال إضافي 210: تُعاد الحسابات فورًا ⇒ حركة اليوم 103 + (210 − 2) = 311.
        await SellAsync(actor, branch, warehouse, item, customer, treasuryId, 200, 210);
        var reportAfter = await treasury.GetShiftReportAsync(actor, shift.Id);
        Assert.Equal(311m, Assert.Single(reportAfter.CashCounts,
            c => c.TreasuryId == treasuryId).Movement);

        await treasury.SaveCountedCashAsync(actor, shift.Id, treasuryId, 311);
        var after = Assert.Single(await treasury.ListCashCountsAsync(actor, shift.Id),
            c => c.TreasuryId == treasuryId);
        Assert.Equal(311m, after.ExpectedCash);
        Assert.Equal(311m, after.CountedCash);
        Assert.Equal(0m, after.Variance);

        // سند صرف 50 من نفس الخزينة: يُخصم من حركة اليوم ومن النقد المتوقع معًا.
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "SCF-SUP-1", NameAr = "مورد العد" });
        var methodId = (await _db.TreasuryRepo.ListMethodsAsync(treasuryId)).First().Id;
        await treasury.CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Payment, BranchId = branch, PartyType = "S",
            PartyId = supplier.Id, PartyName = supplier.NameAr, TreasuryId = treasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = methodId, Amount = 50 } }
        });

        var reportPaid = await treasury.GetShiftReportAsync(actor, shift.Id);
        var paidCount = Assert.Single(reportPaid.CashCounts, c => c.TreasuryId == treasuryId);
        Assert.Equal(261m, paidCount.Movement);     // 311 − 50
        Assert.Equal(261m, paidCount.ExpectedCash); // 311 − 50
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
