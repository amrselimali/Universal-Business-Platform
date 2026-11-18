using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>ترحيل دورة التنفيذ المسودة مع الشفت (مخزون + عدّاد + إيراد/تكلفة) وعكسها.</summary>
public sealed partial class BookingExecutionRepository
{
    private sealed class PostExecutionHead
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public string? DocNo { get; set; }
        public string Status { get; set; } = "draft";
        public string ExecutionType { get; set; } = ExecutionTypes.Original;
    }

    private sealed class PostExecutionLine
    {
        public Guid Id { get; set; }
        public Guid BookingLineId { get; set; }
        public Guid ItemId { get; set; }
        public Guid UnitId { get; set; }
        public Guid? WarehouseId { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitCost { get; set; }
        public Guid? MeteredAssetId { get; set; }
        public decimal MeterUnits { get; set; }
        public Guid? EmployeeId { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal NetAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string ItemType { get; set; } = "GOODS";
        public string ExecutionMode { get; set; } = ItemExecutionModes.Reserved;
        public Guid? CategoryId { get; set; }
        public Guid CustomerId { get; set; }
        public string OperationType { get; set; } = ServiceOperationTypes.Normal;
        public Guid? TreatmentAccountId { get; set; }
        public Guid? EffectiveEmployeeId { get; set; }
    }

    public async Task<int> PostDraftsForShiftAsync(Guid shiftId, Guid userId, bool allowNegative,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var ids = (await connection.QueryAsync<Guid>(new CommandDefinition("""
            SELECT id FROM booking_executions
            WHERE shift_id = @shiftId AND status = 'draft'
            ORDER BY CASE WHEN execution_type = 'REVERSAL' THEN 0 ELSE 1 END,
                     created_at, id
            """, new { shiftId }, tx, cancellationToken: ct))).ToList();
        foreach (var id in ids)
            await PostExecutionCoreAsync(connection, tx, id, userId, allowNegative, ct);
        await tx.CommitAsync(ct);
        return ids.Count;
    }

    internal static async Task PostExecutionCoreAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid executionId, Guid userId, bool allowNegative,
        CancellationToken ct)
    {
        var head = await connection.QuerySingleOrDefaultAsync<PostExecutionHead>(
            new CommandDefinition("""
            SELECT id AS Id, branch_id AS BranchId, doc_no AS DocNo, status AS Status,
                   execution_type AS ExecutionType
            FROM booking_executions WHERE id = @id FOR UPDATE
            """, new { id = executionId }, tx, cancellationToken: ct))
            ?? throw new NotFoundAppException();
        if (head.Status != "draft") return;

        var lines = (await connection.QueryAsync<PostExecutionLine>(new CommandDefinition("""
            SELECT el.id AS Id, el.booking_line_id AS BookingLineId, el.item_id AS ItemId,
                   el.unit_id AS UnitId, el.warehouse_id AS WarehouseId,
                   el.quantity AS Quantity, el.unit_cost AS UnitCost,
                   el.metered_asset_id AS MeteredAssetId, el.meter_units AS MeterUnits,
                   el.employee_id AS EmployeeId, el.unit_price AS UnitPrice,
                   el.net_amount AS NetAmount, el.tax_amount AS TaxAmount,
                   el.total_amount AS TotalAmount, i.item_type AS ItemType,
                   i.execution_mode AS ExecutionMode, i.category_id AS CategoryId,
                   b.customer_id AS CustomerId,
                   bl.operation_type AS OperationType,
                   COALESCE(resp.treatment_account_id, le.treatment_account_id,
                            (SELECT pd.account_id FROM posting_defaults pd
                             WHERE pd.setting_key = 'employee_advances')) AS TreatmentAccountId,
                   COALESCE(b.assigned_employee_id, bl.employee_id) AS EffectiveEmployeeId
            FROM booking_execution_lines el
            JOIN booking_executions e ON e.id = el.execution_id
            JOIN booking_lines bl ON bl.id = el.booking_line_id
            JOIN bookings b ON b.id = bl.booking_id
            JOIN items i ON i.id = el.item_id
            LEFT JOIN employees resp ON resp.id = b.assigned_employee_id
            LEFT JOIN employees le ON le.id = bl.employee_id
            WHERE el.execution_id = @executionId
            ORDER BY el.created_at, el.id
            """, new { executionId }, tx, cancellationToken: ct))).ToList();

        Guid? firstStockDocumentId = null;
        Guid? journalEntryId = null;
        foreach (var line in lines)
        {
            var signed = line.Quantity;
            var cost = 0m;
            if (line.ItemType == "GOODS" && line.WarehouseId is { } warehouseId && signed != 0)
            {
                var (stockDocumentId, stockLineId, lineCost) = await PostStockLineAsync(
                    connection, tx, head, line, warehouseId, userId, allowNegative, ct);
                firstStockDocumentId ??= stockDocumentId;
                cost = lineCost;
                var storedCost = signed < 0 ? -Math.Abs(cost) : Math.Abs(cost);
                await connection.ExecuteAsync(new CommandDefinition("""
                    UPDATE booking_execution_lines
                    SET stock_document_line_id = @stockLineId,
                        unit_cost = @unitCost, cost_total = @cost
                    WHERE id = @id
                    """, new
                {
                    stockLineId, id = line.Id, cost = storedCost,
                    unitCost = Math.Abs(signed) == 0 ? 0 : Math.Round(cost / Math.Abs(signed), 6)
                }, tx, cancellationToken: ct));
            }

            if (cost > 0)
                journalEntryId = await PostExecutionCogsAsync(connection, tx, line, head,
                    cost, signed < 0, userId, ct) ?? journalEntryId;

            if (line.ItemType == "SERVICE" || ItemExecutionModes.IsDirect(line.ExecutionMode))
                journalEntryId = await PostExecutionRevenueAsync(connection, tx, line, head,
                    signed < 0, userId, ct) ?? journalEntryId;

            if (line.MeteredAssetId is { } assetId && line.MeterUnits != 0)
                await ApplyMeterAsync(connection, tx, assetId, line, head, userId, ct);
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_executions
            SET status = 'posted', posted_at = now(), posted_by = @userId,
                stock_document_id = @stockDocumentId, journal_entry_id = @journalEntryId
            WHERE id = @id
            """, new
        {
            id = executionId, userId, stockDocumentId = firstStockDocumentId,
            journalEntryId
        }, tx, cancellationToken: ct));
    }
}
