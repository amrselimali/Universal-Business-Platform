using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class ShiftEditRepository
{
    private sealed class EditExecutionRow
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = "";
        public string ExecutionType { get; set; } = ExecutionTypes.Original;
        public bool IsReversed { get; set; }
        public Guid? ShiftId { get; set; }
        public Guid BranchId { get; set; }
        public Guid BookingId { get; set; }
        public Guid LineId { get; set; }
        public Guid BookingLineId { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public Guid? EmployeeId { get; set; }
        public decimal NetAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal CostTotal { get; set; }
        public decimal UnitCost { get; set; }
        public decimal MeterUnits { get; set; }
        public Guid? MeteredAssetId { get; set; }
        public Guid ItemId { get; set; }
        public Guid UnitId { get; set; }
        public Guid? WarehouseId { get; set; }
        public decimal BookedQty { get; set; }
        public decimal DeliveredQty { get; set; }
    }

    /// <summary>تعديل خدمة منفذة: الأصل للأثر + عكسي سالب + معدّل مسودة يُرحَّل مع الشفت.</summary>
    private static async Task<bool> ApplyExecutionAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftLineEditInput input, Guid userId, CancellationToken ct)
    {
        if (input.LineId is not { } lineId)
            throw new ValidationAppException("validation.required_fields");
        var e = await connection.QuerySingleOrDefaultAsync<EditExecutionRow>(new CommandDefinition("""
            SELECT be.id AS Id, be.status AS Status, be.execution_type AS ExecutionType,
                   be.is_reversed AS IsReversed, be.shift_id AS ShiftId, be.branch_id AS BranchId,
                   be.booking_id AS BookingId, el.id AS LineId,
                   el.booking_line_id AS BookingLineId,
                   el.quantity AS Quantity, el.unit_price AS UnitPrice,
                   el.employee_id AS EmployeeId, el.net_amount AS NetAmount,
                   el.tax_amount AS TaxAmount, el.total_amount AS TotalAmount,
                   el.cost_total AS CostTotal, el.meter_units AS MeterUnits,
                   el.unit_cost AS UnitCost, el.metered_asset_id AS MeteredAssetId,
                   el.item_id AS ItemId, el.unit_id AS UnitId,
                   el.warehouse_id AS WarehouseId,
                   bl.quantity AS BookedQty, bl.delivered_qty AS DeliveredQty
            FROM booking_executions be
            JOIN booking_execution_lines el ON el.execution_id = be.id
            JOIN booking_lines bl ON bl.id = el.booking_line_id
            WHERE be.id = @docId AND el.id = @lineId
            FOR UPDATE OF be, el, bl
            """, new { docId = input.DocId, lineId }, tx, cancellationToken: ct))
            ?? throw new NotFoundAppException();

        // تعديل الحقول تباعًا: بعد إنشاء العكسي/المعدّل نحول الحقول التالية إلى المعدّل المسودة.
        if (e.IsReversed)
            return await RedirectToAdjustedAsync(connection, tx, input, userId, ct);

        if (e.Status is not (ExecutionStatuses.Draft or ExecutionStatuses.Posted) ||
            e.IsReversed || e.ExecutionType == ExecutionTypes.Reversal)
            throw new ValidationAppException("validation.shift_edit_locked");
        var hasChild = await connection.ExecuteScalarAsync<bool>(new CommandDefinition("""
            SELECT EXISTS (SELECT 1 FROM booking_executions
                           WHERE parent_execution_id = @id AND execution_type = 'REVERSAL')
            """, new { id = e.Id }, tx, cancellationToken: ct));
        if (hasChild) throw new ValidationAppException("validation.shift_edit_locked");

        var newQty = input.Field == "quantity" ? Dec(input.NewValue) : e.Quantity;
        var newPrice = input.Field == "unit_price" ? Dec(input.NewValue) : e.UnitPrice;
        var newEmployee = input.Field == "employee" ? GuidOrNull(input.NewValue) : e.EmployeeId;
        var newMeter = input.Field == "meter_units" ? Dec(input.NewValue) : e.MeterUnits;
        if (newQty <= 0) throw new ValidationAppException("validation.quantity_invalid");
        if (newPrice < 0) throw new ValidationAppException("validation.amount_invalid");
        if (input.Field == "meter_units")
        {
            // عدد البلصات مربوط بعدّاد أصل ثابت: لا تعديل بلا أصل، ولا قيمة سالبة، ويُعدَّل العداد نفسه.
            if (e.MeteredAssetId is null)
                throw new ValidationAppException("validation.item_not_metered");
            if (newMeter < 0) throw new ValidationAppException("validation.meter_value_invalid");
        }
        var delta = newQty - e.Quantity;
        if (delta > 0 && newQty > e.BookedQty - e.DeliveredQty + e.Quantity)
            throw new ValidationAppException("validation.booking_quantity_exceeds_remaining");
        if (delta == 0 && newPrice == e.UnitPrice && newEmployee == e.EmployeeId &&
            newMeter == e.MeterUnits) return true;

        var qtyRatio = e.Quantity == 0 ? 1 : newQty / e.Quantity;
        var priceRatio = e.UnitPrice == 0 ? 1 : newPrice / e.UnitPrice;
        var net = Math.Round(e.NetAmount * qtyRatio * priceRatio, 2, MidpointRounding.AwayFromZero);
        var tax = Math.Round(e.TaxAmount * qtyRatio * priceRatio, 2, MidpointRounding.AwayFromZero);
        var total = Math.Round(e.TotalAmount * qtyRatio * priceRatio, 2,
            MidpointRounding.AwayFromZero);

        // المعدّل ما زال مسودة: تُحدَّث قيمه مباشرة بدل إنشاء سلسلة عكس/تعديل جديدة.
        if (e.Status == ExecutionStatuses.Draft && e.ExecutionType == ExecutionTypes.Adjusted)
            return await UpdateDraftExecutionAsync(connection, tx, e, newQty, newPrice, newEmployee,
                net, tax, total, delta, newMeter, input.Field, userId, ct);

        var targetShiftId = await ResolveExecutionShiftAsync(connection, tx, e, ct);

        var reversalStatus = e.Status == ExecutionStatuses.Posted
            ? ExecutionStatuses.Draft : ExecutionStatuses.Cancelled;
        var reversalId = await InsertExecutionAsync(connection, tx, e, ExecutionTypes.Reversal,
            e.Id, targetShiftId, reversalStatus, userId, ct);
        await InsertExecutionLineAsync(connection, tx, reversalId, e, -e.Quantity,
            -e.NetAmount, -e.TaxAmount, -e.TotalAmount, -e.CostTotal, -e.MeterUnits,
            e.UnitPrice, e.EmployeeId, ct);

        var adjustedId = await InsertExecutionAsync(connection, tx, e, ExecutionTypes.Adjusted,
            e.Id, targetShiftId, ExecutionStatuses.Draft, userId, ct);
        await InsertExecutionLineAsync(connection, tx, adjustedId, e, newQty, net, tax, total,
            0, newMeter, newPrice, newEmployee, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_executions
            SET is_reversed = true, reversed_at = now(),
                status = CASE WHEN status = 'draft' THEN 'cancelled' ELSE status END
            WHERE id = @id
            """, new { id = e.Id }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_lines
            SET delivered_qty = GREATEST(delivered_qty - @oldQty + @newQty, 0),
                reserved_qty = GREATEST(reserved_qty - @delta, 0),
                employee_id = CASE WHEN @changeEmployee THEN @employee ELSE employee_id END
            WHERE id = @id
            """, new
        {
            oldQty = e.Quantity, newQty, delta, id = e.BookingLineId,
            changeEmployee = input.Field == "employee", employee = newEmployee
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

        if (targetShiftId is null)
        {
            var allowNegative = await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
                "SELECT allow_negative_stock FROM app_settings LIMIT 1", transaction: tx,
                cancellationToken: ct));
            if (reversalStatus == ExecutionStatuses.Draft)
                await BookingExecutionRepository.PostExecutionCoreAsync(connection, tx,
                    reversalId, userId, allowNegative, ct);
            await BookingExecutionRepository.PostExecutionCoreAsync(connection, tx, adjustedId,
                userId, allowNegative, ct);
        }
        return true;
    }

    private static async Task<Guid?> ResolveExecutionShiftAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, EditExecutionRow e, CancellationToken ct)
    {
        var open = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM cashier_shifts
            WHERE branch_id = @branchId AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
            """, new { branchId = e.BranchId }, tx, cancellationToken: ct));
        if (open is { } openShift) return openShift;
        if (e.ShiftId is { } shiftId)
        {
            var reviewed = await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
                "SELECT review_status = 'reviewed' FROM cashier_shifts WHERE id = @id",
                new { id = shiftId }, tx, cancellationToken: ct));
            if (!reviewed) return shiftId;
        }
        return null;
    }

    private static async Task<Guid> InsertExecutionAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, EditExecutionRow e, string type, Guid? parentId, Guid? shiftId,
        string status, Guid userId, CancellationToken ct)
    {
        var id = Guid.CreateVersion7();
        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
            SELECT next_document_number('EXECUTION'::varchar, @branchId::uuid, current_date,
                                        'EX'::varchar, 6::smallint)
            """, new { branchId = e.BranchId }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO booking_executions
                (id, branch_id, doc_no, execution_date, booking_id, status, execution_type,
                 parent_execution_id, shift_id, notes, created_by)
            VALUES (@id, @branchId, @docNo, current_date, @bookingId, @status, @type,
                    @parentId, @shiftId, @notes, @userId)
            """, new
        {
            id, branchId = e.BranchId, docNo, bookingId = e.BookingId, status, type, parentId,
            shiftId, notes = type == ExecutionTypes.Reversal ? "عكس تنفيذ خدمة" : "تنفيذ معدّل",
            userId
        }, tx, cancellationToken: ct));
        return id;
    }

    private static Task InsertExecutionLineAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid executionId, EditExecutionRow e, decimal quantity,
        decimal net, decimal tax, decimal total, decimal costTotal, decimal meterUnits,
        decimal unitPrice, Guid? employeeId, CancellationToken ct) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO booking_execution_lines
                (id, execution_id, booking_line_id, item_id, unit_id, warehouse_id, quantity,
                 unit_cost, cost_total, metered_asset_id, meter_units, employee_id, unit_price,
                 net_amount, tax_amount, total_amount)
            VALUES (@id, @executionId, @bookingLineId, @itemId, @unitId, @warehouseId, @quantity,
                    @unitCost, @costTotal, @meteredAssetId, @meterUnits, @employeeId, @unitPrice,
                    @net, @tax, @total)
            """, new
        {
            id = Guid.CreateVersion7(), executionId, bookingLineId = e.BookingLineId,
            itemId = e.ItemId, unitId = e.UnitId, warehouseId = e.WarehouseId, quantity,
            unitCost = e.UnitCost, costTotal, meteredAssetId = e.MeteredAssetId, meterUnits,
            employeeId, unitPrice, net, tax, total
        }, tx, cancellationToken: ct));
}
