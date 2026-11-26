using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// عدّ النقدية في تقرير الشفت: «النقد المتوقع = أول المدة + حركة اليوم» دائمًا،
/// وتُعاد الحسابات للشفت المغلقة أيضًا بعد أي تعديل (تعديل الشفت/الإيصالات/المصروفات/السلف).
/// </summary>
public sealed class ShiftExpectedCashTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftExpectedCashTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid TreasuryId, Guid MethodId, Guid CustomerId,
        Guid SupplierId, Guid EmployeeId, Dictionary<string, Account> Chart, Guid ShiftId);

    private async Task<Fixture> SetupAsync(string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await TreasuryFixtures.MapDefaultsAsync(_db, actor, chart);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CashClearing,
            chart["1130"].Id);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.EmployeeAdvances,
            chart["5300"].Id);

        var branch = await _db.CreateBranchAsync("SEC-B-" + suffix, "فرع النقد المتوقع " + suffix);
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "SEC-T-" + suffix, NameAr = "خزينة متوقع " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SEC-C-" + suffix, NameAr = "عميل متوقع " + suffix });
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "SEC-S-" + suffix, NameAr = "مورد متوقع " + suffix });
        var employee = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employee, new EmployeeInput
        { Code = "SEC-E-" + suffix, NameAr = "موظف متوقع " + suffix }, actor.UserId);

        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = branch });
        return new Fixture(branch, treasuryId, methodId, customer.Id, supplier.Id, employee,
            chart, shift.Id);
    }

    private async Task<Guid> CreateReceiptAsync(Fixture f, decimal amount)
    {
        var actor = await _db.AdminActorAsync();
        var voucher = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = f.CustomerId, PartyName = "عميل متوقع",
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = amount } }
        });
        return voucher.Id;
    }

    private static async Task<Guid> LineIdAsync(Guid voucherId)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<Guid>(
            "SELECT id FROM voucher_lines WHERE voucher_id = @id ORDER BY line_no LIMIT 1",
            new { id = voucherId });
    }

    [Fact]
    public async Task Expected_cash_is_opening_plus_movement_and_recalculates_after_edits()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("1");

        // إيصال 300 − سند صرف 100 − تسليم نقدية 50 − سلفة 20 = حركة 130.
        var receiptId = await CreateReceiptAsync(f, 300);
        await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Payment, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "S", PartyId = f.SupplierId, PartyName = "مورد متوقع",
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = 100 } }
        });
        await _db.TreasuryRepo.CreateCashHandoverAsync(Guid.CreateVersion7(),
            new CashHandoverInput
            {
                BranchId = f.Branch, TreasuryId = f.TreasuryId, ClearingAccountId = Guid.Empty,
                Amount = 50, DocDate = DateTime.Today
            }, actor.UserId);
        await new EmployeeAdvanceRepository(_db.Factory).CreateAndPostAsync(
            new EmployeeAdvanceInput
            {
                BranchId = f.Branch, EmployeeId = f.EmployeeId, TreasuryId = f.TreasuryId,
                ChargeAccountId = f.Chart["5300"].Id, Amount = 20, DocDate = DateTime.Today
            }, actor.UserId);

        var report = await _db.TreasuryService().GetShiftReportAsync(actor, f.ShiftId);
        var count = Assert.Single(report.CashCounts);
        Assert.Equal(130m, count.Movement);
        // المعادلة المطلوبة: النقد المتوقع = أول المدة + حركة اليوم.
        Assert.Equal(count.OpeningCash + count.Movement, count.ExpectedCash);

        // إغلاق الشفت: العمودان يظلان متطابقين بعد الإغلاق.
        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput>
            { new() { TreasuryId = f.TreasuryId, CountedCash = 130 } });
        var closed = Assert.Single((await _db.TreasuryService().GetShiftReportAsync(actor,
            f.ShiftId)).CashCounts);
        Assert.Equal(closed.OpeningCash + closed.Movement, closed.ExpectedCash);
        Assert.Equal(130m, closed.ExpectedCash);
        Assert.Equal(0m, closed.Variance);

        // تعديل قيمة الإيصال من «تعديل الشفت» بعد الإغلاق ⇒ يُعاد احتساب المتوقع والفرق.
        var lineId = await LineIdAsync(receiptId);
        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = f.ShiftId, EntityType = "voucher", DocId = receiptId,
            LineId = lineId, Field = "amount", NewValue = "400"
        });
        var edited = Assert.Single((await _db.TreasuryService().GetShiftReportAsync(actor,
            f.ShiftId)).CashCounts);
        Assert.Equal(230m, edited.Movement);       // 400 − 100 − 50 − 20
        Assert.Equal(edited.OpeningCash + edited.Movement, edited.ExpectedCash);
        Assert.Equal(230m, edited.ExpectedCash);
        Assert.Equal(-100m, edited.Variance);      // 130 معدود − 230 متوقع
    }
}
