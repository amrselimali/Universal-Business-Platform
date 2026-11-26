using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// ملخص تقرير الشفت: عدد عملاء بلا متابعة/حجز مستقبلي، وعدد حجوزات الغد المؤكدة فقط،
/// ومستخدم إقفال الشفت (اسم ملف تصدير PDF) — 0094.
/// </summary>
public sealed class ShiftReportSummaryTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftReportSummaryTests(TestDb db) => _db = db;

    [Fact]
    public async Task Report_counts_idle_customers_and_confirmed_tomorrow_bookings()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SRS-B", "فرع ملخص الشفت");
        var busy = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        {
            Code = "SRS-C-1", NameAr = "عميل عنده حجز", ScopeType = "BRANCH", BranchId = branch
        });
        await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        {
            Code = "SRS-C-2", NameAr = "عميل بلا متابعة", ScopeType = "BRANCH", BranchId = branch
        });

        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO bookings (id, branch_id, doc_no, booking_date, starts_at, status, customer_id,
                    source, total_amount)
                VALUES (@confirmedId, @branch, 'SRS-BK-1', current_date, now() + interval '1 day',
                        'confirmed', @customerId, 'manual', 100),
                       (@cancelledId, @branch, 'SRS-BK-2', current_date, now() + interval '1 day',
                        'cancelled', @customerId, 'manual', 50),
                       (@draftId, @branch, 'SRS-BK-3', current_date, now() + interval '1 day',
                        'draft', @customerId, 'manual', 75)
                """, new
            {
                confirmedId = Guid.CreateVersion7(), cancelledId = Guid.CreateVersion7(),
                draftId = Guid.CreateVersion7(), branch, customerId = busy.Id
            });
        }

        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = branch });
        var report = await shifts.GetShiftReportAsync(actor, shift.Id);

        // حجوزات الغد: المؤكد فقط (المُلغى مستبعد)، وغير المؤكد بجانبه (مسودة).
        Assert.Equal(1, report.TomorrowBookingsCount);
        Assert.Equal(1, report.TomorrowBookingsUnconfirmedCount);
        // عميل واحد فقط بلا متابعة أو حجز مستقبلي.
        Assert.Equal(1, report.IdleCustomersCount);

        await shifts.CloseShiftAsync(actor, shift.Id, new List<ShiftCashCountInput>());
        var closed = await shifts.GetShiftReportAsync(actor, shift.Id);

        // مستخدم الإقفال يُحفظ ليُستخدم في اسم ملف التصدير الافتراضي.
        Assert.Equal("admin", closed.Shift.ClosedByName);
        Assert.NotNull(closed.Shift.ClosedAt);
    }

    /// <summary>
    /// ملاحظات التقرير (حجوزات اليوم التالي والمواعيد) مربوطة **بيوم الشفت** لا بتاريخ فتح
    /// التقرير: إرجاع يوم الشفت للخلف يجعل «يوم الشفت + 1» = اليوم ⇒ لا حجوزات غد — 0220.
    /// </summary>
    [Fact]
    public async Task Tomorrow_counts_follow_the_shift_day_not_the_view_date()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SRS-D", "فرع يوم الشفت");
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SRS-D-C", NameAr = "عميل يوم الشفت", ScopeType = "BRANCH", BranchId = branch });

        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO bookings (id, branch_id, doc_no, booking_date, starts_at, status,
                    customer_id, source, total_amount)
                VALUES (@id, @branch, 'SRS-D-BK', current_date, now() + interval '1 day',
                        'confirmed', @customerId, 'manual', 100)
                """, new { id = Guid.CreateVersion7(), branch, customerId = customer.Id });
        }

        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor,
            new ShiftInput { NormalShift = true, BranchId = branch });
        Assert.Equal(1, (await shifts.GetShiftReportAsync(actor, shift.Id)).TomorrowBookingsCount);

        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync(
                "UPDATE cashier_shifts SET opened_at = opened_at - interval '1 day' " +
                "WHERE id = @id", new { id = shift.Id });
        }

        var backdated = await shifts.GetShiftReportAsync(actor, shift.Id);
        Assert.Equal(0, backdated.TomorrowBookingsCount);
        Assert.Equal(0, backdated.TomorrowAppointments.Count);
    }

    /// <summary>
    /// «حجوزات اليوم التالي» تُحسب بتاريخ **الموعد** (starts_at) لا تاريخ إنشاء الحجز:
    /// حجز مسجَّل اليوم بموعد غدًا يُحتسب، وحجز بلا موعد يُحتسب بتاريخه.
    /// </summary>
    [Fact]
    public async Task Tomorrow_bookings_use_the_appointment_date_not_the_document_date()
    {
        var actor = await _db.AdminActorAsync();
        await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SRS-E", "فرع موعد الغد");
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SRS-E-C", NameAr = "عميل موعد الغد", ScopeType = "BRANCH", BranchId = branch });

        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO bookings (id, branch_id, doc_no, booking_date, starts_at, status,
                    customer_id, source, total_amount)
                VALUES (@withStart, @branch, 'SRS-E-BK1', current_date,
                        now() + interval '1 day', 'confirmed', @customerId, 'manual', 100),
                       (@noStart, @branch, 'SRS-E-BK2', current_date, NULL, 'confirmed',
                        @customerId, 'manual', 50)
                """, new
            {
                withStart = Guid.CreateVersion7(), noStart = Guid.CreateVersion7(), branch,
                customerId = customer.Id
            });
        }

        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor,
            new ShiftInput { NormalShift = true, BranchId = branch });

        // حجز واحد فقط موعده غدًا؛ الحجز بلا موعد تاريخه اليوم فلا يُحتسب.
        Assert.Equal(1, (await shifts.GetShiftReportAsync(actor, shift.Id)).TomorrowBookingsCount);
    }

    [Fact]
    public async Task Counted_cash_is_saved_while_the_shift_is_open()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SRS-B2", "فرع النقد المعدود");
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "SRS-T2", NameAr = "خزينة النقد المعدود",
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);

        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = branch });

        // يُحفظ فور الكتابة (بلا إغلاق الشفت) — 0095.
        await shifts.SaveCountedCashAsync(actor, shift.Id, treasuryId, 190);

        var first = await shifts.GetShiftReportAsync(actor, shift.Id);
        var row = Assert.Single(first.CashCounts);
        Assert.Equal(190m, row.CountedCash);

        // إعادة فتح التقرير لا تُغيّر القيمة المسجّلة.
        var second = await shifts.GetShiftReportAsync(actor, shift.Id);
        Assert.Equal(190m, Assert.Single(second.CashCounts).CountedCash);
    }

    /// <summary>
    /// اسم الخزينة في جدولي التحصيلات والمصروفات = نفسه في جدول عدّ النقدية «الكود — الاسم».
    /// </summary>
    [Fact]
    public async Task Report_shows_the_treasury_code_and_name_like_the_cash_count_table()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SRS-B3", "فرع اسم الخزينة");
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "SRS-T3", NameAr = "خزينة اسم التقرير",
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SRS-C3", NameAr = "عميل اسم الخزينة", ScopeType = "BRANCH", BranchId = branch });
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "SRS-S3", NameAr = "مورد اسم الخزينة" });

        var shifts = _db.TreasuryService();
        var shift = await shifts.OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = branch });

        // إيصال قبض من الخزينة.
        await shifts.CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = customer.Id, PartyName = customer.NameAr,
            TreasuryId = treasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = methodId, Amount = 100 } }
        });

        // مصروف تشغيلي مسودة على نفس الخزينة.
        var expenseId = Guid.CreateVersion7();
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO operating_expenses
                    (id, branch_id, doc_date, supplier_id, treasury_id, treasury_method_id,
                     status, total_amount)
                VALUES (@id, @branch, current_date, @supplier, @treasury, @method, 'DRAFT', 60)
                """, new { id = expenseId, branch, supplier = supplier.Id, treasury = treasuryId,
                    method = methodId });
            await connection.ExecuteAsync("""
                INSERT INTO operating_expense_lines
                    (expense_id, line_no, account_id, description, quantity, unit_price, amount)
                VALUES (@id, 1, @account, 'مصروف اختبار اسم الخزينة', 1, 60, 60)
                """, new { id = expenseId, account = chart["5300"].Id });
        }

        var report = await shifts.GetShiftReportAsync(actor, shift.Id);
        var cash = Assert.Single(report.CashCounts);
        Assert.Equal("SRS-T3", cash.TreasuryCode);

        var collected = Assert.Single(report.Lines, l => l.Source == "تحصيل/قبض");
        Assert.Equal(cash.TreasuryCode, collected.TreasuryCode);
        Assert.Equal(cash.TreasuryName, collected.TreasuryName);

        var expense = Assert.Single(report.Expenses);
        Assert.Equal(cash.TreasuryCode, expense.TreasuryCode);
        Assert.Equal(cash.TreasuryName, expense.TreasuryName);
    }
}
