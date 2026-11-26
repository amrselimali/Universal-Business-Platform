using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حذف الإيصال من شاشة إيصالات POS (مسودة حذف فعلي/مُرحّل بإيصال عكسي)،
/// وحذف تسوية حساب العميل من شاشة تعديل الشفت مع إرجاع الكميات.
/// </summary>
public sealed class ReceiptAndSettlementDeleteTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ReceiptAndSettlementDeleteTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid Warehouse, Guid ServiceId, Guid TreasuryId,
        Guid MethodId, Partner Customer, Guid BookingId, Guid LineId, Guid ShiftId);

    private async Task<Fixture> SetupAsync(string suffix, bool openShift = true)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("RD-B-" + suffix, "فرع حذف مستند " + suffix);
        var warehouse = await _db.CreateWarehouseAsync("RD-W-" + suffix,
            "مخزن حذف مستند " + suffix, branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = "RD-U-" + suffix, NameAr = "وحدة حذف " + suffix });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "RD-SV-" + suffix, NameAr = "خدمة حذف مستند " + suffix, ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "RD-C-" + suffix, NameAr = "عميل حذف مستند " + suffix });

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "RD-T-" + suffix, NameAr = "خزينة حذف " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        var shiftId = Guid.Empty;
        if (openShift)
            shiftId = (await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
            { NormalShift = true, BranchId = branch })).Id;

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
        var lineId = (await _db.BookingService().GetAsync(actor, booking.Id)).Lines.Single().Id;
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                UPDATE booking_lines SET delivered_qty = 2, reserved_qty = 3 WHERE id = @id;
                UPDATE bookings SET deposit_amount = 200 WHERE id = @booking;
                """, new { id = lineId, booking = booking.Id });
        }
        return new Fixture(branch, warehouse, service.Id, treasuryId, methodId, customer,
            booking.Id, lineId, shiftId);
    }

    private async Task<BookingSettlementResult> SettleAsync(Fixture f, bool newBooking)
    {
        var actor = await _db.AdminActorAsync();
        var input = new BookingSettlementInput
        {
            BranchId = f.Branch, CustomerId = f.Customer.Id, TreasuryId = f.TreasuryId,
            SettlementType = newBooking ? BookingSettlementTypes.NewBooking
                : BookingSettlementTypes.Refund,
            DocDate = DateTime.Today,
            Lines =
            {
                new BookingSettlementLineInput
                {
                    BookingId = f.BookingId, BookingLineId = f.LineId, ExternalUnitPrice = 50
                }
            }
        };
        if (newBooking)
            input.NewBookingLines.Add(new NewBookingLineInput
            { ItemId = f.ServiceId, Quantity = 1, UnitPrice = 50 });
        return await _db.BookingSettlements().SettleAsync(actor, input);
    }

    private async Task<Guid> CreateReceiptAsync(Fixture f, decimal amount = 100)
    {
        var actor = await _db.AdminActorAsync();
        var voucher = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = f.Customer.Id, PartyName = f.Customer.NameAr,
            TreasuryId = f.TreasuryId,
            Lines = { new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = amount } }
        });
        return voucher.Id;
    }

    private static async Task<T> ScalarAsync<T>(string sql, object args)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<T>(sql, args);
    }

    private static async Task ExecuteAsync(string sql, object args)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        await connection.ExecuteAsync(sql, args);
    }

    private static async Task<T> SingleAsync<T>(string sql, object args)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.QuerySingleAsync<T>(sql, args);
    }

    // ---------------- حذف الإيصال من شاشة إيصالات POS ----------------

    [Fact]
    public async Task Draft_receipt_is_deleted_with_its_booking_payments()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("R1");
        var voucherId = await CreateReceiptAsync(f);
        await ExecuteAsync("""
            INSERT INTO booking_payments (booking_id, voucher_id, amount)
            VALUES (@booking, @voucher, 100)
            """, new { booking = f.BookingId, voucher = voucherId });

        var outcome = await _db.Pos().DeleteReceiptAsync(actor, voucherId);

        Assert.True(outcome.Deleted);
        Assert.Equal("pos.receipt_deleted", outcome.MessageKey);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM vouchers WHERE id = @id", new { id = voucherId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM booking_payments WHERE voucher_id = @id",
            new { id = voucherId }));
    }

    [Fact]
    public async Task Posted_receipt_is_reversed_and_booking_payments_are_released()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("R2");
        var voucherId = await CreateReceiptAsync(f);
        await _db.TreasuryService().PostVoucherAsync(actor, voucherId);
        await ExecuteAsync("""
            INSERT INTO booking_payments (booking_id, voucher_id, amount)
            VALUES (@booking, @voucher, 100)
            """, new { booking = f.BookingId, voucher = voucherId });

        var outcome = await _db.Pos().DeleteReceiptAsync(actor, voucherId);

        Assert.False(outcome.Deleted);
        Assert.Equal("pos.receipt_reversed", outcome.MessageKey);
        var original = await _db.TreasuryRepo.GetVoucherAsync(voucherId);
        Assert.NotNull(original);
        Assert.Equal(VoucherStatuses.Posted, original!.Status);
        var reversal = await SingleAsync<(decimal Total, string Type, string Status)>(
            "SELECT total_amount AS Total, receipt_type AS Type, status AS Status " +
            "FROM vouchers WHERE parent_receipt_id = @id", new { id = voucherId });
        Assert.Equal(-100m, reversal.Total);
        Assert.Equal(VoucherReceiptTypes.Reversal, reversal.Type);
        // شفت مفتوح: الإيصال العكسي مسودة تُرحَّل معه.
        Assert.Equal(VoucherStatuses.Draft, reversal.Status);
        Assert.Equal(1, await ScalarAsync<int>(
            "SELECT count(*)::int FROM vouchers WHERE parent_receipt_id = @id",
            new { id = voucherId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM booking_payments WHERE voucher_id = @id",
            new { id = voucherId }));
    }

    [Fact]
    public async Task Posted_receipt_without_open_shift_is_reversed_and_posted_immediately()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("R3", openShift: false);
        var voucherId = await CreateReceiptAsync(f);
        await _db.TreasuryService().PostVoucherAsync(actor, voucherId);

        var outcome = await _db.Pos().DeleteReceiptAsync(actor, voucherId);

        Assert.Equal("pos.receipt_reversed", outcome.MessageKey);
        var reversal = await SingleAsync<(Guid Id, string Status)>(
            "SELECT id AS Id, status AS Status FROM vouchers WHERE parent_receipt_id = @id",
            new { id = voucherId });
        Assert.Equal(VoucherStatuses.Posted, reversal.Status);
        Assert.Equal(EntryStatuses.Posted, await ScalarAsync<string>(
            "SELECT status FROM journal_entries WHERE source_type = 'voucher' AND source_id = @id",
            new { id = reversal.Id }));
    }

    [Fact]
    public async Task Settlement_receipt_cannot_be_deleted_from_pos_receipts()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("R4");
        var settlement = await SettleAsync(f, newBooking: false);

        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.Pos().DeleteReceiptAsync(actor, settlement.VoucherId));
        Assert.Equal("validation.receipt_delete_settlement", error.Code);
        Assert.Equal(1, await ScalarAsync<int>(
            "SELECT count(*)::int FROM vouchers WHERE id = @id",
            new { id = settlement.VoucherId }));
    }

    [Fact]
    public async Task Draft_settlement_is_deleted_from_shift_edit_and_quantities_restored()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("S1");
        var settlement = await SettleAsync(f, newBooking: false);
        Assert.Equal(3m, await ScalarAsync<decimal>(
            "SELECT settled_qty FROM booking_lines WHERE id = @id", new { id = f.LineId }));
        Assert.Equal(0m, await ScalarAsync<decimal>(
            "SELECT reserved_qty FROM booking_lines WHERE id = @id", new { id = f.LineId }));

        var row = Assert.Single(await _db.ShiftEdit().ListAsync(actor, f.ShiftId),
            r => r.EntityType == "customer_settlement" && r.DocId == settlement.SettlementId);
        Assert.True(row.CanDelete);
        Assert.Equal(100m, row.Amount);

        var result = await _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
        {
            ShiftId = f.ShiftId, EntityType = "customer_settlement",
            DocId = settlement.SettlementId
        });

        Assert.True(result.Deleted);
        Assert.True(result.DocumentDeleted);
        // الكميات رجعت للحجز، والتسوية وإيصالها وقيدها وسجلاتها اختفت.
        Assert.Equal(0m, await ScalarAsync<decimal>(
            "SELECT settled_qty FROM booking_lines WHERE id = @id", new { id = f.LineId }));
        Assert.Equal(3m, await ScalarAsync<decimal>(
            "SELECT reserved_qty FROM booking_lines WHERE id = @id", new { id = f.LineId }));
        Assert.Equal(0m, await ScalarAsync<decimal>(
            "SELECT settled_amount FROM bookings WHERE id = @id", new { id = f.BookingId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM customer_account_settlements WHERE id = @id",
            new { id = settlement.SettlementId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM vouchers WHERE id = @id",
            new { id = settlement.VoucherId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM reservation_adjustments " +
            "WHERE booking_line_id = @id AND kind = 'SETTLEMENT'", new { id = f.LineId }));
    }

    [Fact]
    public async Task New_booking_settlement_deletion_removes_the_created_booking()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("S2");
        var settlement = await SettleAsync(f, newBooking: true);
        Assert.NotEqual(Guid.Empty, settlement.NewBookingId);
        Assert.Equal(1, await ScalarAsync<int>(
            "SELECT count(*)::int FROM bookings WHERE id = @id",
            new { id = settlement.NewBookingId }));

        var result = await _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
        {
            ShiftId = f.ShiftId, EntityType = "customer_settlement",
            DocId = settlement.SettlementId
        });

        Assert.True(result.DocumentDeleted);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM bookings WHERE id = @id",
            new { id = settlement.NewBookingId }));
        Assert.Equal(3m, await ScalarAsync<decimal>(
            "SELECT reserved_qty FROM booking_lines WHERE id = @id", new { id = f.LineId }));
    }

    [Fact]
    public async Task Posted_settlement_cannot_be_deleted()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupAsync("S3");
        var settlement = await SettleAsync(f, newBooking: false);
        Assert.True(await new Ubp.Infrastructure.Repositories.BookingSettlementRepository(_db.Factory)
            .PostAsync(settlement.VoucherId, actor.UserId));

        var error = await Assert.ThrowsAsync<ValidationAppException>(() =>
            _db.ShiftEdit().DeleteAsync(actor, new ShiftLineDeleteInput
            {
                ShiftId = f.ShiftId, EntityType = "customer_settlement",
                DocId = settlement.SettlementId
            }));
        Assert.Equal("validation.shift_delete_settlement_posted", error.Code);
        Assert.Contains("posted", error.Args["links"]);
        Assert.Equal(1, await ScalarAsync<int>(
            "SELECT count(*)::int FROM customer_account_settlements WHERE id = @id",
            new { id = settlement.SettlementId }));
    }
}
