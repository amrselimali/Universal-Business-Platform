using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingSettlementRepository
{
    public async Task<IReadOnlyList<BookingSettlementReceiptLine>> GetReceiptLinesAsync(
        Guid voucherId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<BookingSettlementReceiptLine>(
            new CommandDefinition("""
            SELECT i.name_ar AS ItemName, l.settled_qty AS SettledQty,
                   l.settled_qty AS RemainingQty, l.external_unit_price AS ExternalUnitPrice,
                   l.refund_amount AS RefundAmount
            FROM customer_account_settlements s
            JOIN customer_account_settlement_lines l ON l.settlement_id = s.id
            JOIN items i ON i.id = l.item_id
            WHERE s.voucher_id = @voucherId
            ORDER BY l.line_no
            """, new { voucherId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<bool> PostAsync(Guid voucherId, Guid userId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var posted = await PostCoreAsync(connection, tx, voucherId, userId, ct);
        await tx.CommitAsync(ct);
        return posted;
    }

    internal static async Task<bool> IsSettlementVoucherAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid voucherId, CancellationToken ct = default) =>
        await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM customer_account_settlements WHERE voucher_id = @voucherId)",
            new { voucherId }, tx, cancellationToken: ct));

    /// <summary>ترحيل إيصال تسوية (وقيده المسودة) داخل معاملة الشفت أو ترحيل السند.</summary>
    internal static async Task<bool> PostCoreAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid voucherId, Guid userId, CancellationToken ct = default)
    {
        var head = await connection.QuerySingleOrDefaultAsync<PostSettlement>(new CommandDefinition("""
            SELECT s.id AS SettlementId, s.branch_id AS BranchId, s.doc_date AS DocDate,
                   s.journal_entry_id AS JournalEntryId, s.status AS SettlementStatus,
                   v.status AS VoucherStatus, v.doc_no AS DocNo
            FROM customer_account_settlements s
            JOIN vouchers v ON v.id = s.voucher_id
            WHERE s.voucher_id = @voucherId FOR UPDATE OF s, v
            """, new { voucherId }, tx, cancellationToken: ct));
        if (head is null) return false;
        if (head.VoucherStatus == VoucherStatuses.Posted) return true;

        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
            SELECT next_document_number('RCV'::varchar, @branchId::uuid, @docDate::date,
                                        'RCV'::varchar, 6::smallint)
            """, new { branchId = head.BranchId, docDate = head.DocDate }, tx,
            cancellationToken: ct));

        if (head.JournalEntryId.HasValue)
            await connection.ExecuteAsync(new CommandDefinition(
                "SELECT fn_gl_post_entry(@entryId, @userId)",
                new { entryId = head.JournalEntryId.Value, userId }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE vouchers SET status = 'posted', doc_no = @docNo, posted_at = now(),
                posted_by = @userId, journal_entry_id = @entryId, updated_by = @userId
            WHERE id = @voucherId AND status = 'draft'
            """, new { docNo, userId, entryId = head.JournalEntryId, voucherId }, tx,
            cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE customer_account_settlements
            SET status = 'posted', posted_at = now(), posted_by = @userId
            WHERE id = @settlementId AND status = 'draft'
            """, new { settlementId = head.SettlementId, userId }, tx, cancellationToken: ct));
        return true;
    }

    private sealed class PostSettlement
    {
        public Guid SettlementId { get; set; }
        public Guid BranchId { get; set; }
        public DateTime DocDate { get; set; }
        public Guid? JournalEntryId { get; set; }
        public string SettlementStatus { get; set; } = "";
        public string VoucherStatus { get; set; } = "";
        public string? DocNo { get; set; }
    }
}
