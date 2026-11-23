using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>سلوك العمولتين: عمولة العميل في الإيصال وتضاف للخزينة، وعمولة المزود تُخصم.</summary>
public sealed class CollectionFeeBehaviorTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public CollectionFeeBehaviorTests(TestDb db) => _db = db;

    [Fact]
    public async Task Customer_fee_is_shown_and_added_while_provider_fee_is_hidden_and_deducted()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerAdvances,
            chart["1110"].Id);
        var branch = await _db.CreateBranchAsync("CF-B-1", "فرع العمولات");
        var warehouse = await _db.CreateWarehouseAsync("CF-W-1", "مخزن العمولات", branch);
        var item = await _db.CreateItemAsync("CF-IT-1", "صنف العمولات");
        await _db.PostReceiptAsync(item, branch, warehouse, 10, 50);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "CF-C-1", NameAr = "عميل العمولات" });
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "CF-T-1", NameAr = "خزينة العمولات",
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id,
            CollectionFeePercent = 5m, CollectionFeeAccountId = chart["5490"].Id,
            ProviderFeePercent = 2m, ProviderFeeAccountId = chart["5420"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدى" }, actor.UserId);

        var treasury = _db.TreasuryService();
        var shift = await treasury.OpenShiftAsync(actor, new ShiftInput
        { BranchId = branch, NormalShift = true });
        var receipt = await _db.Pos().CheckoutAsync(actor, new PosCheckoutInput
        {
            BranchId = branch, CustomerId = customer.Id, WarehouseId = warehouse,
            DocDate = DateTime.Today,
            Lines = { new PosLineInput { ItemId = item.Id, UnitId = item.BaseUnitId,
                Quantity = 1, UnitPrice = 100 } },
            Payments = { new PosPaymentInput { TreasuryId = treasuryId, Amount = 105 } }
        });
        Assert.Equal(5m, receipt.FeeTotal); // عمولة العميل 5% من 100

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var voucher = await connection.QuerySingleAsync<(decimal Total, decimal Fee,
            decimal ProviderFee)>("""
            SELECT total_amount, fee_total, provider_fee_total FROM vouchers
            WHERE id = @id
            """, new { id = receipt.Vouchers.Single().VoucherId });
        Assert.Equal(105m, voucher.Total);
        Assert.Equal(5m, voucher.Fee);
        // عمولة المزود تُحسب على إجمالي المدفوع (105 × 2% = 2.1) كما هو سلوك نقطة البيع.
        Assert.Equal(2.1m, voucher.ProviderFee);

        var report = await treasury.GetShiftReportAsync(actor, shift.Id);
        // سطر واحد لكل خزينة يجمع عمولة العميل (تُضاف) وعمولة المزود (تُخصم): 2.1 − 5 = −2.9.
        var feeLine = Assert.Single(report.Expenses, e => e.Description.Contains("عمولة التحصيل"));
        Assert.Equal(-2.9m, feeLine.Amount);
        Assert.Equal(-2.9m, report.ExpensesTotal);

        var closed = await treasury.CloseShiftAsync(actor, shift.Id,
            new List<ShiftCashCountInput>());
        Assert.Equal(102.9m, closed.ExpectedCash); // 105 − 2.1

        await treasury.ReviewShiftAsync(actor, shift.Id);
        var customerFee = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(credit - debit), 0) FROM journal_entry_lines
            WHERE account_id = @id
            """, new { id = chart["5490"].Id });
        var providerFee = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(debit - credit), 0) FROM journal_entry_lines
            WHERE account_id = @id
            """, new { id = chart["5420"].Id });
        var cash = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(debit - credit), 0) FROM journal_entry_lines
            WHERE account_id = @id
            """, new { id = chart["1101"].Id });
        Assert.Equal(5m, customerFee);
        Assert.Equal(2.1m, providerFee);
        Assert.Equal(102.9m, cash);
    }
}
