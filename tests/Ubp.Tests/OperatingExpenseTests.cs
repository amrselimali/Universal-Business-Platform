using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// مصروفات تشغيلية غير مرتبطة بدورة الحجز: سطور على شجرة الحسابات، سداد نقدي (سند صرف) أو آجل
/// على حساب المورد، وبنود مخزنية اختيارية تُستلم في المخزن وتُرحّل على حساب المخزون.
/// </summary>
public sealed class OperatingExpenseTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public OperatingExpenseTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid Warehouse, Item Item, Partner Supplier,
        Account ExpenseAccount, Account InventoryAccount, Guid TreasuryId, Guid CashMethod);

    private async Task<Fixture> SetupAsync(string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("EXP-B-" + suffix, "فرع مصروفات " + suffix);
        var warehouse = await _db.CreateWarehouseAsync("EXP-W-" + suffix,
            "مخزن مصروفات " + suffix, branch);
        var item = await _db.CreateItemAsync("EXP-IT-" + suffix, "صنف مصروفات " + suffix);
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "EXP-S-" + suffix, NameAr = "مورد مصروفات " + suffix });

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "EXP-T-" + suffix, NameAr = "خزينة مصروفات " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var cash = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(cash, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        // تمهيد رصيد الخزينة: لا يُسمح بالصرف بدون رصيد يغطي قيمة المصروف.
        await _db.PostBalancedEntryAsync(branch, DateTime.Today, chart["1101"].Id,
            chart["4100"].Id, 100000);

        return new Fixture(branch, warehouse, item, supplier, chart["5300"], chart["2150"],
            treasuryId, cash);
    }

    private OperatingExpenseInput Input(Fixture f, OperatingExpenseLineInput line) => new()
    {
        BranchId = f.Branch, DocDate = DateTime.Today, SupplierId = f.Supplier.Id,
        Lines = { line }
    };

    private static OperatingExpenseLineInput ExpenseLine(Account account, decimal quantity,
        decimal price, string? description = "مصروف تشغيلي") => new()
    {
        AccountId = account.Id, Description = description, Quantity = quantity, UnitPrice = price
    };

    [Fact]
    public async Task Expense_on_credit_posts_the_chosen_account_and_the_supplier_payable()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("1");

        var created = await _db.OperatingExpenses().CreateAsync(actor,
            Input(f, ExpenseLine(f.ExpenseAccount, 1, 500)));
        Assert.Equal(OperatingExpenseStatuses.Draft, created.Status);
        Assert.Equal(500m, created.TotalAmount);

        var posted = await _db.OperatingExpenses().PostAsync(actor, created.Id);

        Assert.Equal(OperatingExpenseStatuses.Posted, posted.Status);
        Assert.StartsWith("EXP-", posted.DocNo);
        Assert.Null(posted.VoucherId);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var entries = (await connection.QueryAsync<(string Code, decimal Debit, decimal Credit)>(
            """
            SELECT a.code, l.debit, l.credit FROM journal_entry_lines l
            JOIN accounts a ON a.id = l.account_id
            WHERE l.entry_id = @entryId
            """, new { entryId = posted.JournalEntryId })).ToList();
        Assert.Contains(entries, l => l.Code == "5300" && l.Debit == 500m);
        Assert.Contains(entries, l => l.Code == "2100" && l.Credit == 500m);

        var supplierBalance = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM journal_entry_lines l
            JOIN accounts a ON a.id = l.account_id
            WHERE a.code = '2100' AND l.supplier_id = @supplierId
            """, new { supplierId = f.Supplier.Id });
        Assert.Equal(-500m, supplierBalance);
    }

    [Fact]
    public async Task Expense_paid_from_a_treasury_posts_a_payment_voucher_and_clears_the_supplier()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("2");

        var input = Input(f, ExpenseLine(f.ExpenseAccount, 2, 250));
        input.TreasuryId = f.TreasuryId;
        input.TreasuryMethodId = f.CashMethod;

        var created = await _db.OperatingExpenses().CreateAsync(actor, input);
        var posted = await _db.OperatingExpenses().PostAsync(actor, created.Id);

        Assert.True(posted.IsPaid);
        Assert.NotNull(posted.VoucherId);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();

        var voucher = await connection.QuerySingleAsync<(string Status, decimal Total, string DocNo)>(
            "SELECT status AS Status, total_amount AS Total, doc_no AS DocNo " +
            "FROM vouchers WHERE id = @id", new { id = posted.VoucherId });
        Assert.Equal("posted", voucher.Status);
        Assert.Equal(500m, voucher.Total);
        Assert.StartsWith("PAY-", voucher.DocNo);

        var cash = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM journal_entry_lines l
            JOIN accounts a ON a.id = l.account_id
            WHERE a.code = '1101'
              AND l.entry_id = (SELECT journal_entry_id FROM vouchers WHERE id = @id)
            """, new { id = posted.VoucherId });
        Assert.Equal(-500m, cash);

        var supplierBalance = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM journal_entry_lines l
            JOIN accounts a ON a.id = l.account_id
            WHERE a.code = '2100' AND l.supplier_id = @supplierId
            """, new { supplierId = f.Supplier.Id });
        Assert.Equal(0m, supplierBalance);
    }

    [Fact]
    public async Task Stock_line_receives_the_item_and_posts_the_inventory_account()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("3");

        var line = ExpenseLine(f.InventoryAccount, 3, 50, "شراء مستلزمات");
        line.ItemId = f.Item.Id;
        line.UnitId = f.Item.BaseUnitId;
        line.WarehouseId = f.Warehouse;

        var created = await _db.OperatingExpenses().CreateAsync(actor, Input(f, line));
        var posted = await _db.OperatingExpenses().PostAsync(actor, created.Id);

        Assert.NotNull(posted.StockDocumentId);
        Assert.Equal(150m, posted.TotalAmount);
        Assert.Equal(3m, await _db.OnHandAsync(f.Item.Id, f.Warehouse));

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM stock_movements WHERE item_id = @id AND direction = 'IN'",
            new { id = f.Item.Id }));

        var entries = (await connection.QueryAsync<(string Code, decimal Debit, decimal Credit)>(
            """
            SELECT a.code, l.debit, l.credit FROM journal_entry_lines l
            JOIN accounts a ON a.id = l.account_id
            WHERE l.entry_id = @entryId
            """, new { entryId = posted.JournalEntryId })).ToList();
        Assert.Contains(entries, l => l.Code == "2150" && l.Debit == 150m);
        Assert.Contains(entries, l => l.Code == "2100" && l.Credit == 150m);
    }

    [Fact]
    public async Task Saved_expense_appears_in_the_list()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("5");

        var created = await _db.OperatingExpenses()
            .CreateAsync(actor, Input(f, ExpenseLine(f.ExpenseAccount, 1, 100)));

        var rows = await _db.OperatingExpenses()
            .ListAsync(actor, null, null, null, null, null);
        var row = Assert.Single(rows.Where(r => r.Id == created.Id));
        Assert.Equal("مورد مصروفات 5", row.SupplierName);
        Assert.Equal(100m, row.TotalAmount);
        Assert.False(row.IsPaid);
    }

    [Fact]
    public async Task Expense_validation_rejects_non_postable_accounts_and_missing_supplier()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("4");
        var chart = await _db.SeedAccountingAsync();

        var groupAccount = new OperatingExpenseLineInput
        { AccountId = chart["5000"].Id, Quantity = 1, UnitPrice = 10 };
        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.OperatingExpenses().CreateAsync(actor, Input(f, groupAccount)));
        Assert.Equal("validation.expense_account_not_postable", error.Code);

        var noSupplier = Input(f, ExpenseLine(f.ExpenseAccount, 1, 10));
        noSupplier.SupplierId = Guid.Empty;
        var supplierError = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.OperatingExpenses().CreateAsync(actor, noSupplier));
        Assert.Equal("validation.required_fields", supplierError.Code);
    }

    /// <summary>
    /// لا يُسمح بالصرف من خزينة لا يغطي رصيدها الحالي قيمة المصروف، والمصروفات المسودة
    /// تُحجز من الرصيد المتاح — والرسالة تبيّن الخزينة والمتاح والمطلوب.
    /// </summary>
    [Fact]
    public async Task Expense_exceeding_the_current_treasury_balance_is_rejected()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("6");

        // رصيد الخزينة 100,000 — صرف 150,000 يُرفض.
        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.OperatingExpenses().CreateAsync(actor, Paid(f, 150000)));
        Assert.Equal("validation.expense_treasury_balance", error.Code);
        Assert.Equal("خزينة مصروفات 6", error.Args["treasury"]);
        Assert.True(error.Args.ContainsKey("available"));
        Assert.True(error.Args.ContainsKey("required"));

        // صرف في حدود الرصيد يُقبل ويُحجز من المتاح.
        var ok = await _db.OperatingExpenses().CreateAsync(actor, Paid(f, 100000));
        Assert.Equal(100000m, ok.TotalAmount);

        // لم يتبق رصيد: أي صرف جديد من نفس الخزينة يُرفض.
        var blocked = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.OperatingExpenses().CreateAsync(actor, Paid(f, 1)));
        Assert.Equal("validation.expense_treasury_balance", blocked.Code);
    }

    /// <summary>مصروف مدفوع من الخزينة (طريقة النقدي) بمبلغ محدد.</summary>
    private OperatingExpenseInput Paid(Fixture f, decimal amount)
    {
        var input = Input(f, ExpenseLine(f.ExpenseAccount, 1, amount));
        input.TreasuryId = f.TreasuryId;
        input.TreasuryMethodId = f.CashMethod;
        return input;
    }

    /// <summary>
    /// خزينة **شركة مشتركة** متابَعة في شفت مفتوح بفرع آخر: التحصيل النقدي فيها يجب أن يُحتسب
    /// في المتاح (150) فيُقبل الصرف (100) — وهو الحالات الواقعية للخزائن العامة.
    /// </summary>
    [Fact]
    public async Task Company_wide_treasury_cash_counts_even_when_collected_in_another_branch()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var expenseBranch = await _db.CreateBranchAsync("EXP-B-20", "فرع صرف 20");
        var cashBranch = await _db.CreateBranchAsync("EXP-B-21", "فرع تحصيل 21");
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "EXP-S-20", NameAr = "مورد صرف 20" });
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "EXP-C-20", NameAr = "عميل تحصيل 20" });

        // خزينة عامة (is_company_wide) على حساب 1101 بلا أي رصيد مُرحّل.
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = expenseBranch, IsCompanyWide = true, Code = "EXP-T-20",
            NameAr = "خزينة عامة 20", TreasuryType = TreasuryTypes.Cash,
            AccountId = chart["1101"].Id, FollowInShift = true
        }, actor.UserId);
        var cash = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(cash, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        // شفتان مفتوحتان: فرع الصرف وفرع التحصيل.
        var shifts = _db.TreasuryService();
        await shifts.OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = expenseBranch });
        await shifts.OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = cashBranch });

        // تحصيل نقدي 150 في فرع التحصيل (قيده مسودة داخل الشفت).
        var receipt = await shifts.CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = cashBranch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = customer.Id, PartyName = customer.NameAr,
            TreasuryId = treasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = cash, Amount = 150 } }
        });
        await shifts.PostVoucherAsync(actor, receipt.Id);

        var input = new OperatingExpenseInput
        {
            BranchId = expenseBranch, DocDate = DateTime.Today, SupplierId = supplier.Id,
            TreasuryId = treasuryId, TreasuryMethodId = cash,
            Lines = { ExpenseLine(chart["5300"], 1, 100) }
        };

        // 100 ≤ 150 ⇒ يُقبل رغم أن التحصيل في شفت فرع آخر وقيده مسودة.
        var saved = await _db.OperatingExpenses().CreateAsync(actor, input);
        Assert.Equal(100m, saved.TotalAmount);

        // 100 جديد > المتبقي (50) ⇒ يُرفض.
        input.Lines[0].UnitPrice = 100;
        var blocked = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.OperatingExpenses().CreateAsync(actor, input));
        Assert.Equal("validation.expense_treasury_balance", blocked.Code);
    }

    /// <summary>
    /// أثناء شفت مفتوح كل القيود مسودة (0220) — يجب أن يُحسب **صافي حركة اليوم** في رصيد
    /// الخزينة المتاح: تحصيل نقدي داخل الشفت يزيد المتاح فيُسمح بالصرف منه قبل اعتماد المراجعة.
    /// </summary>
    [Fact]
    public async Task Draft_collection_inside_open_shift_increases_the_available_balance()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("7");

        // استهلاك الرصيد المرحّل بالكامل بمصروف مسودة ⇒ المتاح صفر.
        await _db.OperatingExpenses().CreateAsync(actor, Paid(f, 100000));
        var blockedBefore = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.OperatingExpenses().CreateAsync(actor, Paid(f, 5000)));
        Assert.Equal("validation.expense_treasury_balance", blockedBefore.Code);

        // شفت مفتوح + سند قبض 5,000: قيده مسودة غير مرحّل إلى الأستاذ.
        await _db.TreasuryService().OpenShiftAsync(actor,
            new ShiftInput { NormalShift = true, BranchId = f.Branch });
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer,
            new PartnerInput { Code = "EXP-C-7", NameAr = "عميل تحصيل 7" });
        var receipt = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = customer.Id, PartyName = customer.NameAr,
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.CashMethod, Amount = 5000 } }
        });
        await _db.TreasuryService().PostVoucherAsync(actor, receipt.Id);

        // لم يُعتمد الشفت بعد: الأستاذ لا يعرف التحصيل، لكن المتاح يجب أن يشمل حركة اليوم.
        var ok = await _db.OperatingExpenses().CreateAsync(actor, Paid(f, 5000));

        Assert.Equal(5000m, ok.TotalAmount);
    }
}
