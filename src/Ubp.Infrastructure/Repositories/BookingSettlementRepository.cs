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
                   COALESCE(u.uncollected_value, 0) AS RemainingValue,
                   COALESCE(u.paid_amount, 0) AS PaidAmount
            FROM v_customer_reservations r
            JOIN bookings bk ON bk.id = r.booking_id
            LEFT JOIN v_customer_line_paid u
                   ON u.booking_line_id = r.booking_line_id
            WHERE r.branch_id = @branchId AND r.customer_id = @customerId
              AND (r.remaining_qty > 0 OR COALESCE(u.uncollected_value, 0) > 0)
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
