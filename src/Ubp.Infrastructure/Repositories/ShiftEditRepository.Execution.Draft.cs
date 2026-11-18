using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class ShiftEditRepository
{
    /// <summary>بعد إنشاء العكسي/المعدّل: الحقول التالية تُطبَّق على المعدّل المسودة.</summary>
    private static async Task<bool> RedirectToAdjustedAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftLineEditInput input, Guid userId, CancellationToken ct)
    {
        var target = await connection.QuerySingleOrDefaultAsync<(Guid ExecId, Guid LineId)>(
            new CommandDefinition("""
            SELECT e.id AS ExecId, el.id AS LineId
            FROM booking_executions e
            JOIN booking_execution_lines el ON el.execution_id = e.id
            WHERE e.parent_execution_id = @parentId AND e.execution_type = 'ADJUSTED'
              AND e.status = 'draft' AND NOT e.is_reversed
            ORDER BY e.created_at DESC, e.id DESC LIMIT 1
            """, new { parentId = input.DocId }, tx, cancellationToken: ct));
        if (target.ExecId == Guid.Empty)
            throw new ValidationAppException("validation.shift_edit_locked");
        return await ApplyExecutionAsync(connection, tx, new ShiftLineEditInput
        {
            ShiftId = input.ShiftId, EntityType = "booking_execution", DocId = target.ExecId,
            LineId = target.LineId, Field = input.Field, NewValue = input.NewValue,
            Note = input.Note
        }, userId, ct);
    }

    /// <summary>تحديث المعدّل المسودة في مكانه (لا آثار محاسبية بعد) مع تعديل كميات الحجز.</summary>
    private static async Task<bool> UpdateDraftExecutionAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, EditExecutionRow e, decimal newQty, decimal newPrice,
        Guid? newEmployee, decimal net, decimal tax, decimal total, decimal delta, string field,
        Guid userId, CancellationToken ct)
    {
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_execution_lines
            SET quantity = @qty, unit_price = @price, employee_id = @employee,
                net_amount = @net, tax_amount = @tax, total_amount = @total, cost_total = 0
            WHERE id = @id
            """, new
        {
            qty = newQty, price = newPrice, employee = newEmployee, net, tax, total, id = e.LineId
        }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_lines
            SET delivered_qty = GREATEST(delivered_qty - @oldQty + @newQty, 0),
                reserved_qty = GREATEST(reserved_qty - @delta, 0),
                employee_id = CASE WHEN @changeEmployee THEN @employee ELSE employee_id END
            WHERE id = @id
            """, new
        {
            oldQty = e.Quantity, newQty, delta, id = e.BookingLineId,
            changeEmployee = field == "employee", employee = newEmployee
        }, tx, cancellationToken: ct));

        if (e.WarehouseId is { } warehouseId && delta != 0)
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE stock_balances
                SET reserved_qty = GREATEST(reserved_qty - @delta, 0), updated_at = now()
                WHERE item_id = @itemId AND warehouse_id = @warehouseId
                """, new { delta, itemId = e.ItemId, warehouseId }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings b
            SET status = CASE WHEN NOT EXISTS (
                    SELECT 1 FROM booking_lines l
                    WHERE l.booking_id = b.id
                      AND (l.quantity - l.delivered_qty - l.cancelled_qty) > 0)
                THEN 'completed' ELSE 'partially_delivered' END,
                updated_by = @userId
            WHERE b.id = @bookingId
            """, new { bookingId = e.BookingId, userId }, tx, cancellationToken: ct));
        return true;
    }
}
