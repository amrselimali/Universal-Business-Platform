using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تأجيل الترحيل داخل الشفت (0220): كل الحركات تُسجَّل مسودة، ولا يصل شيء للأستاذ
/// إلا عند «اعتماد المراجعة»؛ وخارج الشفت يبقى الترحيل فوريًا.
/// </summary>
public sealed class ShiftDeferredPostingTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftDeferredPostingTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid TreasuryId, Guid MethodId, Guid CustomerId,
        Dictionary<string, Account> Chart, Guid ShiftId);

    private async Task<Fixture> SetupAsync(string suffix, bool openShift = true)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await TreasuryFixtures.MapDefaultsAsync(_db, actor, chart);

        var branch = await _db.CreateBranchAsync("DEF-B-" + suffix, "فرع التأجيل " + suffix);
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "DEF-T-" + suffix, NameAr = "خزينة تأجيل " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "DEF-C-" + suffix, NameAr = "عميل تأجيل " + suffix });

        var shiftId = Guid.Empty;
        if (openShift)
            shiftId = (await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
            { NormalShift = true, BranchId = branch })).Id;

        return new Fixture(branch, treasuryId, methodId, customer.Id, chart, shiftId);
    }

    private async Task<Guid> PostReceiptAsync(Fixture f, decimal amount)
    {
        var actor = await _db.AdminActorAsync();
        var voucher = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = f.CustomerId, PartyName = "عميل تأجيل",
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = amount } }
        });
        await _db.TreasuryService().PostVoucherAsync(actor, voucher.Id);
        return voucher.Id;
    }

    private static async Task<decimal> GlBalanceAsync(Guid accountId, Guid branchId)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.debit - l.credit), 0)
            FROM journal_entry_lines l
            JOIN journal_entries e ON e.id = l.entry_id
            WHERE e.status = 'posted' AND e.branch_id = @branchId AND l.account_id = @accountId
            """, new { accountId, branchId });
    }

    [Fact]
    public async Task Inside_shift_entries_stay_draft_until_review_approval()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("1");
        var voucherId = await PostReceiptAsync(f, 300m);

        // أثناء الشفت: القيد مسودة مرتبطة بالشفت، ولا أثر في الأستاذ.
        Assert.Equal(0m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var row = await connection.QuerySingleAsync<(string Status, Guid? ShiftId)>(
                "SELECT status, shift_id FROM journal_entries " +
                "WHERE source_type = 'voucher' AND source_id = @id",
                new { id = voucherId });
            Assert.Equal("draft", row.Status);
            Assert.Equal(f.ShiftId, row.ShiftId);
        }

        // تُعرض في نافذة اعتماد المراجعة قبل الترحيل.
        var drafts = await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId);
        Assert.Contains(drafts, d => d.SourceType == "voucher" && d.Amount == 300m);

        // إغلاق الشفت لا يُرحّل شيئًا، والاعتماد هو الذي يُرحّل.
        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput>
            { new() { TreasuryId = f.TreasuryId, CountedCash = 300 } });
        Assert.Equal(0m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));

        var reviewed = await _db.TreasuryService().ReviewShiftAsync(actor, f.ShiftId);
        Assert.Equal(ShiftReviewStatuses.Reviewed, reviewed.ReviewStatus);
        Assert.Equal(300m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        Assert.Empty(await _db.TreasuryService().ListDraftPostingsAsync(actor, f.ShiftId));
    }

    [Fact]
    public async Task Outside_shift_the_voucher_posts_immediately()
    {
        var f = await SetupAsync("2", openShift: false);
        await PostReceiptAsync(f, 100m);
        Assert.Equal(100m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
    }
}
