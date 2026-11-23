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

    [Fact]
    public async Task Advance_payment_uses_the_treasury_fee_and_records_it_in_the_shift_report()
    {
        var actor = await _db.AdminActorAsync();
        var s = await SetupAsync("3");
        // عمولة تحصيل الخزينة 10% من إجمالي المدفوع (مثل إيصال POS).
        await _db.TreasuryService().SetCollectionFeeAsync(actor, s.TreasuryId, 10m, null);
        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        {
            BranchId = s.Branch, NormalShift = false, ExternalDoctorShift = true,
            ExternalDoctorCustomerId = s.Doctor.Id
        });

        // 110 إجمالي المدفوع بنسبة 10% ⇒ عمولة 10 وصافي مسدد 100.
        var result = await _db.BookingCollections().CollectAdvanceAsync(actor,
            new AdvancePaymentInput
            {
                BranchId = s.Branch, CustomerId = s.Doctor.Id, TreasuryId = s.TreasuryId,
                Amount = 110, Notes = "دفعة مقدمة عمولة"
            });
        Assert.Equal(110m, result.Amount);
        Assert.Equal(10m, result.Fee);
        Assert.Equal(100m, result.Net);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var voucher = await connection.QuerySingleAsync<(decimal Total, decimal Fee, string Status)>(
            "SELECT total_amount, fee_total, status FROM vouchers WHERE id = @id",
            new { id = result.VoucherId });
        Assert.Equal(110m, voucher.Total);
        Assert.Equal(10m, voucher.Fee);
        Assert.Equal(10m, await connection.ExecuteScalarAsync<decimal>(
            "SELECT fee_amount FROM voucher_lines WHERE voucher_id = @id",
            new { id = result.VoucherId }));

        // الإيصال يُسجَّل في شاشة إيصالات تحصيل POS ويُفتح كإيصال تحصيل عادي (معاينة/طباعة) — 0215.
        var list = await _db.Pos().ListReceiptsAsync(actor, s.Branch, null, null, 100);
        var listed = Assert.Single(list, r => r.Id == result.VoucherId);
        Assert.Equal(s.Doctor.NameAr, listed.PartyName);
        Assert.Contains("دفعة مقدمة", listed.Description);

        var detail = await _db.PosRepo.GetReceiptDetailAsync(result.VoucherId);
        Assert.NotNull(detail);
        Assert.True(detail!.IsAdvanceReceipt);
        Assert.Equal(110m, detail.GrandDue);
        Assert.Equal(110m, detail.PaidAmount);
        Assert.Equal(0m, detail.RemainingDue);
        Assert.Equal(100m, Assert.Single(detail.DisplayLines).Value);

        // تقرير الشفت: سطر تحصيل بالإجمالي + سطر مصروف عمولة التحصيل بالسالب (كالإيصال العادي).
        var report = await _db.TreasuryService().GetShiftReportAsync(actor, shift.Id);
        var receipt = Assert.Single(report.Lines, l => l.Source == "دفعة مقدمة");
        Assert.Equal(110m, receipt.Collected);
        var feeLine = Assert.Single(report.Expenses,
            e => e.Description.Contains("عمولة التحصيل"));
        Assert.Equal(-10m, feeLine.Amount);
    }

    [Fact]
    public async Task Closing_a_doctor_shift_uses_a_company_wide_treasury_when_the_branch_has_none()
    {
        var actor = await _db.AdminActorAsync();
        var s = await SetupAsync("4");
        // تُعطَّل خزينة الفرع وتبقى خزينة عامة للشركة فقط — الإغلاق يجب ألا يرفض.
        await _db.TreasuryRepo.SetTreasuryActiveAsync(s.TreasuryId, false, actor.UserId);
        var companyTreasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(companyTreasuryId, new TreasuryInput
        {
            BranchId = s.Branch, IsCompanyWide = true, Code = "ED-CW-4",
            NameAr = "خزينة الشركة", TreasuryType = TreasuryTypes.Cash,
            AccountId = s.Chart["1101"].Id
        }, actor.UserId);

        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        {
            BranchId = s.Branch, NormalShift = false, ExternalDoctorShift = true,
            ExternalDoctorCustomerId = s.Doctor.Id
        });
        var warehouse = await _db.CreateWarehouseAsync("ED-CW-W4", "مخزن شركة", s.Branch);
        var item = await _db.CreateItemAsync("ED-CW-IT4", "خدمة شركة");
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

        // تسوية على حساب الدكتور بلا اختيار خزينة: تُستخدم خزينة الشركة بدل رسالة «لا توجد خزينة».
        var closed = await _db.TreasuryService().CloseShiftAsync(actor, shift.Id,
            new List<ShiftCashCountInput>(),
            new ShiftSettlementInput { Mode = ShiftSettlementModes.Doctor });
        Assert.Equal(ShiftStatuses.Closed, closed.Status);
        Assert.Equal(200m, closed.SettlementAmount);
        Assert.NotNull(closed.SettlementVoucherId);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        Assert.Equal(companyTreasuryId, await connection.ExecuteScalarAsync<Guid>(
            "SELECT treasury_id FROM vouchers WHERE id = @id",
            new { id = closed.SettlementVoucherId }));
    }
}
