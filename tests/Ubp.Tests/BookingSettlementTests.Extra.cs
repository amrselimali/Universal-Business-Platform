using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Paging;
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
    public async Task Receipts_covering_the_service_value_leave_no_due_after_a_prior_settlement()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("PAID", pay: 500);

        // تسوية سابقة استهلكت نصيبًا من المسدد — يجب ألا تُخفّض مسدد بقية الخدمات.
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO customer_account_settlements
                    (id, branch_id, customer_id, treasury_id, doc_date, status, total_refund,
                     total_settled_qty)
                VALUES (gen_random_uuid(), @branch, @customer, @treasury, current_date, 'draft',
                        111.11, 0)
                """, new { branch = f.Branch, customer = f.Customer.Id,
                    treasury = f.TreasuryId });
            await connection.ExecuteAsync("""
                INSERT INTO customer_account_settlement_lines
                    (settlement_id, line_no, booking_id, booking_line_id, item_id, booking_date,
                     booked_qty, consumed_qty, settled_qty, booked_unit_price,
                     external_unit_price, paid_amount, refund_amount)
                SELECT s.id, 1, @booking, @line, @item, current_date, 5, 0, 0, 100, 100, 111.11, 111.11
                FROM customer_account_settlements s
                WHERE s.branch_id = @branch AND s.customer_id = @customer
                """, new { booking = f.Booking.Id, line = f.LineId, item = f.ServiceId,
                    branch = f.Branch, customer = f.Customer.Id });
        }

        var detail = await _db.Reservations().GetPaymentDetailAsync(actor, f.LineId);
        Assert.NotNull(detail);
        Assert.Equal(500, detail!.PaidAmount);
        Assert.Equal(0, detail.DueAmount);
    }

    [Fact]
    public async Task Opening_balance_deposit_appears_in_payment_details()
    {
        var actor = await _db.AdminActorAsync();
        var branch = await _db.CreateBranchAsync("OBP-B", "فرع تفاصيل أرصدة");
        await _db.CreateWarehouseAsync("OBP-W", "مخزن تفاصيل أرصدة", branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
            { Code = "OBP-U", NameAr = "وحدة تفاصيل أرصدة" });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "OBP-SV", NameAr = "خدمة تفاصيل أرصدة", ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        var category = await _db.PartnerRepo.CreateCategoryAsync(PartnerKind.Customer,
            new PartnerCategoryInput { Code = "OBPC", NameAr = "تصنيف تفاصيل أرصدة" });
        var customer = await _db.Partners().CreateAsync(actor, PartnerKind.Customer,
            new PartnerInput
            {
                Code = "OBP-C", NameAr = "عميل تفاصيل أرصدة", Phone = "01000000003",
                WhatsAppPhone = "01000000003", ScopeType = "BRANCH", BranchId = branch,
                CategoryId = category.Id,
                OpeningBalances =
                {
                    new ServiceOpeningBalanceInput
                    {
                        ServiceId = service.Id, Quantity = 2, UnitPrice = 100, PaidAmount = 150
                    }
                }
            });

        var page = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, customer.Id, false, null);
        var row = Assert.Single(page.Items);
        Assert.Equal(150, row.PaidAmount);
        Assert.Equal(50, row.UncollectedValue);

        var detail = await _db.Reservations().GetPaymentDetailAsync(actor, row.BookingLineId);
        Assert.NotNull(detail);
        Assert.Equal(200, detail!.ServiceValue);
        Assert.Equal(150, detail.PaidAmount);
        Assert.Equal(50, detail.DueAmount);
        var deposit = Assert.Single(detail.Rows);
        Assert.Equal("دفعة مقدمة", deposit.Kind);
        Assert.Equal(150, deposit.Amount);
    }

    [Fact]
    public async Task Paid_value_and_due_are_shown_on_reservations_with_payment_details()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("RES", pay: 200);

        var page = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, f.Customer.Id, false, null);
        var row = Assert.Single(page.Items, r => r.BookingLineId == f.LineId);
        Assert.Equal(200, row.PaidAmount);
        Assert.Equal(300, row.UncollectedValue);

        var detail = await _db.Reservations().GetPaymentDetailAsync(actor, f.LineId);
        Assert.NotNull(detail);
        Assert.Equal(500, detail!.ServiceValue);
        Assert.Equal(200, detail.PaidAmount);
        Assert.Equal(300, detail.DueAmount);
        var receipt = Assert.Single(detail.Rows);
        Assert.Equal("ايصال قبض", receipt.Kind);
        Assert.Equal(200, receipt.Amount);
    }

}
