using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تسوية حساب العميل للخدمات المحجوزة: استهلاك المتبقي، إيصال تسوية مسودة،
/// وقيد محاسبي مسودة لا يُرحّل إلا بترحيل السند/الشفت.
/// </summary>
public sealed partial class BookingSettlementTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public BookingSettlementTests(TestDb db) => _db = db;

    [Fact]
    public async Task Sheet_shows_booking_date_and_remaining_services_with_paid_share()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("SHT", pay: 200);
        var sheet = await _db.BookingSettlements().GetSheetAsync(actor, f.Branch, f.Customer.Id);

        Assert.NotNull(sheet);
        Assert.Equal("عميل التسوية SHT", sheet!.CustomerName);
        var row = Assert.Single(sheet.Lines);
        Assert.Equal(f.Booking.Id, row.BookingId);
        Assert.Equal(DateTime.Today, row.BookingDate);
        Assert.Equal(5, row.BookedQty);
        Assert.Equal(2, row.ConsumedQty);
        Assert.Equal(3, row.RemainingQty);
        Assert.Equal(200, row.PaidAmount);
        Assert.Equal(300, row.RemainingValue);
    }

    [Fact]
    public async Task Settle_consumes_remaining_creates_draft_receipt_and_draft_entry()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("SET", pay: 200);

        var result = await SettleAsync(f, actor);

        Assert.Equal(100, result.TotalRefund);
        Assert.Equal(3, result.TotalSettledQty);

        var voucher = await _db.TreasuryRepo.GetVoucherAsync(result.VoucherId);
        Assert.NotNull(voucher);
        Assert.Equal(VoucherTypes.Receipt, voucher!.VoucherType);
        Assert.Equal(VoucherStatuses.Draft, voucher.Status);
        Assert.Equal(100, voucher.TotalAmount);

        var lines = await new BookingSettlementRepository(_db.Factory)
            .GetReceiptLinesAsync(result.VoucherId);
        var receiptLine = Assert.Single(lines);
        Assert.Equal(3, receiptLine.SettledQty);
        Assert.Equal(150, receiptLine.ExternalUnitPrice);
        Assert.Equal(100, receiptLine.RefundAmount);

        var entry = await _db.JournalEntryRepo.GetBySourceAsync(EntrySources.Voucher,
            result.VoucherId);
        Assert.NotNull(entry);
        Assert.Equal(EntryStatuses.Draft, entry!.Status);
        Assert.Equal(200, entry.TotalDebit);
        Assert.Equal(200, entry.TotalCredit);

        var pos = new PosRepository(_db.Factory);
        var receipts = await pos.ListReceiptsAsync(f.Branch, DateTime.Today, DateTime.Today, 500);
        var listed = Assert.Single(receipts, r => r.Id == result.VoucherId);
        Assert.Contains("خدمة التسوية SET", listed.Description);
        Assert.Equal(100, listed.Total);
        var receipt = await pos.GetReceiptDetailAsync(result.VoucherId);
        Assert.True(receipt!.IsSettlementReceipt);
        Assert.Single(receipt.SettlementLines);
        Assert.Equal(100, receipt.SettlementLines[0].RefundAmount);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var line = await connection.QuerySingleAsync<(decimal Reserved, decimal Settled)>(
            "SELECT reserved_qty, settled_qty FROM booking_lines WHERE id=@id",
            new { id = f.LineId });
        Assert.Equal(0, line.Reserved);
        Assert.Equal(3, line.Settled);
        var adjustment = await connection.QuerySingleAsync<(string? Note, decimal Qty)>(
            "SELECT note, quantity FROM reservation_adjustments WHERE booking_line_id=@id AND kind='SETTLEMENT'",
            new { id = f.LineId });
        Assert.Equal("تسوية حساب عميل", adjustment.Note);
        Assert.Equal(3, adjustment.Qty);

        var view = await connection.QuerySingleAsync<(decimal Consumed, decimal Remaining)>("""
            SELECT consumed_qty, remaining_qty FROM v_customer_reservations
            WHERE booking_line_id=@id
            """, new { id = f.LineId });
        Assert.Equal(5, view.Consumed);
        Assert.Equal(0, view.Remaining);

        var remaining = await connection.ExecuteScalarAsync<decimal>(
            "SELECT remaining_amount FROM v_customer_booking_balances WHERE booking_id=@id",
            new { id = f.Booking.Id });
        Assert.Equal(0, remaining);
        Assert.Empty(await _db.BookingCollections().ListOutstandingAsync(actor, f.Branch,
            f.Customer.Id));
    }

    [Fact]
    public async Task Posting_settlement_receipt_posts_the_draft_entry()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("POST", pay: 200);
        var result = await SettleAsync(f, actor);

        var repo = new BookingSettlementRepository(_db.Factory);
        Assert.True(await repo.PostAsync(result.VoucherId, actor.UserId));

        var voucher = await _db.TreasuryRepo.GetVoucherAsync(result.VoucherId);
        Assert.Equal(VoucherStatuses.Posted, voucher!.Status);
        Assert.NotNull(voucher.DocNo);
        var entry = await _db.JournalEntryRepo.GetBySourceAsync(EntrySources.Voucher,
            result.VoucherId);
        Assert.Equal(EntryStatuses.Posted, entry!.Status);
    }

    [Fact]
    public async Task Shift_posting_posts_pending_settlement_entries()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("SHIFT", pay: 200);
        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        {
            BranchId = f.Branch
        });
        var result = await SettleAsync(f, actor);

        var report = await _db.TreasuryService().GetShiftReportAsync(actor, shift.Id);
        var settlementLine = Assert.Single(report.Lines,
            l => l.Source == "تسوية حساب عميل");
        Assert.Equal(-100, settlementLine.Collected);

        await _db.TreasuryService().CloseShiftAsync(actor, shift.Id);
        await _db.TreasuryService().PostShiftToAccountsAsync(actor, shift.Id);

        var voucher = await _db.TreasuryRepo.GetVoucherAsync(result.VoucherId);
        Assert.Equal(VoucherStatuses.Posted, voucher!.Status);
        var entry = await _db.JournalEntryRepo.GetBySourceAsync(EntrySources.Voucher,
            result.VoucherId);
        Assert.Equal(EntryStatuses.Posted, entry!.Status);
    }

    [Fact]
    public async Task Settlement_is_forbidden_without_the_new_permission()
    {
        var actor = new ActorContext
        {
            UserId = Guid.NewGuid(), Username = "no-settle", IsAdmin = false, IsSuperAdmin = false
        };
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _db.BookingSettlements().GetSheetAsync(actor, Guid.NewGuid(), Guid.NewGuid()));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _db.BookingSettlements().SettleAsync(actor, new BookingSettlementInput
            {
                BranchId = Guid.NewGuid(), CustomerId = Guid.NewGuid(),
                TreasuryId = Guid.NewGuid()
            }));
    }

    private Task<BookingSettlementResult> SettleAsync(Fixture f, ActorContext actor) =>
        _db.BookingSettlements().SettleAsync(actor, new BookingSettlementInput
        {
            BranchId = f.Branch, CustomerId = f.Customer.Id, TreasuryId = f.TreasuryId,
            DocDate = DateTime.Today,
            Lines =
            {
                new BookingSettlementLineInput
                {
                    BookingId = f.Booking.Id, BookingLineId = f.LineId, ExternalUnitPrice = 150
                }
            }
        });

    private sealed record Fixture(Guid Branch, Guid Warehouse, Partner Customer,
        Booking Booking, Guid LineId, Guid TreasuryId, Guid MethodId, Guid ServiceId);

    private async Task<Fixture> SetupAsync(string suffix, decimal pay)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("BS-B" + suffix, "فرع التسوية " + suffix);
        var warehouse = await _db.CreateWarehouseAsync("BS-W" + suffix, "مخزن التسوية " + suffix,
            branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = "BS-U" + suffix, NameAr = "وحدة التسوية " + suffix });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "BS-SV" + suffix, NameAr = "خدمة التسوية " + suffix, ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "BS-C" + suffix, NameAr = "عميل التسوية " + suffix, Phone = "01000000000" });

        var booking = await _db.BookingService().CreateAsync(actor, new BookingInput
        {
            BranchId = branch, BookingDate = DateTime.Today, CustomerId = customer.Id,
            Lines =
            {
                new BookingLineInput
                {
                    ItemId = service.Id, UnitId = service.BaseUnitId, WarehouseId = warehouse,
                    Quantity = 5, UnitPrice = 100
                }
            }
        });
        await _db.BookingRepo.ConfirmAsync(booking.Id, actor.UserId, reserveStock: false);

        Guid lineId;
        await using (var connection = await _db.Factory.OpenAsync())
        {
            await connection.ExecuteAsync(
                "UPDATE booking_lines SET delivered_qty = 2, reserved_qty = 3 WHERE booking_id = @id",
                new { id = booking.Id });
            lineId = await connection.ExecuteScalarAsync<Guid>(
                "SELECT id FROM booking_lines WHERE booking_id = @id", new { id = booking.Id });
        }

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "BS-T" + suffix, NameAr = "خزينة التسوية " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        if (pay > 0)
        {
            await _db.BookingCollections().CollectAsync(actor, new BookingCollectionInput
            {
                BranchId = branch, CustomerId = customer.Id, TreasuryId = treasuryId,
                DocDate = DateTime.Today,
                Lines =
                {
                    new BookingCollectionLineInput { BookingId = booking.Id, Amount = pay }
                },
                Payments =
                {
                    new PosPaymentInput
                    {
                        TreasuryId = treasuryId, TreasuryMethodId = methodId, Amount = pay
                    }
                }
            });
        }

        return new Fixture(branch, warehouse, customer, booking, lineId, treasuryId, methodId,
            service.Id);
    }
}

