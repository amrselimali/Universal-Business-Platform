using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حذف سطر من تعديلات الشفت: يُسمح لبند حجز بلا تنفيذ (فيختفي من كل الشاشات)،
/// ولسطور المستندات المسودة، ويُمنع على بند عليه تنفيذ أو حركة، وعلى المستندات المُرحّلة.
/// </summary>
public sealed class ShiftEditDeleteTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public ShiftEditDeleteTests(TestDb db) => _db = db;

    private sealed record Fixture(Guid Branch, Guid Warehouse, Guid ServiceId, Guid TreasuryId,
        Guid MethodId, Partner Customer, Guid BookingId, Guid FirstLineId, Guid SecondLineId,
        Guid ShiftId);

    private async Task<Fixture> SetupBookingAsync(string suffix, int lines = 2)
    {
        var actor = await _db.AdminActorAsync();
        var chart = await _db.SeedAccountingAsync();
        var branch = await _db.CreateBranchAsync("SD-B-" + suffix, "فرع حذف الشفت " + suffix);
        var warehouse = await _db.CreateWarehouseAsync("SD-W-" + suffix,
            "مخزن حذف الشفت " + suffix, branch);
        var unit = await _db.UnitRepo.CreateAsync(new UnitInput
        { Code = "SD-U-" + suffix, NameAr = "وحدة حذف " + suffix });
        var service = await _db.ItemRepo.CreateAsync(new ItemInput
        {
            Code = "SD-SV-" + suffix, NameAr = "خدمة حذف " + suffix, ItemType = "SERVICE",
            BaseUnitId = unit.Id,
            Units = new List<ItemUnitInput> { new() { UnitId = unit.Id, ConversionFactor = 1 } }
        });
        var customer = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SD-C-" + suffix, NameAr = "عميل حذف " + suffix });
        // تنفيذ مباشر بلا اشتراط موظف مسؤول عند التنفيذ.
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync(
                "UPDATE items SET execution_mode = 'direct' WHERE id = @id",
                new { id = service.Id });
        }

        var treasuryId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateTreasuryAsync(treasuryId, new TreasuryInput
        {
            BranchId = branch, Code = "SD-T-" + suffix, NameAr = "خزينة حذف " + suffix,
            TreasuryType = TreasuryTypes.Cash, AccountId = chart["1101"].Id
        }, actor.UserId);
        var methodId = Guid.CreateVersion7();
        await _db.TreasuryRepo.CreateMethodAsync(methodId, new TreasuryMethodInput
        { TreasuryId = treasuryId, Code = "CASH", NameAr = "نقدي" }, actor.UserId);

        // الشفت أولًا حتى تدخل مستندات الاختبار في نافذتها.
        var shift = await _db.TreasuryService().OpenShiftAsync(actor, new ShiftInput
        { NormalShift = true, BranchId = branch });

        var input = new BookingInput
        { BranchId = branch, BookingDate = DateTime.Today, CustomerId = customer.Id };
        input.Lines.Add(new BookingLineInput
        {
            ItemId = service.Id, UnitId = service.BaseUnitId, WarehouseId = warehouse,
            Quantity = 2, UnitPrice = 100
        });
        if (lines > 1)
            input.Lines.Add(new BookingLineInput
            {
                ItemId = service.Id, UnitId = service.BaseUnitId, WarehouseId = warehouse,
                Quantity = 3, UnitPrice = 50
            });
        var booking = await _db.BookingService().CreateAsync(actor, input);
        var saved = await _db.BookingService().GetAsync(actor, booking.Id);

        return new Fixture(branch, warehouse, service.Id, treasuryId, methodId, customer,
            booking.Id, saved.Lines[0].Id,
            saved.Lines.Count > 1 ? saved.Lines[1].Id : Guid.Empty, shift.Id);
    }

    private static ShiftLineDeleteInput DeleteInput(Fixture f, string entityType, Guid docId,
        Guid? lineId) => new()
    {
        ShiftId = f.ShiftId, EntityType = entityType, DocId = docId, LineId = lineId
    };

    private static async Task<T> ScalarAsync<T>(string sql, object args)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return await connection.ExecuteScalarAsync<T>(sql, args);
    }

    [Fact]
    public async Task Booking_line_without_execution_is_deleted_and_vanishes_from_other_screens()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("1");
        var svc = _db.ShiftEdit();

        var row = Assert.Single(await svc.ListAsync(actor, f.ShiftId),
            r => r.LineId == f.FirstLineId);
        Assert.True(row.CanDelete);

        var result = await svc.DeleteAsync(actor,
            DeleteInput(f, "booking", f.BookingId, f.FirstLineId));

        Assert.True(result.Deleted);
        Assert.False(result.DocumentDeleted);
        // اختفى من قائمة تعديل الشفت ومن كارتة الحجوزات (الحذف على المصدر لكل الشاشات).
        Assert.DoesNotContain(await svc.ListAsync(actor, f.ShiftId),
            r => r.LineId == f.FirstLineId);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM booking_lines WHERE id = @id", new { id = f.FirstLineId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM v_customer_reservations WHERE booking_line_id = @id",
            new { id = f.FirstLineId }));
        // إجمالي الحجز أُعيد حسابه على السطر الباقي (3 × 50 = 150).
        Assert.Equal(150m, await ScalarAsync<decimal>(
            "SELECT total_amount FROM bookings WHERE id = @id", new { id = f.BookingId }));
    }

    [Fact]
    public async Task Booking_line_with_execution_cannot_be_deleted()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("2", lines: 1);
        await _db.BookingService().ConfirmAsync(actor, f.BookingId);
        await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = f.FirstLineId, Quantity = 2 });

        var error = await Assert.ThrowsAsync<ValidationAppException>(() => _db.ShiftEdit()
            .DeleteAsync(actor, DeleteInput(f, "booking", f.BookingId, f.FirstLineId)));
        Assert.Equal("validation.shift_delete_line_in_use", error.Code);
        Assert.Equal(1, await ScalarAsync<int>(
            "SELECT count(*)::int FROM booking_lines WHERE id = @id", new { id = f.FirstLineId }));
    }

    [Fact]
    public async Task Deleting_the_last_booking_line_deletes_the_booking_header()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("3", lines: 1);

        var result = await _db.ShiftEdit().DeleteAsync(actor,
            DeleteInput(f, "booking", f.BookingId, f.FirstLineId));

        Assert.True(result.Deleted);
        Assert.True(result.DocumentDeleted);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM bookings WHERE id = @id", new { id = f.BookingId }));
    }

    [Fact]
    public async Task Deleting_the_last_line_of_a_paid_booking_is_refused()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("4", lines: 1);
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            var voucherId = Guid.CreateVersion7();
            await connection.ExecuteAsync("""
                INSERT INTO vouchers (id, branch_id, doc_date, status, voucher_type, party_type,
                    party_id, party_name, treasury_id, total_amount, fee_total)
                VALUES (@id, @branch, current_date, 'draft', 'receipt', 'C', @customer, @name,
                        @treasury, 100, 0)
                """, new { id = voucherId, branch = f.Branch, customer = f.Customer.Id,
                    name = f.Customer.NameAr, treasury = f.TreasuryId });
            await connection.ExecuteAsync("""
                INSERT INTO booking_payments (booking_id, voucher_id, amount)
                VALUES (@booking, @voucher, 100)
                """, new { booking = f.BookingId, voucher = voucherId });
        }

        var error = await Assert.ThrowsAsync<ValidationAppException>(() => _db.ShiftEdit()
            .DeleteAsync(actor, DeleteInput(f, "booking", f.BookingId, f.FirstLineId)));
        Assert.Equal("validation.shift_delete_document_in_use", error.Code);
        Assert.Equal(1, await ScalarAsync<int>(
            "SELECT count(*)::int FROM booking_lines WHERE id = @id", new { id = f.FirstLineId }));
    }

    [Fact]
    public async Task Executed_service_line_cannot_be_deleted()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("5", lines: 1);
        await _db.BookingService().ConfirmAsync(actor, f.BookingId);
        await _db.Executions().ExecuteAsync(actor, new BookingExecutionInput
        { BookingLineId = f.FirstLineId, Quantity = 1 });
        var executionId = await ScalarAsync<Guid>(
            "SELECT id FROM booking_executions ORDER BY created_at DESC LIMIT 1", new { });

        var error = await Assert.ThrowsAsync<ValidationAppException>(() => _db.ShiftEdit()
            .DeleteAsync(actor, DeleteInput(f, "booking_execution", executionId, null)));
        Assert.Equal("validation.shift_delete_execution_line", error.Code);
    }

    [Fact]
    public async Task Draft_voucher_line_is_deleted_and_the_empty_voucher_is_removed()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("6");
        var voucher = await _db.TreasuryService().CreateVoucherAsync(actor, new VoucherInput
        {
            VoucherType = VoucherTypes.Receipt, BranchId = f.Branch, DocDate = DateTime.Today,
            PartyType = "C", PartyId = f.Customer.Id, PartyName = f.Customer.NameAr,
            TreasuryId = f.TreasuryId,
            Lines =
            {
                new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = 100 },
                new VoucherLineInput { TreasuryMethodId = f.MethodId, Amount = 50 }
            }
        });
        var lineIds = await VoucherLineIdsAsync(voucher.Id);
        Assert.Equal(2, lineIds.Count);

        var row = Assert.Single(await _db.ShiftEdit().ListAsync(actor, f.ShiftId),
            r => r.EntityType == "voucher" && r.LineId == lineIds[0]);
        Assert.True(row.CanDelete);

        var first = await _db.ShiftEdit().DeleteAsync(actor,
            DeleteInput(f, "voucher", voucher.Id, lineIds[0]));
        Assert.True(first.Deleted);
        Assert.False(first.DocumentDeleted);
        Assert.Equal(50m, await ScalarAsync<decimal>(
            "SELECT total_amount FROM vouchers WHERE id = @id", new { id = voucher.Id }));

        var last = await _db.ShiftEdit().DeleteAsync(actor,
            DeleteInput(f, "voucher", voucher.Id, lineIds[1]));
        Assert.True(last.DocumentDeleted);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM vouchers WHERE id = @id", new { id = voucher.Id }));
    }

    [Fact]
    public async Task Draft_expense_line_is_deleted_and_the_empty_document_is_removed()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("7");
        var chart = await _db.SeedAccountingAsync();
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "SD-SP-7", NameAr = "مورد حذف 7" });
        var expenseId = Guid.CreateVersion7();
        var lineA = Guid.CreateVersion7();
        var lineB = Guid.CreateVersion7();
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO operating_expenses (id, branch_id, doc_date, supplier_id, status,
                    total_amount)
                VALUES (@id, @branch, current_date, @supplier, 'DRAFT', 300)
                """, new { id = expenseId, branch = f.Branch, supplier = supplier.Id });
            await connection.ExecuteAsync("""
                INSERT INTO operating_expense_lines
                    (id, expense_id, line_no, account_id, description, quantity, unit_price, amount)
                VALUES (@a, @expense, 1, @account, 'بند أول', 1, 100, 100),
                       (@b, @expense, 2, @account, 'بند ثاني', 2, 100, 200)
                """, new { a = lineA, b = lineB, expense = expenseId, account = chart["5490"].Id });
        }

        var first = await _db.ShiftEdit().DeleteAsync(actor,
            DeleteInput(f, "operating_expense", expenseId, lineA));
        Assert.True(first.Deleted);
        Assert.False(first.DocumentDeleted);
        Assert.Equal(200m, await ScalarAsync<decimal>(
            "SELECT total_amount FROM operating_expenses WHERE id = @id", new { id = expenseId }));

        var last = await _db.ShiftEdit().DeleteAsync(actor,
            DeleteInput(f, "operating_expense", expenseId, lineB));
        Assert.True(last.DocumentDeleted);
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM operating_expenses WHERE id = @id", new { id = expenseId }));
    }

    [Fact]
    public async Task Posted_document_line_cannot_be_deleted()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("8");
        var chart = await _db.SeedAccountingAsync();
        var supplier = await _db.PartnerRepo.CreateAsync(PartnerKind.Supplier, new PartnerInput
        { Code = "SD-SP-8", NameAr = "مورد حذف 8" });
        var expenseId = Guid.CreateVersion7();
        var lineId = Guid.CreateVersion7();
        await using (var connection = new NpgsqlConnection(TestDb.AdminConnection))
        {
            await connection.OpenAsync();
            await connection.ExecuteAsync("""
                INSERT INTO operating_expenses (id, branch_id, doc_date, supplier_id, status,
                    total_amount)
                VALUES (@id, @branch, current_date, @supplier, 'POSTED', 100)
                """, new { id = expenseId, branch = f.Branch, supplier = supplier.Id });
            await connection.ExecuteAsync("""
                INSERT INTO operating_expense_lines
                    (id, expense_id, line_no, account_id, description, quantity, unit_price, amount)
                VALUES (@line, @expense, 1, @account, 'بند مُرحّل', 1, 100, 100)
                """, new { line = lineId, expense = expenseId, account = chart["5490"].Id });
        }

        var error = await Assert.ThrowsAsync<ValidationAppException>(() => _db.ShiftEdit()
            .DeleteAsync(actor, DeleteInput(f, "operating_expense", expenseId, lineId)));
        Assert.Equal("validation.shift_delete_not_draft", error.Code);
    }

    [Fact]
    public async Task Draft_transfer_line_delete_restores_the_source_and_removes_the_target()
    {
        var actor = await _db.AdminActorAsync();
        var f = await SetupBookingAsync("9", lines: 1);
        var to = await _db.PartnerRepo.CreateAsync(PartnerKind.Customer, new PartnerInput
        { Code = "SD-C2-9", NameAr = "عميل هدف 9" });
        // تثبيت الحجز حتى تصبح الكمية المتبقية قابلة للتحويل.
        await _db.BookingRepo.ConfirmAsync(f.BookingId, actor.UserId, reserveStock: false);
        var draft = await _db.ServiceTransferRepo.CreateAsync(new ServiceTransferInput
        {
            BranchId = f.Branch, FromCustomerId = f.Customer.Id, ToCustomerId = to.Id,
            DocDate = DateTime.Today,
            Lines =
            {
                new ServiceTransferLineInput { FromBookingLineId = f.FirstLineId, Quantity = 1 }
            }
        }, actor.UserId);
        Assert.Equal(1m, await ScalarAsync<decimal>(
            "SELECT reserved_qty FROM booking_lines WHERE id = @id", new { id = f.FirstLineId }));

        var row = Assert.Single(await _db.ShiftEdit().ListAsync(actor, f.ShiftId),
            r => r.EntityType == "service_transfer");
        Assert.True(row.CanDelete);

        var result = await _db.ShiftEdit().DeleteAsync(actor,
            DeleteInput(f, "service_transfer", draft.Id, row.LineId));

        Assert.True(result.Deleted);
        Assert.True(result.DocumentDeleted);
        // كمية المصدر رجعت، والتحويل أُلغي، وحجز المحوَّل إليه اختفى من الشاشات.
        Assert.Equal(2m, await ScalarAsync<decimal>(
            "SELECT reserved_qty FROM booking_lines WHERE id = @id", new { id = f.FirstLineId }));
        Assert.Equal(0m, await ScalarAsync<decimal>(
            "SELECT transferred_qty FROM booking_lines WHERE id = @id", new { id = f.FirstLineId }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM service_transfers WHERE id = @id", new { id = draft.Id }));
        Assert.Equal(0, await ScalarAsync<int>(
            "SELECT count(*)::int FROM bookings WHERE id = @id",
            new { id = draft.TargetBookingId!.Value }));
    }

    private static async Task<IReadOnlyList<Guid>> VoucherLineIdsAsync(Guid voucherId)
    {
        await using var connection = new NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        return (await connection.QueryAsync<Guid>(
            "SELECT id FROM voucher_lines WHERE voucher_id = @id ORDER BY line_no",
            new { id = voucherId })).ToList();
    }
}
