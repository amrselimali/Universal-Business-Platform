using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingSettlementRepository
{
    /// <summary>إنشاء حجز عرض جديد بالقيمة المستحقة كدفعة مقدمة — بلا أي قيد محاسبي.</summary>
    private static async Task<(Guid Id, string DocNo)> CreateNewBookingAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, BookingSettlementInput input,
        IReadOnlyList<NewBookingLineInput> lines, decimal dueAmount, string customerName,
        Guid userId, CancellationToken ct)
    {
        var warehouseId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT w.id
            FROM warehouses w
            JOIN warehouse_branches wb ON wb.warehouse_id = w.id
            WHERE wb.branch_id = @branchId AND w.is_active
            ORDER BY w.code LIMIT 1
            """, new { branchId = input.BranchId }, tx, cancellationToken: ct));
        if (warehouseId is null)
            throw new ValidationAppException("validation.warehouse_required");

        var prepared = new List<(NewBookingLineInput Line, Guid ItemId, Guid UnitId, decimal Total)>();
        foreach (var line in lines)
        {
            var item = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid UnitId,
                bool IsActive)>(new CommandDefinition("""
                SELECT id, base_unit_id, is_active FROM items WHERE id = @id
                """, new { id = line.ItemId }, tx, cancellationToken: ct));
            if (item.Id == Guid.Empty || !item.IsActive)
                throw new ValidationAppException("validation.item_not_found");
            var total = Math.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);
            if (total <= 0) throw new ValidationAppException("validation.price_invalid");
            prepared.Add((line, item.Id, item.UnitId, total));
        }
        if (prepared.Count == 0)
            throw new ValidationAppException("validation.required_fields");

        var bookingTotal = Math.Round(prepared.Sum(p => p.Total), 2,
            MidpointRounding.AwayFromZero);
        var deposit = Math.Min(dueAmount, bookingTotal);
        var bookingId = Guid.CreateVersion7();
        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
            SELECT next_document_number('BOOK'::varchar, @branchId::uuid, @docDate::date,
                                        'BK'::varchar, 6::smallint)
            """, new { branchId = input.BranchId, docDate = input.DocDate.Date }, tx,
            cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO bookings
                (id, branch_id, doc_no, booking_date, status, notes, customer_id, source,
                 total_amount, deposit_amount, expires_at, created_by)
            VALUES (@bookingId, @branchId, @docNo, @docDate, 'confirmed', @notes, @customerId,
                    'manual', @total, @deposit, now() + interval '6 months', @userId)
            """, new
        {
            bookingId, branchId = input.BranchId, docNo, docDate = input.DocDate.Date,
            notes = string.IsNullOrWhiteSpace(input.NewBookingNotes)
                ? $"حجز عرض من تسوية حساب {customerName}"
                : input.NewBookingNotes.Trim(),
            customerId = input.CustomerId, total = bookingTotal, deposit, userId
        }, tx, cancellationToken: ct));

        short lineNo = 0;
        foreach (var entry in prepared)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO booking_lines
                    (id, booking_id, line_no, item_id, unit_id, warehouse_id, quantity,
                     unit_price, discount_percent, net_amount, tax_amount, total_amount,
                     reserved_qty, operation_type, notes)
                VALUES (@lineId, @bookingId, @lineNo, @itemId, @unitId, @warehouseId, @qty,
                        @price, 0, @total, 0, @total, @qty, 'normal', @notes)
                """, new
            {
                lineId = Guid.CreateVersion7(), bookingId, lineNo, itemId = entry.ItemId,
                unitId = entry.UnitId, warehouseId = warehouseId.Value,
                qty = entry.Line.Quantity, price = entry.Line.UnitPrice, total = entry.Total,
                notes = string.IsNullOrWhiteSpace(entry.Line.Notes) ? null : entry.Line.Notes.Trim()
            }, tx, cancellationToken: ct));
        }

        return (bookingId, docNo);
    }
}
