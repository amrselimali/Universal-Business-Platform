using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class ShiftEditRepository
{
    /// <summary>
    /// حذف سطر من مستندات الشفت (وليس تعديله). القيود:
    /// بند الحجز لا يُحذف إن كان عليه تنفيذ أو حركة كمية (فاتورة/تسوية/تحويل/استهلاك/إذن تسليم)،
    /// وسطور المستندات تُحذف في المسودة فقط، والخدمة المنفذة تُعدّل بعكس + تنفيذ معدّل ولا تُحذف.
    /// السطر يُحذف من المصدر فيختفي تلقائيًا من كل الشاشات والتقارير.
    /// </summary>
    public async Task<ShiftLineDeleteResult> DeleteLineAsync(ShiftLineDeleteInput input,
        Guid userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.EntityType) || input.DocId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var s = await LoadShiftAsync(connection, input.ShiftId, tx, ct);
        if (s.Status != ShiftStatuses.Open && s.ReviewStatus != ShiftReviewStatuses.Pending)
            throw new ValidationAppException("validation.shift_edit_locked");

        var result = input.EntityType switch
        {
            "booking" => await DeleteBookingLineAsync(connection, tx, input, ct),
            "voucher" => await DeleteVoucherLineAsync(connection, tx, input, ct),
            "operating_expense" => await DeleteExpenseLineAsync(connection, tx, input, ct),
            "commercial_document" => await DeleteCommercialLineAsync(connection, tx, input, ct),
            "service_transfer" => await DeleteTransferLineAsync(connection, tx, input, ct),
            "booking_execution" => throw new ValidationAppException(
                "validation.shift_delete_execution_line"),
            _ => throw new ValidationAppException("validation.review_field_not_editable")
        };
        await tx.CommitAsync(ct);
        return result;
    }

    /// <summary>قيد الحذف على بند الحجز: لا تنفيذ ولا حركة كمية ولا مستند يشير للسطر.</summary>
    private static async Task EnsureBookingLineHasNoUsageAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid lineId, decimal delivered, decimal invoiced,
        decimal transferred, decimal settled, CancellationToken ct)
    {
        if (delivered > 0 || invoiced > 0 || transferred > 0 || settled > 0)
            throw new ValidationAppException("validation.shift_delete_line_in_use");
        var used = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT (SELECT count(*) FROM booking_execution_lines WHERE booking_line_id = @id)
                 + (SELECT count(*) FROM commercial_document_lines WHERE booking_line_id = @id)
                 + (SELECT count(*) FROM customer_account_settlement_lines WHERE booking_line_id = @id)
                 + (SELECT count(*) FROM delivery_note_lines WHERE booking_line_id = @id)
                 + (SELECT count(*) FROM service_consumptions WHERE booking_line_id = @id)
                 + (SELECT count(*) FROM service_transfer_lines WHERE from_booking_line_id = @id)
            """, new { id = lineId }, tx, cancellationToken: ct));
        if (used > 0)
            throw new ValidationAppException("validation.shift_delete_line_in_use");
    }

    /// <summary>تحرير كمية الحجز من أرصدة المخزون ثم حذف السطر (لا أثر محاسبي على البند).</summary>
    private static async Task DeleteBookingLineCoreAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid lineId, Guid itemId, Guid warehouseId, decimal reservedQty,
        CancellationToken ct)
    {
        // نفس مسار إلغاء الحجز: كمية البند المحجوزة تُرتد إلى رصيد المخزون.
        if (reservedQty > 0)
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE stock_balances
                SET reserved_qty = GREATEST(reserved_qty - @qty, 0), updated_at = now()
                WHERE item_id = @itemId AND warehouse_id = @warehouseId
                """, new { qty = reservedQty, itemId, warehouseId }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM booking_lines WHERE id = @id", new { id = lineId }, tx,
            cancellationToken: ct));
    }

    /// <summary>حذف بند حجز: يُشترط ألا يكون على السطر تنفيذ أو حركة كمية.</summary>
    private static async Task<ShiftLineDeleteResult> DeleteBookingLineAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        CancellationToken ct)
    {
        if (input.LineId is not { } lineId)
            throw new ValidationAppException("validation.required_fields");
        var line = await connection.QuerySingleOrDefaultAsync<BookingLineDeleteRow>(
            new CommandDefinition("""
            SELECT l.booking_id AS BookingId, b.status AS Status, l.reserved_qty AS Reserved,
                   l.delivered_qty AS Delivered, l.invoiced_qty AS Invoiced,
                   l.transferred_qty AS Transferred, l.settled_qty AS Settled,
                   l.item_id AS ItemId, l.warehouse_id AS WarehouseId
            FROM booking_lines l
            JOIN bookings b ON b.id = l.booking_id
            WHERE l.id = @id AND l.booking_id = @doc
            FOR UPDATE OF l, b
            """, new { id = lineId, doc = input.DocId }, tx, cancellationToken: ct));
        if (line is null) throw new NotFoundAppException();
        // القيد الأساسي أولًا: لا حذف لسطر عليه تنفيذ أو حركة كمية.
        await EnsureBookingLineHasNoUsageAsync(connection, tx, lineId, line.Delivered,
            line.Invoiced, line.Transferred, line.Settled, ct);
        if (line.Status is not (BookingStatuses.Draft or BookingStatuses.Confirmed))
            throw new ValidationAppException("validation.shift_edit_locked");

        var remaining = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM booking_lines WHERE booking_id = @doc AND id <> @line
            """, new { doc = input.DocId, line = lineId }, tx, cancellationToken: ct));
        // آخر سطر: الحجز كله يُحذف، فلا بد ألا يكون مرتبطًا بمدفوعات/تسويات/تنفيذ/فواتير.
        if (remaining == 0)
            await EnsureBookingIsEmptyDeletableAsync(connection, tx, input.DocId, ct);

        await DeleteBookingLineCoreAsync(connection, tx, lineId, line.ItemId, line.WarehouseId,
            line.Reserved, ct);

        if (remaining == 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM bookings WHERE id = @id", new { id = input.DocId }, tx,
                cancellationToken: ct));
            return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings SET total_amount = COALESCE(
                (SELECT SUM(total_amount) FROM booking_lines WHERE booking_id = @id), 0)
            WHERE id = @id
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true };
    }

    /// <summary>هل الحجز بلا أي مستند مرتبط يمكن حذفه معه؟ (مدفوعات/تسويات/تنفيذ/فواتير/تحويلات).</summary>
    private static async Task EnsureBookingIsEmptyDeletableAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid bookingId, CancellationToken ct)
    {
        var used = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT (SELECT count(*) FROM booking_payments WHERE booking_id = @id)
                 + (SELECT count(*) FROM booking_executions WHERE booking_id = @id)
                 + (SELECT count(*) FROM customer_account_settlements WHERE new_booking_id = @id)
                 + (SELECT count(*) FROM customer_account_settlement_lines WHERE booking_id = @id)
                 + (SELECT count(*) FROM booking_settlements
                    WHERE booking_id = @id OR target_booking_id = @id)
                 + (SELECT count(*) FROM commercial_documents WHERE booking_id = @id)
                 + (SELECT count(*) FROM delivery_notes WHERE booking_id = @id)
                 + (SELECT count(*) FROM bookings WHERE related_booking_id = @id)
            """, new { id = bookingId }, tx, cancellationToken: ct));
        if (used > 0)
            throw new ValidationAppException("validation.shift_delete_document_in_use");
    }

    /// <summary>سطر بند الحجز المطلوب حذفه (كمياته تحدد قيد «لا تنفيذ على السطر»).</summary>
    private sealed class BookingLineDeleteRow
    {
        public Guid LineId { get; set; }
        public Guid BookingId { get; set; }
        public string Status { get; set; } = "";
        public decimal Reserved { get; set; }
        public decimal Delivered { get; set; }
        public decimal Invoiced { get; set; }
        public decimal Transferred { get; set; }
        public decimal Settled { get; set; }
        public Guid ItemId { get; set; }
        public Guid WarehouseId { get; set; }
    }

    /// <summary>حذف سطر إيصال/سند: المسودة فقط، وبلا ارتباط بتسوية حساب عميل.</summary>
    private static async Task<ShiftLineDeleteResult> DeleteVoucherLineAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        CancellationToken ct)
    {
        if (input.LineId is not { } lineId)
            throw new ValidationAppException("validation.required_fields");
        var doc = await connection.QuerySingleOrDefaultAsync<VoucherDeleteRow>(
            new CommandDefinition("""
            SELECT v.id AS Id, v.status AS Status, v.journal_entry_id AS JournalEntryId,
                   EXISTS (SELECT 1 FROM customer_account_settlements bs
                           WHERE bs.voucher_id = v.id) AS IsSettlement
            FROM vouchers v WHERE v.id = @id FOR UPDATE
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc is null) throw new NotFoundAppException();
        if (doc.Status != "draft")
            throw new ValidationAppException("validation.shift_delete_not_draft");
        if (doc.IsSettlement)
            throw new ValidationAppException("validation.shift_delete_line_in_use");

        var belongs = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM voucher_lines WHERE id = @line AND voucher_id = @doc
            """, new { line = lineId, doc = input.DocId }, tx, cancellationToken: ct));
        if (belongs == 0) throw new NotFoundAppException();
        var remaining = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM voucher_lines WHERE voucher_id = @doc AND id <> @line
            """, new { doc = input.DocId, line = lineId }, tx, cancellationToken: ct));
        if (remaining == 0)
            await EnsureVoucherIsEmptyDeletableAsync(connection, tx, input.DocId, doc.JournalEntryId,
                ct);

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM voucher_lines WHERE id = @line AND voucher_id = @doc",
            new { line = lineId, doc = input.DocId }, tx, cancellationToken: ct));

        if (remaining == 0)
        {
            await DeleteDraftEntryAsync(connection, tx, doc.JournalEntryId, ct);
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM vouchers WHERE id = @id", new { id = input.DocId }, tx,
                cancellationToken: ct));
            return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE vouchers SET total_amount = COALESCE(
                (SELECT SUM(amount) FROM voucher_lines WHERE voucher_id = @id), 0)
            WHERE id = @id
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true };
    }

    /// <summary>الإيصال بلا سطور: لا يُحذف إن كان مرتبطًا بمدفوعات أو تسويات أو قيد مُرحَّل.</summary>
    private static async Task EnsureVoucherIsEmptyDeletableAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid voucherId, Guid? entryId, CancellationToken ct)
    {
        var used = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT (SELECT count(*) FROM booking_payments WHERE voucher_id = @id)
                 + (SELECT count(*) FROM booking_settlements WHERE refund_voucher_id = @id)
                 + (SELECT count(*) FROM customer_account_settlements WHERE voucher_id = @id)
            """, new { id = voucherId }, tx, cancellationToken: ct));
        if (used > 0)
            throw new ValidationAppException("validation.shift_delete_document_in_use");
        if (entryId is not { } journalId) return;
        var status = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT status FROM journal_entries WHERE id = @id", new { id = journalId }, tx,
            cancellationToken: ct));
        if (status is not (null or "draft"))
            throw new ValidationAppException("validation.shift_delete_document_in_use");
    }

    /// <summary>حذف القيد المسودة المرتبط بالإيصال المحذوف (المرحّل لا يُحذف).</summary>
    private static async Task DeleteDraftEntryAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid? entryId, CancellationToken ct)
    {
        if (entryId is not { } journalId) return;
        var status = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT status FROM journal_entries WHERE id = @id FOR UPDATE", new { id = journalId },
            tx, cancellationToken: ct));
        if (status is null or not "draft") return;
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM journal_entry_lines WHERE entry_id = @id", new { id = journalId }, tx,
            cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM journal_entries WHERE id = @id", new { id = journalId }, tx,
            cancellationToken: ct));
    }

    private sealed class VoucherDeleteRow
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = "";
        public Guid? JournalEntryId { get; set; }
        public bool IsSettlement { get; set; }
    }

    /// <summary>حذف سطر مصروف تشغيلي: المسودة فقط (المُرحَّل يُعدّل بقيد فرق).</summary>
    private static async Task<ShiftLineDeleteResult> DeleteExpenseLineAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        CancellationToken ct)
    {
        if (input.LineId is not { } lineId)
            throw new ValidationAppException("validation.required_fields");
        var doc = await connection.QuerySingleOrDefaultAsync<DocStatusRow>(new CommandDefinition(
            "SELECT id AS Id, status AS Status FROM operating_expenses WHERE id = @id FOR UPDATE",
            new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc is null) throw new NotFoundAppException();
        if (doc.Status != "DRAFT")
            throw new ValidationAppException("validation.shift_delete_not_draft");

        var belongs = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM operating_expense_lines
            WHERE id = @line AND expense_id = @doc
            """, new { line = lineId, doc = input.DocId }, tx, cancellationToken: ct));
        if (belongs == 0) throw new NotFoundAppException();
        var remaining = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM operating_expense_lines
            WHERE expense_id = @doc AND id <> @line
            """, new { doc = input.DocId, line = lineId }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM operating_expense_lines WHERE id = @line AND expense_id = @doc
            """, new { line = lineId, doc = input.DocId }, tx, cancellationToken: ct));

        if (remaining == 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM operating_expenses WHERE id = @id", new { id = input.DocId }, tx,
                cancellationToken: ct));
            return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE operating_expenses SET total_amount = COALESCE(
                (SELECT SUM(amount) FROM operating_expense_lines WHERE expense_id = @id), 0)
            WHERE id = @id
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true };
    }

    /// <summary>حذف سطر مستند تجاري (فاتورة/مرتجع) مسودة.</summary>
    private static async Task<ShiftLineDeleteResult> DeleteCommercialLineAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        CancellationToken ct)
    {
        if (input.LineId is not { } lineId)
            throw new ValidationAppException("validation.required_fields");
        var doc = await connection.QuerySingleOrDefaultAsync<DocStatusRow>(new CommandDefinition("""
            SELECT id AS Id, status AS Status FROM commercial_documents WHERE id = @id FOR UPDATE
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc is null) throw new NotFoundAppException();
        if (doc.Status != "draft")
            throw new ValidationAppException("validation.shift_delete_not_draft");

        var belongs = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM commercial_document_lines
            WHERE id = @line AND document_id = @doc
            """, new { line = lineId, doc = input.DocId }, tx, cancellationToken: ct));
        if (belongs == 0) throw new NotFoundAppException();
        // السطر مرتبط بمرتجع بيع/شراء: لا يُحذف.
        var used = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT (SELECT count(*) FROM sales_return_links WHERE original_line_id = @line)
                 + (SELECT count(*) FROM commercial_return_links WHERE original_line_id = @line)
            """, new { line = lineId }, tx, cancellationToken: ct));
        if (used > 0)
            throw new ValidationAppException("validation.shift_delete_line_in_use");

        var remaining = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int FROM commercial_document_lines
            WHERE document_id = @doc AND id <> @line
            """, new { doc = input.DocId, line = lineId }, tx, cancellationToken: ct));
        if (remaining == 0)
            await EnsureCommercialIsEmptyDeletableAsync(connection, tx, input.DocId, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM commercial_document_lines WHERE id = @line AND document_id = @doc
            """, new { line = lineId, doc = input.DocId }, tx, cancellationToken: ct));

        if (remaining == 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM commercial_documents WHERE id = @id", new { id = input.DocId }, tx,
                cancellationToken: ct));
            return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE commercial_documents SET total = COALESCE(
                (SELECT SUM(total_amount) FROM commercial_document_lines
                 WHERE document_id = @id), 0)
            WHERE id = @id
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true };
    }

    /// <summary>المستند التجاري بلا سطور: لا يُحذف إن كان مرتبطًا بأذون تسليم/تخصيصات/مستند أصل.</summary>
    private static async Task EnsureCommercialIsEmptyDeletableAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid documentId, CancellationToken ct)
    {
        var used = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT (SELECT count(*) FROM delivery_notes WHERE invoice_id = @id)
                 + (SELECT count(*) FROM document_allocations WHERE target_document_id = @id)
                 + (SELECT count(*) FROM commercial_documents WHERE original_document_id = @id)
            """, new { id = documentId }, tx, cancellationToken: ct));
        if (used > 0)
            throw new ValidationAppException("validation.shift_delete_document_in_use");
    }

    private sealed class DocStatusRow
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = "";
    }

    /// <summary>
    /// حذف بند الحجز المنعكس لحجز التحويل مع مراعاة قيد عدم التنفيذ، وحذف حجز التحويل إن خلا.
    /// </summary>
    private static async Task DeleteTransferredBookingLineAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid targetBookingId, BookingLineDeleteRow target,
        CancellationToken ct)
    {
        await EnsureBookingLineHasNoUsageAsync(connection, tx, target.LineId, target.Delivered,
            target.Invoiced, target.Transferred, target.Settled, ct);
        var remainingTarget = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT count(*)::int FROM booking_lines WHERE booking_id = @doc AND id <> @line",
            new { doc = targetBookingId, line = target.LineId }, tx, cancellationToken: ct));
        if (remainingTarget == 0)
            await EnsureBookingIsEmptyDeletableAsync(connection, tx, targetBookingId, ct);

        await DeleteBookingLineCoreAsync(connection, tx, target.LineId, target.ItemId,
            target.WarehouseId, target.Reserved, ct);
        if (remainingTarget == 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM bookings WHERE id = @id", new { id = targetBookingId }, tx,
                cancellationToken: ct));
            return;
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings SET total_amount = COALESCE(
                (SELECT SUM(total_amount) FROM booking_lines WHERE booking_id = @id), 0)
            WHERE id = @id
            """, new { id = targetBookingId }, tx, cancellationToken: ct));
    }

    /// <summary>
    /// حذف سطر تحويل خدمات (مسودة): تُرتد الكمية إلى بند المصدر ويُحذف بند الحجز المنعكس
    /// لدى العميل المحوَّل إليه — بنفس قيد «لا تنفيذ على السطر».
    /// </summary>
    private static async Task<ShiftLineDeleteResult> DeleteTransferLineAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        CancellationToken ct)
    {
        if (input.LineId is not { } lineId)
            throw new ValidationAppException("validation.required_fields");
        var line = await connection.QuerySingleOrDefaultAsync<TransferLineDeleteRow>(
            new CommandDefinition("""
            SELECT l.transfer_id AS TransferId, l.line_no AS LineNo,
                   l.from_booking_line_id AS FromBookingLineId, l.quantity AS Quantity,
                   t.status AS Status, t.target_booking_id AS TargetBookingId
            FROM service_transfer_lines l
            JOIN service_transfers t ON t.id = l.transfer_id
            WHERE l.id = @id AND l.transfer_id = @doc
            FOR UPDATE OF l, t
            """, new { id = lineId, doc = input.DocId }, tx, cancellationToken: ct));
        if (line is null) throw new NotFoundAppException();
        if (line.Status != ServiceTransferStatuses.Draft)
            throw new ValidationAppException("validation.shift_delete_not_draft");

        // 1) بند الحجز المنعكس لدى العميل المحوَّل إليه (أُنشئ مع المسودة) يُحذف بنفس القيود.
        if (line.TargetBookingId is { } targetBooking)
        {
            var target = await connection.QuerySingleOrDefaultAsync<BookingLineDeleteRow>(
                new CommandDefinition("""
                SELECT l.id AS LineId, l.booking_id AS BookingId, b.status AS Status,
                       l.reserved_qty AS Reserved, l.delivered_qty AS Delivered,
                       l.invoiced_qty AS Invoiced, l.transferred_qty AS Transferred,
                       l.settled_qty AS Settled, l.item_id AS ItemId,
                       l.warehouse_id AS WarehouseId
                FROM booking_lines l JOIN bookings b ON b.id = l.booking_id
                WHERE l.booking_id = @booking AND l.line_no = @lineNo
                FOR UPDATE OF l
                """, new { booking = targetBooking, lineNo = line.LineNo }, tx,
                cancellationToken: ct));
            if (target is not null)
                await DeleteTransferredBookingLineAsync(connection, tx, targetBooking, target, ct);
        }

        // 2) إرجاع الكمية إلى بند المصدر (عكس ما تم عند إنشاء المسودة).
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_lines
            SET reserved_qty = reserved_qty + @qty,
                transferred_qty = GREATEST(transferred_qty - @qty, 0)
            WHERE id = @id
            """, new { qty = line.Quantity, id = line.FromBookingLineId }, tx, cancellationToken: ct));

        // 3) حذف سطر التحويل وإعادة حساب إجمالياته (أو حذف التحويل لخلوّه).
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM service_transfer_lines WHERE id = @id AND transfer_id = @doc",
            new { id = lineId, doc = input.DocId }, tx, cancellationToken: ct));
        var remaining = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT count(*)::int FROM service_transfer_lines WHERE transfer_id = @id",
            new { id = input.DocId }, tx, cancellationToken: ct));
        if (remaining == 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM service_transfers WHERE id = @id", new { id = input.DocId }, tx,
                cancellationToken: ct));
            return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE service_transfers
            SET total_quantity = COALESCE(
                    (SELECT SUM(quantity) FROM service_transfer_lines WHERE transfer_id = @id), 0),
                total_amount = COALESCE(
                    (SELECT SUM(amount) FROM service_transfer_lines WHERE transfer_id = @id), 0)
            WHERE id = @id
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true };
    }

    private sealed class TransferLineDeleteRow
    {
        public Guid TransferId { get; set; }
        public int LineNo { get; set; }
        public Guid FromBookingLineId { get; set; }
        public decimal Quantity { get; set; }
        public string Status { get; set; } = "";
        public Guid? TargetBookingId { get; set; }
    }
}
