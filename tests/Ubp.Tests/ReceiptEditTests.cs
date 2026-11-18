using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تعديل إيصال مُرحّل من شفت سابق بصلاحية مستقلة: عكسي + معدّل، وتقرير الشفت يعرض
/// التغيير فقط في شفت التعديل دون إعادة تسجيل الأصل في شفت سابق.
/// </summary>
public sealed class ReceiptEditTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public ReceiptEditTests(TestDb db) => _db = db;

    [Fact]
    public async Task Posted_receipt_from_a_previous_shift_is_edited_without_draft_or_open_shift_lock()
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        await _db.AccountingSettings().SetDefaultAsync(actor, PostingKeys.CustomerAdvances,
            chart["1110"].Id);
        var branch = await _db.CreateBranchAsync("RE-B-1", "فرع تعديل الإيصال");
        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "RE-T-1", NameAr = "خزينة تعديل الإيصال",
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "RE-C-1", NameAr = "عميل تعديل الإيصال" });

        var treasury = _db.TreasuryService();
        var first = await treasury.OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = branch });
        var draft = await treasury.CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = customer.Id, PartyName = customer.NameAr,
            TreasuryId = treasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = methodId, Amount = 100 } }
        });
        await using (var c = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await c.OpenAsync();
            await c.ExecuteAsync("UPDATE vouchers SET shift_id = @shift WHERE id = @id",
                new { shift = first.Id, id = draft.Id });
        }
        await treasury.CloseShiftAsync(actor, first.Id);
        await treasury.PostShiftToAccountsAsync(actor, first.Id);

        var second = await treasury.OpenShiftAsync(actor, new ShiftInput { NormalShift = true, BranchId = branch });
        await _db.Pos().EditReceiptAsync(actor, new ReceiptEditInput
        {
            VoucherId = draft.Id, CustomerId = customer.Id, TreasuryId = treasuryId,
            TreasuryMethodId = methodId, Amount = 150, FeeAmount = 0
        });

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var original = await connection.QuerySingleAsync<(string Status, bool Reversed)>(
            "SELECT status, is_reversed FROM vouchers WHERE id = @id", new { id = draft.Id });
        Assert.Equal("posted", original.Status);
        Assert.True(original.Reversed);
        var edits = (await connection.QueryAsync<(string Type, decimal Total, Guid ShiftId,
            string Status)>("""
            SELECT receipt_type, total_amount, shift_id, status FROM vouchers
            WHERE parent_receipt_id = @id ORDER BY receipt_type
            """, new { id = draft.Id })).ToList();
        Assert.Contains(edits, x => x.Type == VoucherReceiptTypes.Reversal && x.Total == -100m &&
                                    x.ShiftId == second.Id);
        Assert.Contains(edits, x => x.Type == VoucherReceiptTypes.Adjusted && x.Total == 150m &&
                                    x.ShiftId == second.Id);

        // الشفت القديم يحتفظ بأصله، والشفت الجديد يعرض صافي التغيير فقط (150 − 100).
        Assert.Equal(100m, (await treasury.GetShiftReportAsync(actor, first.Id)).CollectionsTotal);
        Assert.Equal(50m, (await treasury.GetShiftReportAsync(actor, second.Id)).CollectionsTotal);

        await treasury.CloseShiftAsync(actor, second.Id);
        await treasury.PostShiftToAccountsAsync(actor, second.Id);
        var postStatuses = (await connection.QueryAsync<string>("""
            SELECT status FROM vouchers WHERE parent_receipt_id = @id
            """, new { id = draft.Id })).ToList();
        Assert.All(postStatuses, s => Assert.Equal("posted", s));
        var net = await connection.ExecuteScalarAsync<decimal>("""
            SELECT COALESCE(SUM(l.credit - l.debit), 0)
            FROM journal_entry_lines l JOIN journal_entries e ON e.id = l.entry_id
            WHERE l.account_id = @account AND e.reference IN (
                SELECT doc_no FROM vouchers WHERE id = @id OR parent_receipt_id = @id)
            """, new { account = chart["1110"].Id, id = draft.Id });
        Assert.Equal(150m, net);
    }
}
