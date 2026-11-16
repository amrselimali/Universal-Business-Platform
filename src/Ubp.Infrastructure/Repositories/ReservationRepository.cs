using Dapper;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IReservationRepository
{
    Task<PagedResult<ReservationRow>> ListAsync(PageRequest request, IReadOnlyCollection<Guid> branchIds,
        Guid? customerId, bool onlyRemaining, string? customerSearch = null,
        CancellationToken ct = default, bool openOnly = false);
    /// <summary>تفاصيل سداد خدمة (إيصالات/تسويات) — نافذة تفاصيل المسدد.</summary>
    Task<PaymentDetail?> GetPaymentDetailAsync(Guid bookingLineId, CancellationToken ct = default);
    Task<IReadOnlyList<ReservationRow>> RemainingLinesAsync(Guid bookingId,
        CancellationToken ct = default);
    Task<Guid?> InsertAdjustmentAsync(Guid bookingId, Guid? bookingLineId, string kind,
        decimal quantity, decimal amount, Guid? voucherId, Guid? journalEntryId, string? note,
        Guid userId, CancellationToken ct = default);
    Task<bool> ExtendAsync(Guid bookingId, DateTimeOffset newExpiry, CancellationToken ct = default);
}

/// <summary>
/// قراءة الحجوزات من <c>v_customer_reservations</c> (مصدر واحد للكميات المحجوزة/المستهلكة/المتبقية)،
/// وسجل التحويلات التي تمنع تحويل نفس السطر مرتين.
/// </summary>
public sealed class ReservationRepository : IReservationRepository
{
    private const string Columns = """
        r.booking_id AS BookingId, r.branch_id AS BranchId, r.customer_id AS CustomerId,
        r.customer_name AS CustomerName, r.booking_status AS BookingStatus, r.booking_no AS BookingNo,
        r.booking_date AS BookingDate, r.booking_notes AS BookingNotes,
        r.deposit_amount AS DepositAmount, r.expires_at AS ExpiresAt, r.booking_line_id AS BookingLineId,
        r.item_id AS ItemId, r.item_code AS ItemCode, r.item_name AS ItemName,
        r.warehouse_id AS WarehouseId, r.warehouse_name AS WarehouseName, r.booked_qty AS BookedQty,
        r.reserved_qty AS ReservedQty, r.consumed_qty AS ConsumedQty, r.settled_qty AS SettledQty,
        r.remaining_qty AS RemainingQty, r.unit_price AS UnitPrice,
        r.remaining_value AS RemainingValue
        """;

    private const string Filter = """
        (@allBranches OR r.branch_id = ANY(@branchIds))
        AND (@customerId IS NULL OR r.customer_id = @customerId)
        AND (@customerSearch IS NULL OR @customerSearch = ''
             OR EXISTS (SELECT 1 FROM customers c
                        WHERE c.id = r.customer_id
                          AND c.search_text LIKE '%' || normalize_search(@customerSearch) || '%'))
        AND (NOT @onlyRemaining OR r.remaining_qty > 0)
        -- خدمات ما زالت مفتوحة: كمية متبقية أو مبلغ مستحق على العميل.
        AND (NOT @openOnly OR r.remaining_qty <> 0 OR COALESCE(u.uncollected_value, 0) <> 0)
        """;

    private readonly IDbConnectionFactory _factory;

