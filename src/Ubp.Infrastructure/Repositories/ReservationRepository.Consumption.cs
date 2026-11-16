using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class ReservationRepository
{
    /// <summary>
    /// تفاصيل الكمية المستهلكة: تُوزَّع على المصادر الفعلية —
    /// الأرصدة الافتتاحية (حجز أُنشئ عند تكويد العميل)، تحويلات الخدمات، والتنفيذ/التسويات.
    /// لا تمس القيود المحاسبية؛ للعرض التشغيلي فقط.
    /// </summary>
    public async Task<ConsumptionDetail?> GetConsumptionDetailAsync(Guid bookingLineId,
        CancellationToken ct = default)
    {
        const string sql = """
            SELECT r.consumed_qty AS ConsumedQty,
                   COALESCE(b.notes, '') = 'رصيد افتتاحي للخدمات' AS IsOpening,
                   COALESCE((
                       SELECT sum(el.quantity) FROM booking_execution_lines el
                       JOIN booking_executions ex ON ex.id = el.execution_id
                       WHERE el.booking_line_id = @bookingLineId AND ex.status = 'posted'
                   ), 0) AS ExecutedQty,
                   COALESCE((
                       SELECT count(DISTINCT ex.id) FROM booking_execution_lines el
                       JOIN booking_executions ex ON ex.id = el.execution_id
                       WHERE el.booking_line_id = @bookingLineId AND ex.status = 'posted'
                   ), 0)::int AS ExecutedDocs,
                   (SELECT min(ex.execution_date) FROM booking_execution_lines el
                    JOIN booking_executions ex ON ex.id = el.execution_id
                    WHERE el.booking_line_id = @bookingLineId AND ex.status = 'posted') AS ExecFirst,
                   (SELECT max(ex.execution_date) FROM booking_execution_lines el
                    JOIN booking_executions ex ON ex.id = el.execution_id
                    WHERE el.booking_line_id = @bookingLineId AND ex.status = 'posted') AS ExecLast,
                   COALESCE((
                       SELECT sum(tl.quantity) FROM service_transfer_lines tl
                       JOIN service_transfers t ON t.id = tl.transfer_id
                       WHERE tl.from_booking_line_id = @bookingLineId AND t.status = 'posted'
                   ), 0) AS TransferQty,
                   COALESCE((
                       SELECT count(DISTINCT t.id) FROM service_transfer_lines tl
                       JOIN service_transfers t ON t.id = tl.transfer_id
                       WHERE tl.from_booking_line_id = @bookingLineId AND t.status = 'posted'
                   ), 0)::int AS TransferDocs,
                   (SELECT min(t.doc_date) FROM service_transfer_lines tl
                    JOIN service_transfers t ON t.id = tl.transfer_id
                    WHERE tl.from_booking_line_id = @bookingLineId AND t.status = 'posted') AS TransferFirst,
                   (SELECT max(t.doc_date) FROM service_transfer_lines tl
                    JOIN service_transfers t ON t.id = tl.transfer_id
                    WHERE tl.from_booking_line_id = @bookingLineId AND t.status = 'posted') AS TransferLast
            FROM v_customer_reservations r
            JOIN booking_lines bl ON bl.id = r.booking_line_id
            JOIN bookings b ON b.id = bl.booking_id
            WHERE r.booking_line_id = @bookingLineId
            """;
        await using var connection = await _factory.OpenAsync(ct);
        var row = await connection.QuerySingleOrDefaultAsync<ConsumptionRow>(
            new CommandDefinition(sql, new { bookingLineId }, cancellationToken: ct));
        if (row is null) return null;

        var lines = new List<ConsumptionSourceLine>();
        var executionSource = row.IsOpening ? "consumption.source_opening" : "consumption.source_execution";
        if (row.ExecutedQty != 0)
            lines.Add(new ConsumptionSourceLine
            {
                Source = executionSource, Quantity = row.ExecutedQty, Documents = row.ExecutedDocs,
                FirstDate = row.ExecFirst, LastDate = row.ExecLast
            });
        if (row.TransferQty != 0)
            lines.Add(new ConsumptionSourceLine
            {
                Source = "consumption.source_transfer", Quantity = row.TransferQty,
                Documents = row.TransferDocs, FirstDate = row.TransferFirst,
                LastDate = row.TransferLast
            });
        var residual = row.ConsumedQty - row.ExecutedQty - row.TransferQty;
        if (residual != 0)
            lines.Add(new ConsumptionSourceLine
            {
                Source = "consumption.source_other", Quantity = residual,
                Note = "consumption.source_other_note"
            });
        if (lines.Count == 0 && row.ConsumedQty != 0)
            lines.Add(new ConsumptionSourceLine
            {
                Source = "consumption.source_other", Quantity = row.ConsumedQty,
                Note = "consumption.source_other_note"
            });

        return new ConsumptionDetail
        {
            BookingLineId = bookingLineId, TotalConsumed = row.ConsumedQty, Lines = lines
        };
    }

    private sealed class ConsumptionRow
    {
        public decimal ConsumedQty { get; set; }
        public bool IsOpening { get; set; }
        public decimal ExecutedQty { get; set; }
        public int ExecutedDocs { get; set; }
        public DateTime? ExecFirst { get; set; }
        public DateTime? ExecLast { get; set; }
        public decimal TransferQty { get; set; }
        public int TransferDocs { get; set; }
        public DateTime? TransferFirst { get; set; }
        public DateTime? TransferLast { get; set; }
    }
}