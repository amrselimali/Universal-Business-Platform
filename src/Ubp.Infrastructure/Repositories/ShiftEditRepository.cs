using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IShiftEditRepository
{
    Task<IReadOnlyList<ShiftEditableLine>> ListEditableAsync(Guid shiftId,
        CancellationToken ct = default);
    Task<ShiftEditOutcome> ApplyAsync(ShiftLineEditInput input, Guid userId,
        CancellationToken ct = default);
    /// <summary>حذف سطر (وليس تعديله) — يُشترط أن يكون السطر بلا تنفيذ/حركة ومستنده مسودة.</summary>
    Task<ShiftLineDeleteResult> DeleteLineAsync(ShiftLineDeleteInput input, Guid userId,
        CancellationToken ct = default);
}

/// <summary>
/// تعديل موحّد لسطور مستندات الشفت (مسودة) من تقرير الشفت: يسمح أثناء الشفت المفتوحة
/// (اليوزر العادي) أو أثناء الانتظار للمراجعة (المحاسب)، ويعدّل المستند الأصلي بكل آثاره — 0089.
/// </summary>
public sealed partial class ShiftEditRepository : IShiftEditRepository
{
    private readonly IDbConnectionFactory _factory;
    public ShiftEditRepository(IDbConnectionFactory factory) => _factory = factory;

    private sealed class ShiftWindow
    {
        public Guid BranchId { get; set; }
        public DateTimeOffset OpenedAt { get; set; }
        public DateTimeOffset? ClosedAt { get; set; }
        public string Status { get; set; } = "";
        public string ReviewStatus { get; set; } = "";
    }

    private static async Task<ShiftWindow> LoadShiftAsync(NpgsqlConnection connection,
        Guid shiftId, NpgsqlTransaction? tx, CancellationToken ct)
    {
        var shift = await connection.QuerySingleOrDefaultAsync<ShiftWindow>(new CommandDefinition("""
            SELECT branch_id AS BranchId, opened_at AS OpenedAt, closed_at AS ClosedAt,
                   status AS Status, review_status AS ReviewStatus
            FROM cashier_shifts WHERE id = @shiftId
            """, new { shiftId }, tx, cancellationToken: ct));
        return shift ?? throw new NotFoundAppException();
    }

