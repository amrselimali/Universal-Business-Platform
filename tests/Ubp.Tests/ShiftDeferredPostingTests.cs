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

    private static async Task<decimal> GlCreditAsync(Guid accountId, Guid branchId)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.credit), 0)
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

    /// <summary>
    /// سند قبض مسودة (مثل إيصال تحصيل POS المحفوظ «مسودة») يجب أن يُربط بالشفت المفتوح
    /// لحظة الإنشاء، ثم يُرحَّل عند «اعتماد المراجعة» — لا يبقى بلا قيد للأبد.
    /// </summary>
    [Fact]
    public async Task Draft_receipt_inside_a_shift_is_linked_and_posted_on_review()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("3");
        var voucher = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = f.CustomerId, PartyName = "عميل تأجيل",
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = 250m } }
        });

        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var row = await connection.QuerySingleAsync<(string Status, Guid? ShiftId,
                Guid? EntryId)>(
                "SELECT status, shift_id, journal_entry_id FROM vouchers WHERE id = @id",
                new { id = voucher.Id });
            Assert.Equal("draft", row.Status);
            Assert.Equal(f.ShiftId, row.ShiftId);
            Assert.Null(row.EntryId);
        }

        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput>
            { new() { TreasuryId = f.TreasuryId, CountedCash = 250 } });
        Assert.Equal(0m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));

        await _db.TreasuryService().ReviewShiftAsync(actor, f.ShiftId);

        Assert.Equal(250m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var row = await connection.QuerySingleAsync<(string Status, Guid? EntryId)>(
                "SELECT status, journal_entry_id FROM vouchers WHERE id = @id",
                new { id = voucher.Id });
            Assert.Equal("posted", row.Status);
            Assert.NotNull(row.EntryId);
        }
    }

    /// <summary>
    /// سند مسودة قديم أُنشئ داخل الشفت قبل إصلاح الربط (shift_id = NULL): يُعتمد تلقائيًا
    /// عند اعتماد المراجعة ويُربط بالشفت ثم يُرحَّل.
    /// </summary>
    [Fact]
    public async Task Orphan_draft_inside_the_shift_window_is_adopted_on_review()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("4");
        var voucher = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = f.CustomerId, PartyName = "عميل تأجيل",
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = 175m } }
        });

        // محاكاة السند القديم: أُنشئ داخل الشفت لكن بدون ربط (كان يبقى بلا قيد للأبد).
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync(
                "UPDATE vouchers SET shift_id = NULL WHERE id = @id", new { id = voucher.Id });
        }

        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput>
            { new() { TreasuryId = f.TreasuryId, CountedCash = 175 } });
        await _db.TreasuryService().ReviewShiftAsync(actor, f.ShiftId);

        Assert.Equal(175m, await GlBalanceAsync(f.Chart["1101"].Id, f.Branch));
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var row = await connection.QuerySingleAsync<(string Status, Guid? ShiftId)>(
                "SELECT status, shift_id FROM vouchers WHERE id = @id", new { id = voucher.Id });
            Assert.Equal("posted", row.Status);
            Assert.Equal(f.ShiftId, row.ShiftId);
        }
    }

    /// <summary>
    /// إيراد «التنفيذ المباشر» من نقطة البيع (مدين عميل / دائن إيراد) لا يجب أن يصل للأستاذ
    /// أثناء الشفت المفتوح، ويُرحَّل مع «اعتماد المراجعة» فقط.
    /// </summary>
    [Fact]
    public async Task Pos_direct_execution_revenue_waits_for_shift_review()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("5");
        var warehouse = await _db.CreateWarehouseAsync("DEF-W-5", "مخزن مباشر 5", f.Branch);
        var item = await _db.CreateItemAsync("DEF-IT-5", "خدمة مباشرة 5");
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync(
                "UPDATE items SET execution_mode = @mode, item_type = 'SERVICE' WHERE id = @id",
                new { mode = ItemExecutionModes.Direct, id = item.Id });
        }

        var receipt = await _db.Pos().CheckoutAsync(actor, new PosCheckoutInput
        {
            BranchId = f.Branch, CustomerId = f.CustomerId, WarehouseId = warehouse,
            DocDate = DateTime.Today,
            Lines =
            {
                new PosLineInput
                {
                    ItemId = item.Id, UnitId = item.BaseUnitId, Quantity = 2, UnitPrice = 150
                }
            }
        });
        Assert.True(receipt.Executed);
        var revenueAccount = f.Chart["4100"].Id;
        var receivableAccount = f.Chart["1110"].Id;

        // أثناء الشفت: لا إيراد ولا ذمم في الأستاذ (القيود مسودة مقيّدة بالشفت).
        Assert.Equal(0m, await GlCreditAsync(revenueAccount, f.Branch));
        Assert.Equal(0m, await GlBalanceAsync(receivableAccount, f.Branch));
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var drafts = await connection.ExecuteScalarAsync<int>(
                "SELECT count(*) FROM journal_entries WHERE branch_id = @branchId " +
                "AND source_type = 'execution' AND status = 'draft' AND shift_id = @shiftId",
                new { branchId = f.Branch, shiftId = f.ShiftId });
            Assert.True(drafts > 0);
        }

        await _db.TreasuryService().CloseShiftAsync(actor, f.ShiftId,
            new List<ShiftCashCountInput> { new() { TreasuryId = f.TreasuryId, CountedCash = 0 } });

        // بين الإغلاق و«اعتماد المراجعة»: يبقى كل شيء مسودة أيضًا (لا تسرّب للأستاذ).
        var late = await _db.Pos().CheckoutAsync(actor, new PosCheckoutInput
        {
            BranchId = f.Branch, CustomerId = f.CustomerId, WarehouseId = warehouse,
            DocDate = DateTime.Today,
            Lines =
            {
                new PosLineInput
                {
                    ItemId = item.Id, UnitId = item.BaseUnitId, Quantity = 1, UnitPrice = 100
                }
            }
        });
        Assert.True(late.Executed);
        Assert.Equal(0m, await GlCreditAsync(revenueAccount, f.Branch));

        await _db.TreasuryService().ReviewShiftAsync(actor, f.ShiftId);

        // بعد الاعتماد: الإيراد والذمم ظهرت في الأستاذ (300 + 100).
        Assert.Equal(400m, await GlCreditAsync(revenueAccount, f.Branch));
        Assert.Equal(400m, await GlBalanceAsync(receivableAccount, f.Branch));
    }
}
