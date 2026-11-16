using Dapper;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IReservationRepository
{
    Task<PagedResult<ReservationRow>> ListAsync(PageRequest request, IReadOnlyCollection<Guid> branchIds,
        Guid? customerId, bool onlyRemaining, string? customerSearch = null,
        CancellationToken ct = default);
    /// <summary>الخدمات غير المحصلة لكل العملاء مع فلترة التاريخ والترتيب — شاشة مستقلة.</summary>
    Task<IReadOnlyList<ReservationRow>> ListUncollectedAsync(DateTime? from, DateTime? to,
        Guid? branchId, bool isAdmin, IReadOnlyCollection<Guid> branchIds, string sort,
        CancellationToken ct = default);
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
        (@allBranches OR branch_id = ANY(@branchIds))
        AND (@customerId IS NULL OR customer_id = @customerId)
        AND (@customerSearch IS NULL OR @customerSearch = ''
             OR EXISTS (SELECT 1 FROM customers c
                        WHERE c.id = customer_id
                          AND c.search_text LIKE '%' || normalize_search(@customerSearch) || '%'))
        AND (NOT @onlyRemaining OR remaining_qty > 0)
        """;

    private readonly IDbConnectionFactory _factory;

    public ReservationRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<PagedResult<ReservationRow>> ListAsync(PageRequest request,
        IReadOnlyCollection<Guid> branchIds, Guid? customerId, bool onlyRemaining,
        string? customerSearch = null, CancellationToken ct = default)
    {
        var sql = $"""
            SELECT {Columns} FROM v_customer_reservations r
            WHERE {Filter}
            ORDER BY booking_no NULLS LAST, booking_line_id
            LIMIT @take OFFSET @offset;
            SELECT count(*)::int FROM v_customer_reservations WHERE {Filter};
            """;
        await using var connection = await _factory.OpenAsync(ct);
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, new
        {
            branchIds = branchIds.ToArray(),
            allBranches = branchIds.Count == 0,
            customerId,
            customerSearch,
            onlyRemaining,
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

    public async Task<IReadOnlyList<ReservationRow>> ListUncollectedAsync(DateTime? from,
        DateTime? to, Guid? branchId, bool isAdmin, IReadOnlyCollection<Guid> branchIds,
        string sort, CancellationToken ct = default)
    {
        var where = new List<string> { "r.remaining_qty > 0" };
        if (!isAdmin) where.Add("r.branch_id = ANY(@branchIds)");
        if (branchId.HasValue) where.Add("r.branch_id = @branchId");
        if (from.HasValue) where.Add("r.booking_date >= @from");
        if (to.HasValue) where.Add("r.booking_date <= @to");
        var order = sort switch
        {
            "date_asc" => "r.booking_date ASC, r.booking_no NULLS LAST, r.item_code",
            "value" => "r.remaining_value DESC, r.booking_date DESC",
            "customer" => "c.name_ar, r.booking_date DESC, r.item_code",
            _ => "r.booking_date DESC, r.booking_no DESC NULLS LAST, r.item_code"
        };
        var sql = $"""
            SELECT {Columns}, b.name_ar AS BranchName, c.code AS CustomerCode,
                   CASE WHEN tot.booked_value > 0
                        THEN LEAST(r.booked_qty * r.unit_price,
                             ROUND((bk.deposit_amount + COALESCE(paid.paid_amount, 0)
                                    - COALESCE(settled.paid_amount, 0))
                                   * (r.booked_qty * r.unit_price) / tot.booked_value, 2))
                        ELSE 0 END AS PaidAmount,
                   GREATEST(r.booked_qty * r.unit_price -
                     CASE WHEN tot.booked_value > 0
                          THEN LEAST(r.booked_qty * r.unit_price,
                               ROUND((bk.deposit_amount + COALESCE(paid.paid_amount, 0)
                                      - COALESCE(settled.paid_amount, 0))
                                     * (r.booked_qty * r.unit_price) / tot.booked_value, 2))
                          ELSE 0 END, 0) AS UncollectedValue
            FROM v_customer_reservations r
            JOIN branches b ON b.id = r.branch_id
            JOIN customers c ON c.id = r.customer_id
            JOIN bookings bk ON bk.id = r.booking_id
            LEFT JOIN (
                SELECT booking_id, SUM(amount) AS paid_amount
                FROM booking_payments GROUP BY booking_id
            ) paid ON paid.booking_id = r.booking_id
            LEFT JOIN (
                SELECT booking_id, SUM(paid_amount) AS paid_amount
                FROM customer_account_settlement_lines GROUP BY booking_id
            ) settled ON settled.booking_id = r.booking_id
            JOIN LATERAL (
                SELECT COALESCE(SUM(l2.quantity * l2.unit_price), 0) AS booked_value
                FROM booking_lines l2 WHERE l2.booking_id = r.booking_id
            ) tot ON true
            WHERE {string.Join(" AND ", where)}
            ORDER BY {order}
            LIMIT 5000
            """;
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<ReservationRow>(new CommandDefinition(sql, new
        {
            branchIds = branchIds.ToArray(), branchId, from, to
        }, cancellationToken: ct));
        return rows.ToList();
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
