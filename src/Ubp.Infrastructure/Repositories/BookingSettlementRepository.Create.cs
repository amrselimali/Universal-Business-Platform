using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingSettlementRepository
{
    public async Task<BookingSettlementResult> CreateAsync(Guid settlementId, Guid voucherId,
        BookingSettlementInput input, Guid userId, CancellationToken ct = default)
    {
        var isNewBooking = string.Equals(input.SettlementType,
            BookingSettlementTypes.NewBooking, StringComparison.OrdinalIgnoreCase);
        var newBookingLines = input.NewBookingLines
            .Where(l => l.ItemId != Guid.Empty).ToList();
        if (isNewBooking && newBookingLines.Count == 0 && input.NewBookingItemId != Guid.Empty)
            newBookingLines.Add(new NewBookingLineInput
            {
                ItemId = input.NewBookingItemId, UnitId = input.NewBookingUnitId,
                Quantity = input.NewBookingQuantity, UnitPrice = input.NewBookingUnitPrice
            });
        if (input.BranchId == Guid.Empty || input.CustomerId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");
        if (!isNewBooking && input.TreasuryId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");
        if (isNewBooking && (newBookingLines.Count == 0 ||
                             newBookingLines.Any(l => l.Quantity <= 0 || l.UnitPrice < 0)))
            throw new ValidationAppException("validation.required_fields");
        if (input.Lines.Count == 0)
            throw new ValidationAppException("validation.document_has_no_lines");
        if (input.Lines.Select(l => l.BookingLineId).Distinct().Count() != input.Lines.Count)
            throw new ValidationAppException("validation.booking_duplicate_line");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var customer = await connection.QuerySingleOrDefaultAsync<(Guid Id, string Name)>(
            new CommandDefinition("SELECT id, name_ar FROM customers WHERE id = @id AND is_active",
                new { id = input.CustomerId }, tx, cancellationToken: ct));
        if (customer.Id == Guid.Empty)
            throw new NotFoundAppException("validation.customer_not_found");

        TreasuryRow? treasury = null;
        if (!isNewBooking)
        {
            treasury = await connection.QuerySingleOrDefaultAsync<TreasuryRow>(new CommandDefinition("""
                SELECT t.id AS Id, t.branch_id AS BranchId, t.account_id AS AccountId,
                       t.name_ar AS Name, t.treasury_type AS TreasuryType,
                       (SELECT m.id FROM treasury_methods m
                        WHERE m.treasury_id = t.id AND m.is_active
                        ORDER BY (m.code = 'DEFAULT') DESC, m.code LIMIT 1) AS MethodId
                FROM treasuries t
                WHERE t.id = @treasuryId AND t.branch_id = @branchId AND t.is_active
                """, new { treasuryId = input.TreasuryId, branchId = input.BranchId }, tx,
                cancellationToken: ct));
            if (treasury.Id == Guid.Empty || treasury.MethodId == Guid.Empty)
                throw new ValidationAppException("validation.treasury_method_not_found");
        }

        var ids = input.Lines.Select(l => l.BookingLineId).ToArray();
        var locked = (await connection.QueryAsync<LockedLine>(new CommandDefinition("""
            SELECT l.id AS BookingLineId, l.booking_id AS BookingId, l.item_id AS ItemId,
                   l.quantity AS BookedQty, l.reserved_qty AS RemainingQty,
                   l.unit_price AS UnitPrice, l.delivered_qty AS DeliveredQty,
                   l.invoiced_qty AS InvoicedQty, l.transferred_qty AS TransferredQty,
                   l.settled_qty AS SettledQty,
                   b.booking_date AS BookingDate, b.branch_id AS BranchId,
                   b.customer_id AS CustomerId, b.status AS BookingStatus,
                   b.deposit_amount AS DepositAmount,
                   (SELECT COALESCE(SUM(bp.amount), 0) FROM booking_payments bp
                    WHERE bp.booking_id = b.id) AS PaidAmount,
                   (SELECT COALESCE(SUM(sl.paid_amount), 0) FROM customer_account_settlement_lines sl
                    WHERE sl.booking_id = b.id) AS SettledPaidAmount,
                   (SELECT COALESCE(SUM(l2.quantity * l2.unit_price), 0)
                    FROM booking_lines l2 WHERE l2.booking_id = b.id) AS BookingRemainingValue
            FROM booking_lines l
            JOIN bookings b ON b.id = l.booking_id
            WHERE l.id = ANY(@ids) FOR UPDATE OF l, b
            """, new { ids }, tx, cancellationToken: ct))).ToDictionary(x => x.BookingLineId);
        if (locked.Count != ids.Length)
            throw new ValidationAppException("validation.booking_not_found");

        var calcs = new List<SettlementCalc>();
        foreach (var line in input.Lines)
        {
            if (!locked.TryGetValue(line.BookingLineId, out var row))
                throw new ValidationAppException("validation.booking_not_found");
            if (row.BookingId != line.BookingId || row.CustomerId != input.CustomerId ||
                row.BranchId != input.BranchId ||
                row.BookingStatus is "cancelled" or "reversed")
                throw new ValidationAppException("validation.booking_not_found");
            if (row.RemainingQty <= 0)
                throw new ValidationAppException("validation.booking_line_no_remaining");
            if (line.ExternalUnitPrice < 0)
                throw new ValidationAppException("validation.price_invalid");

            var consumed = Math.Max(row.DeliveredQty, row.InvoicedQty) + row.TransferredQty
                           + row.SettledQty;
            var lineValue = row.BookedQty * row.UnitPrice;
            var paidAlloc = row.BookingRemainingValue > 0
                ? Math.Min(lineValue, Math.Round((row.DepositAmount + row.PaidAmount
                                                  - row.SettledPaidAmount) * lineValue
                                                 / row.BookingRemainingValue, 2,
                    MidpointRounding.AwayFromZero))
                : 0m;
            calcs.Add(new SettlementCalc
            {
                BookingId = row.BookingId, BookingLineId = row.BookingLineId, ItemId = row.ItemId,
                BookingDate = row.BookingDate, BookedQty = row.BookedQty, ConsumedQty = consumed,
                SettledQty = row.RemainingQty, UnitPrice = row.UnitPrice,
                ExternalUnitPrice = line.ExternalUnitPrice, PaidAmount = paidAlloc,
                RefundAmount = Math.Round(paidAlloc - line.ExternalUnitPrice * consumed, 2,
                    MidpointRounding.AwayFromZero),
                RevenueAdjustment = Math.Round(consumed *
                    (line.ExternalUnitPrice - row.UnitPrice), 2, MidpointRounding.AwayFromZero)
            });
        }

        var totalRefund = Math.Round(calcs.Sum(c => c.RefundAmount), 2,
            MidpointRounding.AwayFromZero);
        var totalQty = calcs.Sum(c => c.SettledQty);
        if (totalRefund <= 0)
            throw new ValidationAppException("validation.settlement_total_required");
        Guid? settlementVoucherId = null;
        Guid? newBookingId = null;
        string? newBookingNo = null;
        decimal newBookingTotal = 0;
        if (isNewBooking)
        {
            (newBookingId, newBookingNo, newBookingTotal) = await CreateNewBookingAsync(connection, tx, input,
                newBookingLines, totalRefund, customer.Name, userId, ct);
        }
        else
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO vouchers
                    (id, branch_id, doc_date, status, voucher_type, party_type, party_id, party_name,
                     treasury_id, total_amount, fee_total, notes, created_by)
                VALUES (@voucherId, @branchId, @docDate, 'draft', 'receipt', 'C', @customerId,
                        @customerName, @treasuryId, @total, 0, @notes, @userId)
                """, new
            {
                voucherId, branchId = input.BranchId, docDate = input.DocDate.Date,
                customerId = input.CustomerId, customerName = customer.Name,
                treasuryId = input.TreasuryId, total = totalRefund,
                notes = "ايصال تسوية حساب عميل" +
                        (string.IsNullOrWhiteSpace(input.Notes) ? "" : " — " + input.Notes.Trim()),
                userId
            }, tx, cancellationToken: ct));

            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO voucher_lines (voucher_id, line_no, treasury_method_id, amount, fee_amount)
                VALUES (@voucherId, 1, @methodId, @total, 0)
                """, new { voucherId, methodId = treasury!.MethodId, total = totalRefund }, tx,
                cancellationToken: ct));
            settlementVoucherId = voucherId;
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO customer_account_settlements
                (id, branch_id, customer_id, treasury_id, voucher_id, new_booking_id, doc_date,
                 status, settlement_type, total_refund, total_settled_qty, notes, created_by)
            VALUES (@settlementId, @branchId, @customerId, @treasuryId, @voucherId,
                    @newBookingId, @docDate, 'draft', @settlementType, @total, @totalQty, @notes,
                    @userId)
            """, new
        {
            settlementId, branchId = input.BranchId, customerId = input.CustomerId,
            treasuryId = input.TreasuryId == Guid.Empty ? (Guid?)null : input.TreasuryId,
            voucherId = settlementVoucherId, newBookingId, docDate = input.DocDate.Date,
            settlementType = isNewBooking ? BookingSettlementTypes.NewBooking
                : BookingSettlementTypes.Refund,
            total = totalRefund, totalQty, notes = input.Notes, userId
        }, tx, cancellationToken: ct));

        if (isNewBooking && input.TreasuryId != Guid.Empty &&
            Math.Round(newBookingTotal - totalRefund, 2) != 0)
        {
            var difference = Math.Round(newBookingTotal - totalRefund, 2,
                MidpointRounding.AwayFromZero);
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO customer_account_settlement_cash_lines
                    (settlement_id, line_no, treasury_id, amount, direction)
                VALUES (@settlementId, 1, @treasuryId, @amount, @direction)
                """, new
            {
                settlementId, treasuryId = input.TreasuryId, amount = Math.Abs(difference),
                direction = difference > 0 ? "collect" : "refund"
            }, tx, cancellationToken: ct));
        }

        var lineNo = 0;
        foreach (var calc in calcs)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO customer_account_settlement_lines
                    (settlement_id, line_no, booking_id, booking_line_id, item_id, booking_date,
                     booked_qty, consumed_qty, settled_qty, booked_unit_price,
                     external_unit_price, paid_amount, refund_amount, revenue_adjustment, note)
                VALUES
                    (@settlementId, @lineNo, @BookingId, @BookingLineId, @ItemId, @BookingDate,
                     @BookedQty, @ConsumedQty, @SettledQty, @UnitPrice,
                     @ExternalUnitPrice, @PaidAmount, @RefundAmount, @RevenueAdjustment,
                     'تسوية حساب عميل')
                """, new
            {
                settlementId, lineNo, calc.BookingId, calc.BookingLineId, calc.ItemId,
                calc.BookingDate, calc.BookedQty, calc.ConsumedQty, calc.SettledQty,
                calc.UnitPrice, calc.ExternalUnitPrice, calc.PaidAmount, calc.RefundAmount,
                calc.RevenueAdjustment
            }, tx, cancellationToken: ct));

            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE booking_lines
                SET reserved_qty = GREATEST(reserved_qty - @qty, 0),
                    settled_qty = settled_qty + @qty
                WHERE id = @id
                """, new { qty = calc.SettledQty, id = calc.BookingLineId }, tx,
                cancellationToken: ct));
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO reservation_adjustments
                    (booking_id, booking_line_id, kind, quantity, amount, voucher_id, note,
                     created_by)
                VALUES (@bookingId, @bookingLineId, 'SETTLEMENT', @qty, @amount, @voucherId,
                        'تسوية حساب عميل', @userId)
                """, new
            {
                bookingId = calc.BookingId, bookingLineId = calc.BookingLineId,
                qty = calc.SettledQty, amount = Math.Max(calc.RefundAmount, 0),
                voucherId = settlementVoucherId, userId
            }, tx, cancellationToken: ct));
        }

        foreach (var group in calcs.GroupBy(c => c.BookingId))
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE bookings SET settled_amount = settled_amount + @amount WHERE id = @id
                """, new { amount = group.Sum(x => x.SettledQty * x.UnitPrice), id = group.Key },
                tx, cancellationToken: ct));

        await CreateDraftJournalAsync(connection, tx, settlementId,
            isNewBooking ? settlementId : voucherId,
            isNewBooking ? "manual" : "voucher", input, customer.Name, treasury, calcs,
            totalRefund, includeRefund: !isNewBooking, userId, ct);

        await tx.CommitAsync(ct);
        return new BookingSettlementResult
        {
            SettlementId = settlementId, VoucherId = settlementVoucherId ?? Guid.Empty,
            NewBookingId = newBookingId, NewBookingNo = newBookingNo,
            TotalRefund = totalRefund, TotalSettledQty = totalQty, LinesCount = calcs.Count
        };
    }
}
