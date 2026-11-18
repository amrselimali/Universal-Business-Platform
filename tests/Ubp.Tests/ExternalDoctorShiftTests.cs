using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>شفت الدكتور الخارجي: النوع، العميل المربوط، الدفعة المقدمة، والتسوية الآلية.</summary>
public sealed class ExternalDoctorShiftTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public ExternalDoctorShiftTests(TestDb db) => _db = db;

    private async Task<(Guid Branch, Guid TreasuryId, Guid MethodId, Partner Doctor,
        Guid DoctorAccountId, Dictionary<string, Account> Chart)> SetupAsync(string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var settings = _db.AccountingSettings();
        await settings.SetDefaultAsync(actor, PostingKeys.CustomerAdvances, chart["1110"].Id);
        await settings.SetDefaultAsync(actor, PostingKeys.CustomerReceivable, chart["1110"].Id);
        await settings.SetDefaultAsync(actor, PostingKeys.SalesRevenue, chart["4100"].Id);
        var parent = chart["1100"];
        var doctorAccountId = Guid.CreateVersion7();
        await _db.AccountRepo.CreateAsync(doctorAccountId, new AccountInput
        {
            Code = "115" + suffix, NameAr = "الدكتور الخارجي " + suffix, ParentId = parent.Id,
            AccountType = AccountTypes.AssetReceivable
        }, parent.Path + "115" + suffix + "/", (short)(parent.Level + 1), actor.UserId);
        await settings.SetDefaultAsync(actor, PostingKeys.ExternalDoctor, doctorAccountId);
        var branch = await _db.CreateBranchAsync("ED-B-" + suffix, "فرع دكتور " + suffix);
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "ED-T-" + suffix, NameAr = "خزينة دكتور " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدى" }, actor.UserId);
        var category = await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer,
            new PartnerCategoryInput { Code = "ED-CAT-" + suffix, NameAr = "تصنيف دكتور" });
        var doctor = await _db.Partners().CreateAsync(actor, PartnerKind.Customer,
            new PartnerInput
            {
                NameAr = "دكتور خارجى " + suffix, CategoryId = category.Id,
                ScopeType = "BRANCH", BranchId = branch,
                Phone = "0100000" + suffix, WhatsAppPhone = "0110000" + suffix,
                IsExternalDoctor = true
            });
        return (branch, treasuryId, methodId, doctor, doctorAccountId, chart);
    }

    [Fact]
    public async Task Shift_type_requires_exactly_one_option_and_external_shift_needs_doctor()
    {
        var actor = await _db.AdminActorAsync();
        var s = await SetupAsync("1");
        var treasury = _db.TreasuryService();
        var none = await Assert.ThrowsAsync<ValidationAppException>(() =>
            treasury.OpenShiftAsync(actor, new ShiftInput { BranchId = s.Branch, NormalShift = false, ExternalDoctorShift = false }));
        Assert.Equal("validation.shift_type_required", none.Code);
        var both = await Assert.ThrowsAsync<ValidationAppException>(() =>
            treasury.OpenShiftAsync(actor, new ShiftInput { BranchId = s.Branch, NormalShift = true, ExternalDoctorShift = true }));
        Assert.Equal("validation.shift_type_required", both.Code);
        var noDoctor = await Assert.ThrowsAsync<ValidationAppException>(() =>
            treasury.OpenShiftAsync(actor, new ShiftInput { BranchId = s.Branch, NormalShift = false, ExternalDoctorShift = true }));
        Assert.Equal("validation.external_doctor_customer_required", noDoctor.Code);
        var shift = await treasury.OpenShiftAsync(actor, new ShiftInput { BranchId = s.Branch, NormalShift = false, ExternalDoctorShift = true,
            ExternalDoctorCustomerId = s.Doctor.Id
        });
        Assert.True(shift.IsExternalDoctor);
        Assert.Equal(s.Doctor.Id, shift.ExternalDoctorCustomerId);
    }

    [Fact]
    public async Task Advance_payment_and_automatic_doctor_settlement_balance_revenues_and_collections()
    {
        var actor = await _db.AdminActorAsync();
        var s = await SetupAsync("2");
        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput { BranchId = s.Branch, NormalShift = false, ExternalDoctorShift = true,
            ExternalDoctorCustomerId = s.Doctor.Id
        });
        var warehouse = await _db.CreateWarehouseAsync("ED-W-2", "مخزن دكتور", s.Branch);
        var item = await _db.CreateItemAsync("ED-IT-2", "خدمة دكتور");
        await using (var c = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await c.OpenAsync();
            await c.ExecuteAsync(
                "UPDATE items SET item_type='SERVICE', execution_mode='direct' WHERE id=@id",
                new { id = item.Id });
        }
        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = s.Branch, BookingDate = DateTime.Today, CustomerId = s.Doctor.Id,
            Lines = { new BookingLineInput { ItemId = item.Id, UnitId = item.BaseUnitId,
                WarehouseId = warehouse, Quantity = 2, UnitPrice = 100 } }
        });
        await _db.BookingService().ConfirmAsync(actor, booking.Id);
        var line = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single();
        await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = line.Id, Quantity = 2 });

        Assert.True(await _db.BookingCollections().CanTakeAdvanceAsync(actor, s.Branch,
            s.Doctor.Id));
        await _db.BookingCollections().CollectAdvanceAsync(actor, new AdvancePaymentInput
        {
            BranchId = s.Branch, CustomerId = s.Doctor.Id, TreasuryId = s.TreasuryId,
            TreasuryMethodId = s.MethodId, Amount = 50, Notes = "دفعة مقدمة اختبار"
        });

        var preview = await _db.TreasuryService().GetExternalDoctorSettlementAsync(actor,
            shift.Id);
        Assert.Equal(200m, preview.Revenues);
        Assert.Equal(50m, preview.Collections);
        Assert.Equal(150m, preview.Amount);

        await _db.TreasuryService().CloseShiftAsync(actor, shift.Id,
            new List<ShiftCashCountInput>(),
            new ShiftSettlementInput { Mode = ShiftSettlementModes.Doctor });
        var closed = await _db.TreasuryService().GetShiftReportAsync(actor, shift.Id);
        Assert.Equal(150m, closed.Shift.SettlementAmount);
        Assert.NotNull(closed.Shift.SettlementVoucherId);
        Assert.Equal(200m, closed.CollectionsTotal); // 50 دفعة مقدمة + 150 تسوية = 200

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var voucher = await connection.QuerySingleAsync<(decimal Total, string Status)>(
            "SELECT total_amount, status FROM vouchers WHERE id = @id",
            new { id = closed.Shift.SettlementVoucherId });
        Assert.Equal(150m, voucher.Total);
        Assert.Equal("posted", voucher.Status);
        var doctorDebit = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM journal_entry_lines l
            JOIN journal_entries e ON e.id = l.entry_id
            WHERE l.account_id = @account AND e.source_id = @voucherId
            """, new { account = s.DoctorAccountId, voucherId = closed.Shift.SettlementVoucherId });
        Assert.Equal(150m, doctorDebit);
    }
}
