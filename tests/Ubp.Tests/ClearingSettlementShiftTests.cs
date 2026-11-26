using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تسوية حساب وسيط (بطاقة/محفظة/شيك) إلى الخزينة داخل الشفت المفتوح — 0219:
/// تظهر سطرًا في تقرير الشفت، وتدخل «حركة اليوم» فتبقى معادلة
/// «النقد المتوقع = أول المدة + حركة اليوم» صحيحة، وتُعدَّل بقيد فرق وتُحذف بعكس قيدها
/// من شاشة تعديل الشفت.
/// </summary>
public sealed class ClearingSettlementShiftTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ClearingSettlementShiftTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid TreasuryId, Guid ClearingAccountId,
        Dictionary<string, Account> Chart, Guid ShiftId);

    private async Task<Fixture> SetupAsync(string suffix)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await TreasuryFixtures.MapDefaultsAsync(_db, actor, chart);
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CashClearing,
            chart["1130"].Id);

        var branch = await _db.CreateBranchAsync("CLR-B-" + suffix, "فرع التسوية " + suffix);
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "CLR-T-" + suffix, NameAr = "خزينة تسوية " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);

        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = branch });

        return new Fixture(branch, treasuryId, chart["1130"].Id, chart, shift.Id);
    }

    private async Task<Guid> SettleAsync(Fixture f, decimal amount, string reference,
        Guid? shiftId = null)
    {
        var actor = await _db.AdminActorAsync();
        return await _db.TreasuryService().SettleClearingAsync(actor, f.TreasuryId,
            f.ClearingAccountId, amount, DateTime.Today, reference, f.Branch, shiftId);
    }

    /// <summary>رصيد حساب في الأستاذ العام (القيود المرحّلة فقط) لفرع محدد.</summary>
    private static async Task<decimal> GlBalanceAsync(Guid accountId, Guid branchId)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.debit - l.credit), 0)
            FROM journal_entry_lines l
            JOIN journal_entries e ON e.id = l.entry_id
            WHERE e.status = 'posted' AND e.branch_id = @branchId
              AND l.account_id = @accountId
            """, new { accountId, branchId });
    }

    [Fact]
    public async Task Settlement_inside_shift_shows_in_report_and_expected_cash()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("1");

        await SettleAsync(f, 250m, "SETTLE-1");

        // لا يصل أي قيد للأستاذ قبل اعتماد المراجعة — 0220.
        Assert.Equal(0m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        Assert.Equal(0m, await GlBalanceAsync(f.ClearingAccountId, f.Branch));
        var drafts = await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId);
        Assert.Contains(drafts, d => d.SourceType == "clearing_settlement" && d.Amount == 250m);

        var report = await _db.TreasuryService().GetShiftReportAsync(actor, f.ShiftId);
        var count = Assert.Single(report.CashCounts);
        Assert.Equal(250m, count.Movement);
        Assert.Equal(count.OpeningCash + count.Movement, count.ExpectedCash);
        Assert.Equal(250m, count.ExpectedCash);

        var line = Assert.Single(report.Expenses.Where(e =>
            e.Description!.Contains("تسوية حساب وسيط")));
        // دخول نقد للخزينة ⇒ يظهر في جدول المصروفات بقيمة سالبة (يخفض المصروفات).
        Assert.Equal(-250m, line.Amount);

        // تظهر أيضًا في «تعديل بيانات الشفت» قابلة للتعديل والحذف.
        var editable = Assert.Single((await _db.ShiftEdit().ListAsync(actor, f.ShiftId))
            .Where(l => l.EntityType == "clearing_settlement"));
        Assert.Equal(250m, editable.Amount);
        Assert.True(editable.CanDelete);

        // إغلاق ثم اعتماد المراجعة ⇒ يُرحَّل القيد الآن فقط.
        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput>
            { new() { TreasuryId = f.TreasuryId, CountedCash = 250 } });
        await _db.TreasuryService().ReviewShiftAsync(actor, f.ShiftId);
        Assert.Equal(250m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        Assert.Equal(-250m, await GlBalanceAsync(f.ClearingAccountId, f.Branch));
        Assert.Empty(await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId));
    }

    [Fact]
    public async Task Settlement_can_be_edited_with_difference_entry_and_deleted_with_reversal()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("2");
        await SettleAsync(f, 250m, "SETTLE-2");
        var settlementId = await SettlementIdAsync(f);

        // تعديل القيمة إلى 400: قيد فرق 150 فقط — مسودة مؤجّلة على الشفت (0220).
        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = f.ShiftId, EntityType = "clearing_settlement", DocId = settlementId,
            Field = "amount", NewValue = "400"
        });
        var edited = Assert.Single((await _db.TreasuryService().GetShiftReportAsync(actor,
            f.ShiftId)).CashCounts);
        Assert.Equal(400m, edited.Movement);
        Assert.Equal(edited.OpeningCash + edited.Movement, edited.ExpectedCash);
        Assert.Equal(0m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        // المسودات المعلّقة = القيد الأصلي 250 + قيد الفرق 150.
        var afterEdit = await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId);
        Assert.Equal(400m, afterEdit.Sum(d => d.Amount));

        // الحذف: المسودات تُحذف (القيد الأصلي + قيد الفرق) فتختفي من التقرير والحركة.
        await _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
        {
            ShiftId = f.ShiftId, EntityType = "clearing_settlement", DocId = settlementId
        });
        var report = await _db.TreasuryService().GetShiftReportAsync(actor, f.ShiftId);
        Assert.Equal(0m, Assert.Single(report.CashCounts).Movement);
        Assert.DoesNotContain(report.Expenses, e =>
            e.Description != null && e.Description.Contains("تسوية حساب وسيط"));
        Assert.Equal(0m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        Assert.Equal(0m, await GlBalanceAsync(f.ClearingAccountId, f.Branch));
        Assert.Equal(0, await CountSettlementsAsync(f));
        Assert.Empty(await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId));
    }

    /// <summary>
    /// تسوية أُنشئت **بعد** إغلاق الشفت ومربوطة به (شفت أمس تحت المراجعة): تظهر في
    /// «تعديل بيانات الشفت» قابلة للتعديل والحذف رغم أن وقت إنشائها خارج نافذة الشفت.
    /// </summary>
    [Fact]
    public async Task Settlement_of_a_closed_shift_can_be_edited_and_deleted_from_shift_edit()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("3");
        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput> { new() { TreasuryId = f.TreasuryId, CountedCash = 0 } });

        await SettleAsync(f, 300m, "SETTLE-3", f.ShiftId);

        var editable = Assert.Single((await _db.ShiftEdit().ListAsync(actor, f.ShiftId))
            .Where(l => l.EntityType == "clearing_settlement"));
        Assert.Equal(300m, editable.Amount);
        Assert.True(editable.CanDelete);

        // تعديل القيمة من شاشة تعديل الشفت (قيد فرق مسودة).
        await _db.ShiftEdit().ApplyAsync(actor, new ShiftLineEditInput
        {
            ShiftId = f.ShiftId, EntityType = "clearing_settlement", DocId = editable.DocId,
            Field = "amount", NewValue = "350"
        });
        var edited = Assert.Single((await _db.ShiftEdit().ListAsync(actor, f.ShiftId))
            .Where(l => l.EntityType == "clearing_settlement"));
        Assert.Equal(350m, edited.Amount);

        // الحذف من نفس الشاشة.
        await _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
        { ShiftId = f.ShiftId, EntityType = "clearing_settlement", DocId = editable.DocId });
        Assert.DoesNotContain(await _db.ShiftEdit().ListAsync(actor, f.ShiftId),
            l => l.EntityType == "clearing_settlement");
        Assert.Equal(0, await CountSettlementsAsync(f));
        Assert.Empty(await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId));
    }

    private static async Task<Guid> SettlementIdAsync(Fixture f)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<Guid>(
            "SELECT id FROM treasury_clearing_settlements WHERE branch_id = @branchId " +
            "ORDER BY created_at DESC LIMIT 1", new { branchId = f.Branch });
    }

    private static async Task<int> CountSettlementsAsync(Fixture f)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM treasury_clearing_settlements WHERE branch_id = @branchId",
            new { branchId = f.Branch });
    }
}
