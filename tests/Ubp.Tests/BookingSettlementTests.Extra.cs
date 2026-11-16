using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

public sealed partial class BookingSettlementTests
{
    [Fact]
    public async Task New_booking_settlement_creates_a_confirmed_booking_without_a_refund_voucher()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("NEWBK", pay: 200);

        var result = await _db.BookingSettlements().SettleAsync(actor, new BookingSettlementInput
        {
            BranchId = f.Branch, CustomerId = f.Customer.Id,
            SettlementType = BookingSettlementTypes.NewBooking,
            NewBookingLines =
            {
                new NewBookingLineInput { ItemId = f.ServiceId, Quantity = 1, UnitPrice = 50,
                    Notes = "عرض أول" },
                new NewBookingLineInput { ItemId = f.ServiceId, Quantity = 1, UnitPrice = 50,
                    Notes = "عرض ثان" }
            },
            NewBookingNotes = "عرض جديد",
            DocDate = DateTime.Today,
            Lines =
            {
                new BookingSettlementLineInput
                {
                    BookingId = f.Booking.Id, BookingLineId = f.LineId, ExternalUnitPrice = 50
                }
            }
        });

        Assert.NotEqual(Guid.Empty, result.NewBookingId);
        Assert.Equal(Guid.Empty, result.VoucherId);
        Assert.Equal(100, result.TotalRefund);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var booking = await connection.QuerySingleAsync<(string Status, decimal Total,
            decimal Deposit, string? Notes)>(
            "SELECT status, total_amount, deposit_amount, notes FROM bookings WHERE id=@id",
            new { id = result.NewBookingId });
        Assert.Equal("confirmed", booking.Status);
        Assert.Equal(100, booking.Total);
        Assert.Equal(100, booking.Deposit);
        Assert.Equal("عرض جديد", booking.Notes);
        var lines = (await connection.QueryAsync<(decimal Qty, decimal Reserved)>(
            "SELECT quantity, reserved_qty FROM booking_lines WHERE booking_id=@id",
            new { id = result.NewBookingId })).ToList();
        Assert.Equal(2, lines.Count);
        Assert.All(lines, l =>
        {
            Assert.Equal(1, l.Qty);
            Assert.Equal(1, l.Reserved);
        });
        Assert.Equal(0, await connection.ExecuteScalarAsync<int>(
            "SELECT count(*)::int FROM customer_account_settlements WHERE voucher_id IS NOT NULL AND id=@id",
            new { id = result.SettlementId }));

        var settlement = await connection.QuerySingleAsync<(string Type, Guid? Journal)>(
            "SELECT settlement_type, journal_entry_id FROM customer_account_settlements WHERE id=@id",
            new { id = result.SettlementId });
        Assert.Equal("new_booking", settlement.Type);
        if (settlement.Journal.HasValue)
        {
            var entry = await _db.JournalEntryRepo.GetAsync(settlement.Journal.Value);
            Assert.Equal(EntryStatuses.Draft, entry!.Status);
        }
    }

    [Fact]
    public async Task Partial_new_booking_leaves_a_treasury_settlement_line_and_draft_receipt()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("CASH", pay: 200);

        var result = await _db.BookingSettlements().SettleAsync(actor, new BookingSettlementInput
        {
            BranchId = f.Branch, CustomerId = f.Customer.Id, TreasuryId = f.TreasuryId,
            SettlementType = BookingSettlementTypes.NewBooking,
            NewBookingLines =
            {
                new NewBookingLineInput { ItemId = f.ServiceId, Quantity = 1, UnitPrice = 50 }
            },
            DocDate = DateTime.Today,
            Lines =
            {
                new BookingSettlementLineInput
                {
                    BookingId = f.Booking.Id, BookingLineId = f.LineId, ExternalUnitPrice = 50
                }
            }
        });

        // المستحق 100 والعروض 50 => سطر خزينة 50 استرداد للعميل.
        Assert.NotEqual(Guid.Empty, result.VoucherId);
        var voucher = await _db.TreasuryRepo.GetVoucherAsync(result.VoucherId);
        Assert.Equal(VoucherStatuses.Draft, voucher!.Status);
        Assert.Equal(50, voucher.TotalAmount);

        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var cash = await connection.QuerySingleAsync<(decimal Amount, string Direction)>(
            "SELECT amount, direction FROM customer_account_settlement_cash_lines WHERE settlement_id=@id",
            new { id = result.SettlementId });
        Assert.Equal(50, cash.Amount);
        Assert.Equal("refund", cash.Direction);

        var entry = await _db.JournalEntryRepo.GetBySourceAsync(EntrySources.Voucher,
            result.VoucherId);
        Assert.Equal(EntryStatuses.Draft, entry!.Status);
    }

    [Fact]
    public async Task Uncollected_services_list_filters_and_sorts_for_all_customers()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("UNCOL", pay: 0);
        var rows = await _db.UncollectedServices().ListAsync(actor, DateTime.Today,
            DateTime.Today, f.Branch, "date_asc");
        Assert.Contains(rows, r => r.BookingId == f.Booking.Id);
        Assert.All(rows, r => Assert.True(r.RemainingQty > 0));
        Assert.All(rows, r => Assert.Equal(f.Branch, r.BranchId));

        var values = await _db.UncollectedServices().ListAsync(actor, DateTime.Today,
            DateTime.Today, f.Branch, "value");
        var ordered = values.Select(v => v.RemainingValue).ToList();
        Assert.Equal(ordered.OrderByDescending(x => x), ordered);
    }

}