    public async Task<IReadOnlyList<ShiftEditableLine>> ListEditableAsync(Guid shiftId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var s = await LoadShiftAsync(connection, shiftId, null, ct);
        var args = new { branchId = s.BranchId, openedAt = s.OpenedAt, until = s.ClosedAt,
            shiftId = shiftId };
        var rows = new List<ShiftEditableLine>();

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'voucher' AS EntityType, v.id AS DocId, v.doc_no AS DocNo, v.doc_date AS DocDate,
                   l.id AS LineId, v.party_name AS PartyName, NULL::text AS ItemName,
                   NULL::text AS EmployeeName, t.name_ar AS TreasuryName,
                   0::numeric AS Quantity, l.amount AS UnitPrice, l.amount AS Amount,
                   NULL::text AS Description,
                   CASE WHEN v.status = 'posted' THEN 'amount' ELSE 'amount,treasury' END AS FieldsCsv,
                   v.treasury_id AS TreasuryId, NULL::uuid AS AccountId, NULL::uuid AS EmployeeId,
                   v.status AS DocStatus,
                   (v.status = 'draft' AND NOT EXISTS (SELECT 1 FROM customer_account_settlements bs
                                                       WHERE bs.voucher_id = v.id)) AS CanDelete
            FROM vouchers v JOIN voucher_lines l ON l.voucher_id = v.id
            JOIN treasuries t ON t.id = v.treasury_id
            WHERE v.branch_id = @branchId AND v.status <> 'cancelled' AND v.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR v.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'operating_expense' AS EntityType, o.id AS DocId, o.doc_no AS DocNo,
                   o.doc_date AS DocDate, l.id AS LineId, s.name_ar AS PartyName,
                   i.name_ar AS ItemName, NULL::text AS EmployeeName, t.name_ar AS TreasuryName,
                   l.quantity AS Quantity, l.unit_price AS UnitPrice, l.amount AS Amount,
                   l.description AS Description,
                   CASE WHEN o.status = 'POSTED'
                        THEN 'description,quantity,unit_price,amount'
                        ELSE 'account,treasury,description,quantity,unit_price,amount' END AS FieldsCsv,
                   o.treasury_id AS TreasuryId, l.account_id AS AccountId, NULL::uuid AS EmployeeId,
                   o.status AS DocStatus, (o.status = 'DRAFT') AS CanDelete
            FROM operating_expenses o
            JOIN operating_expense_lines l ON l.expense_id = o.id
            JOIN suppliers s ON s.id = o.supplier_id
            LEFT JOIN items i ON i.id = l.item_id
            LEFT JOIN treasuries t ON t.id = o.treasury_id
            WHERE o.branch_id = @branchId AND o.status IN ('DRAFT', 'POSTED') AND o.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR o.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'commercial_document' AS EntityType, d.id AS DocId, d.doc_no AS DocNo,
                   d.doc_date AS DocDate, l.id AS LineId, d.party_name AS PartyName,
                   i.name_ar AS ItemName, NULL::text AS EmployeeName, NULL::text AS TreasuryName,
                   l.quantity AS Quantity, l.unit_price AS UnitPrice, l.total_amount AS Amount,
                   l.description AS Description,
                   'quantity,unit_price,amount,description' AS FieldsCsv,
                   NULL::uuid AS TreasuryId, NULL::uuid AS AccountId, NULL::uuid AS EmployeeId,
                   d.status AS DocStatus, (d.status = 'draft') AS CanDelete
            FROM commercial_documents d
            JOIN commercial_document_lines l ON l.document_id = d.id
            JOIN items i ON i.id = l.item_id
            WHERE d.branch_id = @branchId AND d.status = 'draft' AND d.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR d.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'booking' AS EntityType, b.id AS DocId, b.doc_no AS DocNo,
                   b.booking_date AS DocDate, l.id AS LineId, c.name_ar AS PartyName,
                   i.name_ar AS ItemName, e.name_ar AS EmployeeName, NULL::text AS TreasuryName,
                   l.quantity AS Quantity, l.unit_price AS UnitPrice, l.total_amount AS Amount,
                   NULL::text AS Description, 'quantity,unit_price,employee' AS FieldsCsv,
                   NULL::uuid AS TreasuryId, NULL::uuid AS AccountId,
                   COALESCE(l.employee_id, b.assigned_employee_id) AS EmployeeId,
                   b.status AS DocStatus,
                   (l.delivered_qty = 0 AND l.invoiced_qty = 0 AND l.transferred_qty = 0
                    AND l.settled_qty = 0) AS CanDelete
            FROM bookings b JOIN booking_lines l ON l.booking_id = b.id
            JOIN customers c ON c.id = b.customer_id
            JOIN items i ON i.id = l.item_id
            LEFT JOIN employees e ON e.id = COALESCE(l.employee_id, b.assigned_employee_id)
            WHERE b.branch_id = @branchId AND b.status IN ('draft', 'confirmed')
              AND b.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR b.created_at <= @until::timestamptz)
              AND l.delivered_qty = 0
            """, args, cancellationToken: ct)));

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'booking_execution' AS EntityType, be.id AS DocId, be.doc_no AS DocNo,
                   be.execution_date AS DocDate, el.id AS LineId, c.name_ar AS PartyName,
                   i.name_ar AS ItemName, exe.name_ar AS EmployeeName,
                   NULL::text AS TreasuryName, el.quantity AS Quantity,
                   el.unit_price AS UnitPrice, el.total_amount AS Amount,
                   NULL::text AS Description,
                   CASE WHEN el.metered_asset_id IS NULL THEN 'quantity,unit_price,employee'
                        ELSE 'quantity,unit_price,employee,meter_units' END AS FieldsCsv,
                   NULL::uuid AS TreasuryId, NULL::uuid AS AccountId, el.employee_id AS EmployeeId,
                   be.status AS DocStatus, bl.id AS BookingLineId, be.shift_id AS ShiftId,
                   el.meter_units AS MeterUnits, el.metered_asset_id AS MeteredAssetId,
                   fa.name_ar AS MeteredAssetName, false AS CanDelete
            FROM booking_executions be
            JOIN booking_execution_lines el ON el.execution_id = be.id
            JOIN booking_lines bl ON bl.id = el.booking_line_id
            JOIN bookings b ON b.id = bl.booking_id
            JOIN customers c ON c.id = b.customer_id
            JOIN items i ON i.id = el.item_id
            LEFT JOIN employees exe ON exe.id = el.employee_id
            LEFT JOIN fixed_assets fa ON fa.id = el.metered_asset_id
            WHERE be.branch_id = @branchId AND be.status IN ('draft', 'posted')
              AND NOT be.is_reversed AND be.execution_type <> 'REVERSAL'
              AND (be.shift_id = @shiftId
                   OR (be.shift_id IS NULL AND be.created_at >= @openedAt
                       AND (@until::timestamptz IS NULL OR be.created_at <= @until::timestamptz)))
            """, args, cancellationToken: ct)));

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'service_transfer' AS EntityType, st.id AS DocId, st.doc_no AS DocNo,
                   st.doc_date AS DocDate, l.id AS LineId,
                   (fc.name_ar || ' → ' || tc.name_ar) AS PartyName, i.name_ar AS ItemName,
                   NULL::text AS EmployeeName, NULL::text AS TreasuryName,
                   l.quantity AS Quantity, l.unit_price AS UnitPrice, l.amount AS Amount,
                   NULL::text AS Description, 'quantity' AS FieldsCsv,
                   NULL::uuid AS TreasuryId, NULL::uuid AS AccountId, NULL::uuid AS EmployeeId,
                   st.status AS DocStatus, (st.status = 'draft') AS CanDelete
            FROM service_transfers st JOIN service_transfer_lines l ON l.transfer_id = st.id
            JOIN items i ON i.id = l.item_id
            JOIN customers fc ON fc.id = st.from_customer_id
            JOIN customers tc ON tc.id = st.to_customer_id
            WHERE st.branch_id = @branchId AND st.status = 'draft' AND st.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR st.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'customer_settlement' AS EntityType, s.id AS DocId,
                   COALESCE(v.doc_no, left(s.id::text, 8)) AS DocNo, s.doc_date AS DocDate,
                   NULL::uuid AS LineId, c.name_ar AS PartyName,
                   (SELECT string_agg(g.label, ' • ' ORDER BY g.label)
                    FROM (SELECT i.name_ar || ' × ' ||
                                 trim(to_char(SUM(l.settled_qty), 'FM999999990.##')) AS label
                          FROM customer_account_settlement_lines l
                          JOIN items i ON i.id = l.item_id
                          WHERE l.settlement_id = s.id
                          GROUP BY i.id, i.name_ar) g) AS ItemName,
                   NULL::text AS EmployeeName, t.name_ar AS TreasuryName,
                   s.total_settled_qty AS Quantity, 0::numeric AS UnitPrice,
                   s.total_refund AS Amount,
                   CASE WHEN s.settlement_type = 'new_booking' THEN 'تسوية بحجز عرض جديد'
                        ELSE 'تسوية واسترداد نقدي' END AS Description,
                   '' AS FieldsCsv, s.treasury_id AS TreasuryId, NULL::uuid AS AccountId,
                   NULL::uuid AS EmployeeId, s.status AS DocStatus,
                   (s.status = 'draft' AND (v.id IS NULL OR v.status = 'draft')) AS CanDelete
            FROM customer_account_settlements s
            JOIN customers c ON c.id = s.customer_id
            LEFT JOIN treasuries t ON t.id = s.treasury_id
            LEFT JOIN vouchers v ON v.id = s.voucher_id
            WHERE s.branch_id = @branchId AND s.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR s.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        // سلف الموظفين المصروفة من شاشة المصروفات: تُعدَّل قيمتها وتُحذف بعكس قيدها.
        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'employee_advance' AS EntityType, a.id AS DocId, a.doc_no AS DocNo,
                   a.doc_date AS DocDate, NULL::uuid AS LineId, e.name_ar AS PartyName,
                   NULL::text AS ItemName, e.name_ar AS EmployeeName, t.name_ar AS TreasuryName,
                   0::numeric AS Quantity, 0::numeric AS UnitPrice, a.amount AS Amount,
                   a.notes AS Description, 'amount,description' AS FieldsCsv,
                   a.treasury_id AS TreasuryId, a.charge_account_id AS AccountId,
                   a.employee_id AS EmployeeId, a.status AS DocStatus, true AS CanDelete
            FROM employee_advances a
            JOIN employees e ON e.id = a.employee_id
            JOIN treasuries t ON t.id = a.treasury_id
            WHERE a.branch_id = @branchId AND a.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR a.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        // تسليمات النقدية للوسيط: تُعدَّل قيمتها وتُحذف بعكس قيدها.
        rows.AddRange(await connection.QueryAsync<ShiftEditableLine>(new CommandDefinition("""
            SELECT 'cash_handover' AS EntityType, h.id AS DocId,
                   'CH-' || left(h.id::text, 8) AS DocNo, h.doc_date AS DocDate,
                   NULL::uuid AS LineId, a.name_ar AS PartyName, NULL::text AS ItemName,
                   NULL::text AS EmployeeName, t.name_ar AS TreasuryName,
                   0::numeric AS Quantity, 0::numeric AS UnitPrice, h.amount AS Amount,
                   CASE WHEN h.commission_amount > 0
                        THEN COALESCE(h.notes || ' — ', '') || 'عمولة تسليم: ' ||
                             to_char(h.commission_amount, 'FM999,999,990.00')
                        ELSE h.notes END AS Description,
                   'amount,description' AS FieldsCsv, h.treasury_id AS TreasuryId,
                   h.clearing_account_id AS AccountId, NULL::uuid AS EmployeeId,
                   'posted'::varchar AS DocStatus, true AS CanDelete
            FROM cash_handovers h
            JOIN treasuries t ON t.id = h.treasury_id
            JOIN accounts a ON a.id = h.clearing_account_id
            WHERE h.branch_id = @branchId AND h.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR h.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        return rows;
    }
}
