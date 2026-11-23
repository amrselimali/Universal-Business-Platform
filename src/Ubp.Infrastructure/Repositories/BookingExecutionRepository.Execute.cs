using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingExecutionRepository
{
    private sealed class ExecutionLine
    {
        public Guid BookingId { get; set; }
        public Guid BranchId { get; set; }
        public Guid CustomerId { get; set; }
        public string BookingStatus { get; set; } = "";
        public Guid ItemId { get; set; }
        public Guid? CategoryId { get; set; }
        public string ItemType { get; set; } = "GOODS";
        public string ExecutionMode { get; set; } = ItemExecutionModes.Reserved;
        public Guid UnitId { get; set; }
        public Guid WarehouseId { get; set; }
        public decimal Quantity { get; set; }
        public decimal DeliveredQty { get; set; }
        public decimal CancelledQty { get; set; }
        public decimal ReservedQty { get; set; }
        public decimal NetAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public bool ItemIsMetered { get; set; }
        public string OperationType { get; set; } = ServiceOperationTypes.Normal;
        public Guid? EmployeeId { get; set; }
        public Guid? TreatmentAccountId { get; set; }
        public string? ItemName { get; set; }
        public decimal UnitPrice { get; set; }
        /// <summary>الموظف المسجّل على بند الحجز وقت تسجيل الخدمة (علاجية) — 0088.</summary>
        public Guid? BookingLineEmployeeId { get; set; }
        /// <summary>فرع الموظف المسؤول/المنفذ — لمنع التنفيذ بموظف فرع آخر (0214).</summary>
        public Guid? EmployeeBranchId { get; set; }
    }

    public async Task<BookingExecutionResult> ExecuteAsync(BookingExecutionInput input,
        Guid userId, bool allowNegative, CancellationToken ct = default)
    {
        if (input.Quantity <= 0)
            throw new ValidationAppException("validation.quantity_invalid");
        if (input.MeterUnits < 0)
            throw new ValidationAppException("validation.meter_value_invalid");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var line = await connection.QuerySingleOrDefaultAsync<ExecutionLine>(new CommandDefinition("""
            SELECT l.booking_id AS BookingId, b.branch_id AS BranchId, b.customer_id AS CustomerId,
                   b.status AS BookingStatus, l.item_id AS ItemId, i.category_id AS CategoryId,
                   i.item_type AS ItemType, l.unit_id AS UnitId,
                   l.warehouse_id AS WarehouseId, l.quantity AS Quantity,
                   l.delivered_qty AS DeliveredQty, l.cancelled_qty AS CancelledQty,
                   l.reserved_qty AS ReservedQty, l.net_amount AS NetAmount,
                   l.tax_amount AS TaxAmount, l.total_amount AS TotalAmount,
                   i.is_metered AS ItemIsMetered, i.execution_mode AS ExecutionMode,
                   i.name_ar AS ItemName, l.unit_price AS UnitPrice,
                   l.employee_id AS BookingLineEmployeeId,
                   l.operation_type AS OperationType,
                   COALESCE(b.assigned_employee_id, l.employee_id) AS EmployeeId,
                   COALESCE(resp.branch_id, le.branch_id) AS EmployeeBranchId,
                   COALESCE(resp.treatment_account_id, le.treatment_account_id,
                            (SELECT pd.account_id FROM posting_defaults pd
                             WHERE pd.setting_key = 'employee_advances')) AS TreatmentAccountId
            FROM booking_lines l
            JOIN bookings b ON b.id = l.booking_id
            JOIN items i ON i.id = l.item_id
            LEFT JOIN employees resp ON resp.id = b.assigned_employee_id
            LEFT JOIN employees le ON le.id = l.employee_id
            WHERE l.id = @lineId
            FOR UPDATE OF l, b
            """, new { lineId = input.BookingLineId }, tx, cancellationToken: ct))
            ?? throw new NotFoundAppException();

        var direct = ItemExecutionModes.IsDirect(line.ExecutionMode);
        // 0214: الموظف المسؤول أو المنفّذ المختار يجب أن ينتمي لفرع التنفيذ (موظف الشركة بلا فرع مقبول).
        if (!BookingExecutionRules.EmployeeBelongsToBranch(line.EmployeeBranchId, line.BranchId))
            throw new ValidationAppException(BookingExecutionRules.BranchMismatchCode);
        if (input.EmployeeId is { } executorId)
        {
            var executorBranch = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
                "SELECT branch_id FROM employees WHERE id = @id",
                new { id = executorId }, tx, cancellationToken: ct));
            if (!BookingExecutionRules.EmployeeBelongsToBranch(executorBranch, line.BranchId))
                throw new ValidationAppException(BookingExecutionRules.BranchMismatchCode);
        }
        // جلسة علاجية: يمكن تنفيذها حتى لو الحجز مسودة (مسجّلة كعلاجية مسبقًا).
        if (!direct && line.OperationType != ServiceOperationTypes.Treatment &&
            line.BookingStatus is not (BookingStatuses.Confirmed or BookingStatuses.PartiallyDelivered))
            throw new ValidationAppException("validation.booking_not_confirmed");

        var remaining = line.Quantity - line.DeliveredQty - line.CancelledQty;
        if (input.Quantity > remaining)
            throw new ValidationAppException("validation.booking_quantity_exceeds_remaining");
        if (line.ItemIsMetered && !direct)
        {
            // الأصناف المرتبطة بعدّاد: الأصل والوحدات إجباريان (حصرًا على المرتبط بعدّاد).
            if (input.MeteredAssetId is null)
                throw new ValidationAppException("validation.asset_meter_required");
            if (input.MeterUnits <= 0)
                throw new ValidationAppException("validation.meter_units_required");
        }
        else if (!line.ItemIsMetered && (input.MeteredAssetId is not null || input.MeterUnits > 0))
        {
            throw new ValidationAppException("validation.item_not_metered");
        }

        var executionId = Guid.CreateVersion7();
        var executionLineId = Guid.CreateVersion7();
        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
            SELECT next_document_number('EXECUTION'::varchar, @branchId::uuid, @date::date,
                                        'EX'::varchar, 6::smallint)
            """, new { branchId = line.BranchId, date = DateTime.UtcNow.Date }, tx,
            cancellationToken: ct));
        var shiftId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM cashier_shifts
            WHERE branch_id = @branchId AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
            """, new { branchId = line.BranchId }, tx, cancellationToken: ct));

        // دورة التنفيذ أصبحت مسودة كاملة (مخزون + عدّاد + إيراد/تكلفة) وتُرحَّل مع الشفت.
        // القيم تُحفظ بنسبة الكمية المنفذة حتى لا تتأثر بتعديل بند الحجز لاحقًا.
        var ratio = line.Quantity <= 0 ? 0 : input.Quantity / line.Quantity;
        var net = Math.Round(line.NetAmount * ratio, 2, MidpointRounding.AwayFromZero);
        var tax = Math.Round(line.TaxAmount * ratio, 2, MidpointRounding.AwayFromZero);
        var total = Math.Round(line.TotalAmount * ratio, 2, MidpointRounding.AwayFromZero);

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO booking_executions
                (id, branch_id, doc_no, execution_date, booking_id, status, execution_type,
                 shift_id, notes, created_by)
            VALUES (@id, @branchId, @docNo, @date, @bookingId, 'draft', 'ORIGINAL',
                    @shiftId, @notes, @userId)
            """, new
        {
            id = executionId, line.BranchId, docNo, date = DateTime.UtcNow.Date,
            bookingId = line.BookingId, shiftId,
            notes = "تنفيذ من شاشة الحجوزات", userId
        }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO booking_execution_lines
                (id, execution_id, booking_line_id, item_id, unit_id, warehouse_id, quantity,
                 unit_cost, cost_total, metered_asset_id, meter_units, employee_id, unit_price,
                 net_amount, tax_amount, total_amount)
            VALUES (@id, @executionId, @bookingLineId, @itemId, @unitId, @warehouseId, @quantity,
                    0, 0, @meteredAssetId, @meterUnits, @executorId, @unitPrice, @net, @tax,
                    @total)
            """, new
        {
            id = executionLineId, executionId, bookingLineId = input.BookingLineId,
            itemId = line.ItemId, unitId = line.UnitId, warehouseId = line.WarehouseId,
            quantity = input.Quantity, meteredAssetId = input.MeteredAssetId,
            meterUnits = input.MeterUnits, executorId = input.EmployeeId,
            unitPrice = line.UnitPrice, net, tax, total
        }, tx, cancellationToken: ct));

        // تحرير حجز المخزون عند التنفيذ (المخزون نفسه يُصرف عند ترحيل الشفت).
        if (line.ItemType == "GOODS")
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE stock_balances
                SET reserved_qty = GREATEST(reserved_qty - @quantity, 0), updated_at = now()
                WHERE item_id = @itemId AND warehouse_id = @warehouseId
                """, new { quantity = input.Quantity, itemId = line.ItemId,
                    warehouseId = line.WarehouseId }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_lines
            SET delivered_qty = delivered_qty + @quantity,
                reserved_qty = GREATEST(reserved_qty - @quantity, 0)
            WHERE id = @id
            """, new { quantity = input.Quantity, id = input.BookingLineId }, tx,
            cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings b
            SET status = CASE WHEN NOT EXISTS (
                    SELECT 1 FROM booking_lines l
                    WHERE l.booking_id = b.id
                      AND (l.quantity - l.delivered_qty - l.cancelled_qty) > 0)
                THEN 'completed' ELSE 'partially_delivered' END,
                updated_by = @userId
            WHERE b.id = @bookingId
            """, new { bookingId = line.BookingId, userId }, tx, cancellationToken: ct));

        var meterValueAfter = 0m;
        if (input.MeteredAssetId is { } assetId)
        {
            var asset = await connection.QuerySingleOrDefaultAsync<(decimal Current, bool IsMetered,
                string Status, Guid? BranchId)>(new CommandDefinition("""
                SELECT current_meter_value AS Current, is_metered AS IsMetered, status AS Status,
                       branch_id AS BranchId
                FROM fixed_assets WHERE id = @id
                """, new { id = assetId }, tx, cancellationToken: ct));
            if (!asset.IsMetered || asset.Status != AssetStatuses.Active ||
                (asset.BranchId is not null && asset.BranchId != line.BranchId))
                throw new ValidationAppException("validation.asset_not_metered");
            meterValueAfter = asset.Current + input.MeterUnits;
        }

        // بلا شفت مفتوح: يُرحَّل التنفيذ فورًا حتى لا يبقى معلّقًا بلا شفت.
        var costTotal = 0m;
        if (shiftId is null)
        {
            await PostExecutionCoreAsync(connection, tx, executionId, userId, allowNegative, ct);
            costTotal = await connection.ExecuteScalarAsync<decimal>(new CommandDefinition(
                "SELECT COALESCE(SUM(cost_total), 0) FROM booking_execution_lines " +
                "WHERE execution_id = @id", new { id = executionId }, tx, cancellationToken: ct));
        }

        await tx.CommitAsync(ct);
        return new BookingExecutionResult
        {
            ExecutionId = executionId, BookingId = line.BookingId, DocNo = docNo,
            Quantity = input.Quantity, MeterUnits = input.MeterUnits,
            MeterValueAfter = meterValueAfter, CostTotal = costTotal
        };
    }
}
