using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// مستندات المصروفات المصروفة فورًا (سلفة موظف وتسليم نقدية): تظهر في تعديل الشفت،
/// تُعدَّل بقيد فرق، وتُحذف بعكس قيدها ثم حذف المستند — فتبقى القيود سليمة.
/// </summary>
public sealed class ShiftEditExpenseDocsTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftEditExpenseDocsTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid TreasuryId, Guid EmployeeId,
        Dictionary<string, Account> Chart, Guid ShiftId);

    private async Task<Fixture> SetupAsync(string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await TreasuryFixtures.MapDefaultsAsync(_db, actor, chart);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CashClearing,
            chart["1130"].Id);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.EmployeeAdvances,
            chart["5300"].Id);

        var branch = await _db.CreateBranchAsync("SED-B-" + suffix, "فرع مستندات المصروف " + suffix);
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "SED-T-" + suffix, NameAr = "خزينة سلف " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id,
            FollowInShift = true
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);
        var employeeId = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(employeeId, new EmployeeInput
        { Code = "SED-E-" + suffix, NameAr = "موظف سلفة " + suffix }, actor.UserId);

        // رصيد الخزينة حتى يُسمح بالصرف منها.
        await _db.PostBalancedEntryAsync(branch, DateTime.Today, chart["1101"].Id,
            chart["4100"].Id, 100000);
        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = branch });

        return new Fixture(branch, treasuryId, employeeId, chart, shift.Id);
    }

    private async Task<Guid> CreateAdvanceAsync(Fixture f, decimal amount = 500)
    {
        var actor = await _db.AdminActorAsync();
        var advance = await new EmployeeAdvanceRepository(_db.Factory).CreateAndPostAsync(
            new EmployeeAdvanceInput
            {
                BranchId = f.Branch, EmployeeId = f.EmployeeId, TreasuryId = f.TreasuryId,
                Amount = amount, DocDate = DateTime.Today, Notes = "سلفة اختبار"
            }, actor.UserId);
        return advance.Id;
    }

    private async Task<Guid> CreateHandoverAsync(Fixture f, decimal amount = 1000,
        decimal commission = 10)
    {
        var actor = await _db.AdminActorAsync();
        var id = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateCashHandoverAsync(id, new CashHandoverInput
        {
            BranchId = f.Branch, TreasuryId = f.TreasuryId, ClearingAccountId = Guid.Empty,
            Amount = amount, CommissionAmount = commission, DocDate = DateTime.Today,
            Notes = "تسليم اختبار"
        }, actor.UserId);
        return id;
    }

    private static async Task<T> ScalarAsync<T>(string sql, object args)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<T>(sql, args);
    }

    /// <summary>رصيد حساب بالكود داخل فرع الاختبار (مدين − دائن).</summary>
    private async Task<decimal> BalanceAsync(string code, Guid branchId) =>
        await ScalarAsync<decimal>("""
        SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM journal_entry_lines l
        JOIN accounts a ON a.id = l.account_id
        WHERE a.code = @code AND l.branch_id = @branch
        """, new { code, branch = branchId });

    [Fact]
    public async Task Advance_and_handover_are_listed_in_shift_edit_as_deletable()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("1");
        var advanceId = await CreateAdvanceAsync(f);
        var handoverId = await CreateHandoverAsync(f);

        var rows = await _db.ShiftEdit().ListAsync(actor, f.ShiftId);
        var advance = Assert.Single(rows, r => r.EntityType == "employee_advance");
        Assert.Equal(advanceId, advance.DocId);
        Assert.Equal(500m, advance.Amount);
        Assert.True(advance.CanDelete);
        Assert.Equal("amount,description", advance.FieldsCsv);

        var handover = Assert.Single(rows, r => r.EntityType == "cash_handover");
        Assert.Equal(handoverId, handover.DocId);
        Assert.Equal(1000m, handover.Amount);
        Assert.True(handover.CanDelete);
        Assert.Contains("عمولة تسليم", handover.Description);
    }

    [Fact]
    public async Task Editing_the_advance_amount_posts_a_difference_entry_only()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("2");
        var chargeBefore = await BalanceAsync("5300", f.Branch);
        var cashBefore = await BalanceAsync("1101", f.Branch);
        var advanceId = await CreateAdvanceAsync(f, 500);
        var entriesBefore = await ScalarAsync<int>(
            "SELECT count(*)::int FROM journal_entries", new { });

        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = f.ShiftId, EntityType = "employee_advance", DocId = advanceId,
            Field = "amount", NewValue = "700"
        });

        Assert.Equal(700m, await ScalarAsync<decimal>(
            "SELECT amount FROM employee_advances WHERE id = @id", new { id = advanceId }));
        Assert.Equal(entriesBefore + 1,
            await ScalarAsync<int>("SELECT count(*)::int FROM journal_entries", new { }));
        // الصافي على حساب التحميل = 700 والخزينة = −700 (سلفة واحدة بفرق).
        Assert.Equal(chargeBefore + 700m, await BalanceAsync("5300", f.Branch));
        Assert.Equal(cashBefore - 700m, await BalanceAsync("1101", f.Branch));
    }

    [Fact]
    public async Task Deleting_an_advance_reverses_its_entry_and_removes_it_from_the_shift()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("3");
        var chargeBefore = await BalanceAsync("5300", f.Branch);
        var cashBefore = await BalanceAsync("1101", f.Branch);
        var advanceId = await CreateAdvanceAsync(f, 500);

        var result = await _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
        { ShiftId = f.ShiftId, EntityType = "employee_advance", DocId = advanceId });

        Assert.True(result.DocumentDeleted);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM employee_advances WHERE id = @id", new { id = advanceId }));
        // القيد كان مسودة مؤجّلة على الشفت ⇒ يُحذف بلا قيد عكسي (0220).
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM journal_entries WHERE source_id = @id",
            new { id = advanceId }));
        Assert.Equal(0, await ScalarAsync<int>("""
            SELECT count(*)::int FROM journal_entries
            WHERE source_id = @id AND reversal_of_id IS NOT NULL
            """, new { id = advanceId }));
        // القيد الأصلي + العكسي = صفر: رجع رصيد الحسابين كما قبل السلفة.
        Assert.Equal(chargeBefore, await BalanceAsync("5300", f.Branch));
        Assert.Equal(cashBefore, await BalanceAsync("1101", f.Branch));

        var report = await _db.TreasuryService().GetShiftReportAsync(actor, f.ShiftId);
        Assert.DoesNotContain(report.Expenses, e => e.Description?.Contains("سلفة موظف") == true);
        Assert.DoesNotContain(await _db.ShiftEdit().ListAsync(actor, f.ShiftId),
            r => r.EntityType == "employee_advance");
    }

    [Fact]
    public async Task Deleting_a_handover_reverses_amount_and_commission_lines()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("4");
        var cashBefore = await BalanceAsync("1101", f.Branch);
        var clearingBefore = await BalanceAsync("1130", f.Branch);
        var feeBefore = await BalanceAsync("5200", f.Branch);
        var handoverId = await CreateHandoverAsync(f, 1000, 10);

        var result = await _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
        { ShiftId = f.ShiftId, EntityType = "cash_handover", DocId = handoverId });

        Assert.True(result.DocumentDeleted);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM cash_handovers WHERE id = @id", new { id = handoverId }));
        // القيد الأصلي + العكسي = صفر على الخزينة والوسيط والعمولة.
        Assert.Equal(cashBefore, await BalanceAsync("1101", f.Branch));
        Assert.Equal(clearingBefore, await BalanceAsync("1130", f.Branch));
        Assert.Equal(feeBefore, await BalanceAsync("5200", f.Branch));
    }
}
