using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IBookingSettlementRepository
{
    Task<BookingSettlementSheet?> GetSheetAsync(Guid branchId, Guid customerId,
        CancellationToken ct = default);
    Task<BookingSettlementResult> CreateAsync(Guid settlementId, Guid voucherId,
        BookingSettlementInput input, Guid userId, CancellationToken ct = default);
    Task<bool> PostAsync(Guid voucherId, Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<BookingSettlementReceiptLine>> GetReceiptLinesAsync(Guid voucherId,
        CancellationToken ct = default);
}

public sealed partial class BookingSettlementRepository : IBookingSettlementRepository
{
    private readonly IDbConnectionFactory _factory;
    public BookingSettlementRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<BookingSettlementSheet?> GetSheetAsync(Guid branchId, Guid customerId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var head = await connection.QuerySingleOrDefaultAsync<SheetHeader>(new CommandDefinition("""
            SELECT c.id AS CustomerId, c.name_ar AS CustomerName, c.code AS CustomerCode,
                   c.phone AS CustomerPhone, b.id AS BranchId, b.name_ar AS BranchName,
                   (SELECT MAX(x.doc_no) FROM bookings x
                    WHERE x.customer_id = c.id AND x.branch_id = b.id
                      AND x.status NOT IN ('cancelled', 'reversed')) AS PaperCode
            FROM customers c
            LEFT JOIN branches b ON b.id = @branchId
            WHERE c.id = @customerId
            """, new { customerId, branchId }, cancellationToken: ct));
        if (head is null) return null;

        var lines = (await connection.QueryAsync<BookingSettlementSheetRow>(
            new CommandDefinition("""
            SELECT r.booking_id AS BookingId, r.booking_line_id AS BookingLineId,
                   r.item_id AS ItemId, r.booking_no AS BookingNo, r.booking_date AS BookingDate,
                   r.item_code AS ItemCode, r.item_name AS ItemName,
                   r.booked_qty AS BookedQty, r.consumed_qty AS ConsumedQty,
                   r.remaining_qty AS RemainingQty, r.unit_price AS UnitPrice,
                   r.remaining_value AS RemainingValue,
                   CASE WHEN tot.remaining_value > 0
                        THEN ROUND((bk.deposit_amount + COALESCE(paid.paid_amount, 0)
                                    - COALESCE(settled.paid_amount, 0))
                                   * r.remaining_value / tot.remaining_value, 2)
                        ELSE 0 END AS PaidAmount
            FROM v_customer_reservations r
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
                SELECT COALESCE(SUM(l2.reserved_qty * l2.unit_price), 0) AS remaining_value
                FROM booking_lines l2 WHERE l2.booking_id = r.booking_id
            ) tot ON true
            WHERE r.branch_id = @branchId AND r.customer_id = @customerId
              AND r.remaining_qty > 0
            ORDER BY r.booking_date, r.booking_no NULLS LAST, r.item_code
            """, new { branchId, customerId }, cancellationToken: ct))).ToList();

        return new BookingSettlementSheet
        {
            CustomerId = head.CustomerId, CustomerName = head.CustomerName,
            CustomerCode = head.CustomerCode, CustomerPhone = head.CustomerPhone,
            BranchId = head.BranchId, BranchName = head.BranchName, PaperCode = head.PaperCode,
            Lines = lines
        };
    }

    private sealed class SheetHeader
    {
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = "";
        public string CustomerCode { get; set; } = "";
        public string? CustomerPhone { get; set; }
        public Guid BranchId { get; set; }
        public string? BranchName { get; set; }
        public string? PaperCode { get; set; }
    }
}