    public ReservationRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<PagedResult<ReservationRow>> ListAsync(PageRequest request,
        IReadOnlyCollection<Guid> branchIds, Guid? customerId, bool onlyRemaining,
        string? customerSearch = null, CancellationToken ct = default, bool openOnly = false)
    {
        var sql = $"""
            SELECT {Columns},
                   COALESCE(u.paid_amount, 0) AS PaidAmount,
                   GREATEST(r.booked_qty * r.unit_price - COALESCE(u.paid_amount, 0), 0)
                       AS UncollectedValue
            FROM v_customer_reservations r
            LEFT JOIN v_customer_line_paid u ON u.booking_line_id = r.booking_line_id
            WHERE {Filter}
            ORDER BY r.booking_no NULLS LAST, r.booking_line_id
            LIMIT @take OFFSET @offset;
            SELECT count(*)::int FROM v_customer_reservations r
            LEFT JOIN v_customer_line_paid u ON u.booking_line_id = r.booking_line_id
            WHERE {Filter};
            """;
        await using var connection = await _factory.OpenAsync(ct);
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            branchIds = branchIds.ToArray(),
            allBranches = branchIds.Count == 0,
            customerId,
            customerSearch,
            onlyRemaining,
            openOnly,
            take = request.SafePageSize,
            offset = request.Offset
        }, cancellationToken: ct));

        var items = (await multi.ReadAsync<ReservationRow>()).ToList();
        var total = await multi.ReadFirstAsync<int>();
        return new PagedResult<ReservationRow>
        {
            Items = items, Total = total, Page = request.SafePage, PageSize = request.SafePageSize
        };
    }

    /// <summary>تفاصيل سداد خدمة: قيمة الخدمة، نصيب المسدد، ومصادر السداد (إيصالات/تسويات).</summary>
    public async Task<PaymentDetail?> GetPaymentDetailAsync(Guid bookingLineId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var head = await connection.QuerySingleOrDefaultAsync<PaymentDetail>(new CommandDefinition("""
            SELECT r.booking_no AS BookingNo, r.customer_name AS CustomerName,
                   r.item_name AS ItemName,
                   (r.booked_qty * r.unit_price) AS ServiceValue,
                   COALESCE(u.paid_amount, 0) AS PaidAmount
            FROM v_customer_reservations r
            LEFT JOIN v_customer_line_paid u ON u.booking_line_id = r.booking_line_id
            WHERE r.booking_line_id = @bookingLineId
            """, new { bookingLineId }, cancellationToken: ct));
        if (head is null) return null;

        var rows = await connection.QueryAsync<PaymentDetailRow>(new CommandDefinition("""
            SELECT kind AS Kind, doc_no AS DocNo, doc_date AS Date,
                   treasury_name AS TreasuryName, amount AS Amount
            FROM (
                SELECT 'ايصال قبض'::varchar AS kind, v.doc_no, v.doc_date,
                       t.name_ar AS treasury_name,
                       ROUND(bp.amount * (l.quantity * l.unit_price)
                             / NULLIF(b.total_amount, 0), 2) AS amount
                FROM booking_payments bp
                JOIN vouchers v ON v.id = bp.voucher_id
                LEFT JOIN treasuries t ON t.id = v.treasury_id
                JOIN bookings b ON b.id = bp.booking_id
                JOIN booking_lines l ON l.booking_id = b.id AND l.id = @bookingLineId
                WHERE bp.booking_id = b.id
                UNION ALL
                SELECT 'تسوية حساب عميل'::varchar, v.doc_no, s.doc_date, t.name_ar,
                       sl.paid_amount
                FROM customer_account_settlement_lines sl
                JOIN customer_account_settlements s ON s.id = sl.settlement_id
                LEFT JOIN vouchers v ON v.id = s.voucher_id
                LEFT JOIN treasuries t ON t.id = s.treasury_id
                WHERE sl.booking_line_id = @bookingLineId
                UNION ALL
                -- الدفعة المقدمة المسجلة مع الحجز: أرصدة افتتاحية عند تكويد العميل أو مقدمة حجز.
                SELECT CASE WHEN b.notes = 'رصيد افتتاحي للخدمات' THEN 'أرصدة افتتاحية'
                            ELSE 'دفعة مقدمة' END,
                       NULL::varchar, b.booking_date, NULL::text,
                       ROUND(b.deposit_amount
                             * (l.quantity * l.unit_price) / NULLIF(b.total_amount, 0), 2)
                FROM bookings b
                JOIN booking_lines l ON l.booking_id = b.id AND l.id = @bookingLineId
                WHERE b.deposit_amount > 0
            ) x
            ORDER BY doc_date, doc_no
            """, new { bookingLineId }, cancellationToken: ct));
        head.Rows = rows.ToList();
        return head;
    }

    public async Task<IReadOnlyList<ReservationRow>> RemainingLinesAsync(Guid bookingId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<ReservationRow>(new CommandDefinition(
            $"SELECT {Columns} FROM v_customer_reservations r " +
            "WHERE booking_id = @bookingId AND remaining_qty > 0 ORDER BY booking_line_id",
            new { bookingId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid?> InsertAdjustmentAsync(Guid bookingId, Guid? bookingLineId, string kind,
        decimal quantity, decimal amount, Guid? voucherId, Guid? journalEntryId, string? note,
        Guid userId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            INSERT INTO reservation_adjustments
                (booking_id, booking_line_id, kind, quantity, amount, voucher_id,
                 journal_entry_id, note, created_by)
            VALUES (@bookingId, @bookingLineId, @kind, @quantity, @amount, @voucherId,
                    @journalEntryId, @note, @userId)
            ON CONFLICT DO NOTHING
            RETURNING id
            """, new { bookingId, bookingLineId, kind, quantity, amount, voucherId,
                journalEntryId, note, userId }, cancellationToken: ct));
    }

    public async Task<bool> ExtendAsync(Guid bookingId, DateTimeOffset newExpiry,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings SET expires_at = @newExpiry
            WHERE id = @bookingId
              AND status IN ('draft', 'confirmed', 'partially_delivered', 'expired')
            """, new { bookingId, newExpiry = DbTime.Utc(newExpiry) }, cancellationToken: ct)) > 0;
    }
}
