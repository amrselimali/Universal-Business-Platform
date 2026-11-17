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
    public async Task Settled_line_is_not_due_and_is_hidden_by_the_open_filter()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("SETTLED", pay: 0);
        // سطر تمت تسويته بالكامل: مستهلك بالكامل ومسوّى.
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                UPDATE booking_lines
                SET delivered_qty = quantity, reserved_qty = 0, settled_qty = quantity
                WHERE booking_id = @id
                """, new { id = f.Booking.Id });
        }

        var open = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, f.Customer.Id, false, null, default, null, true);
        Assert.DoesNotContain(open.Items, r => r.BookingLineId == f.LineId);

        var all = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, f.Customer.Id, false, null, default, null, false);
        var row = Assert.Single(all.Items, r => r.BookingLineId == f.LineId);
        // السطر مغلق بالتسوية: لا مبلغ مستحق عليه.
        Assert.Equal(0, row.UncollectedValue);
    }

    [Fact]
    public async Task Transfer_in_target_shows_zero_reserved_and_does_not_double_the_refund()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("TRIN", pay: 0);
        var target = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        {
            Code = "BS-TRIN", NameAr = "عميل محوَّل إليه", Phone = "01000000001"
        });
        await _db.ServiceTransferRepo.CreateAsync(new ServiceTransferInput
        {
            BranchId = f.Branch, FromCustomerId = f.Customer.Id, ToCustomerId = target.Id,
            DocDate = DateTime.Today,
            Lines = { new ServiceTransferLineInput { FromBookingLineId = f.LineId, Quantity = 2 } }
        }, actor.UserId);

        Guid bookingId;
        Guid targetLineId;
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var row = await connection.QuerySingleAsync<(Guid BookingId, Guid LineId)>("""
                SELECT b.id AS BookingId, l.id AS LineId
                FROM bookings b JOIN booking_lines l ON l.booking_id = b.id
                WHERE b.customer_id = @customerId AND b.source = 'transfer'
                """, new { customerId = target.Id });
            bookingId = row.BookingId;
            targetLineId = row.LineId;
            // دفعة مقدمة 100 على الحجز الوارد (قيمة السطر 200) لاختبار المسترد.
            await connection.ExecuteAsync(
                "UPDATE bookings SET deposit_amount = 100 WHERE id = @id", new { id = bookingId });
        }

        var sheet = await _db.BookingSettlements().GetSheetAsync(actor, f.Branch, target.Id);
        var line = Assert.Single(sheet!.Lines);
        Assert.Equal(2, line.BookedQty);
        Assert.Equal(0, line.ReservedQty);
        Assert.Equal(-2, line.ConsumedQty);
        Assert.Equal(0, line.RefundableConsumedQty);
        Assert.Equal(2, line.RemainingQty);
        Assert.Equal(100, line.PaidAmount);

        var result = await _db.BookingSettlements().SettleAsync(actor, new BookingSettlementInput
        {
            BranchId = f.Branch, CustomerId = target.Id, TreasuryId = f.TreasuryId,
            DocDate = DateTime.Today,
            Lines =
            {
                new BookingSettlementLineInput
                {
                    BookingId = bookingId, BookingLineId = targetLineId, ExternalUnitPrice = 50
                }
            }
        });
        Assert.Equal(100, result.TotalRefund);
        Assert.Equal(2, result.TotalSettledQty);

        await using var verify = new NpgsqlConnection(TestDb.AdminConnection);
        await verify.OpenAsync();
        var view = await verify.QuerySingleAsync<(decimal Consumed, decimal Remaining)>("""
            SELECT consumed_qty, remaining_qty FROM v_customer_reservations
            WHERE booking_line_id = @id
            """, new { id = targetLineId });
        Assert.Equal(0, view.Consumed);
        Assert.Equal(0, view.Remaining);
    }

    [Fact]
    public async Task Paid_amount_matches_between_settlement_sheet_and_reservations_list()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("CMP", pay: 200);
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync(
                "UPDATE booking_lines SET delivered_qty = 2, reserved_qty = 3 WHERE booking_id = @id",
                new { id = f.Booking.Id });
        }

        var sheet = await _db.BookingSettlements().GetSheetAsync(actor, f.Branch, f.Customer.Id);
        var page = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, f.Customer.Id, false, null);

        var sheetLine = Assert.Single(sheet!.Lines);
        var listLine = Assert.Single(page.Items, r => r.BookingLineId == f.LineId);
        Assert.Equal(sheetLine.PaidAmount, listLine.PaidAmount);
        Assert.Equal(sheetLine.BookedQty * sheetLine.UnitPrice - sheetLine.PaidAmount,
            listLine.UncollectedValue);
    }

    [Fact]
    public async Task Open_only_filter_keeps_lines_with_remaining_or_due()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("OPEN", pay: 500);
        // خدمة منفَّذة بالكامل ومسددة بالكامل: لا متبقٍ ولا مستحق.
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync(
                "UPDATE booking_lines SET delivered_qty = quantity, reserved_qty = 0 WHERE booking_id = @id",
                new { id = f.Booking.Id });
        }

        var closed = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, f.Customer.Id, false, null, default, null, true);
        Assert.DoesNotContain(closed.Items, r => r.BookingLineId == f.LineId);

        var open = await _db.Reservations().ListAsync(actor, new PageRequest
        {
            Page = 1, PageSize = 25
        }, f.Customer.Id, false, null, default, null, false);
        Assert.Contains(open.Items, r => r.BookingLineId == f.LineId);
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
        Assert.Equal("أرصدة افتتاحية", deposit.Kind);
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
