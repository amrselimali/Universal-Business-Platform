using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class PosRepository
{
    private static async Task<ReceiptEditRow> LoadEditableAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid id, CancellationToken ct)
    {
        var original = await connection.QuerySingleOrDefaultAsync<ReceiptEditRow>(
            new CommandDefinition("""
            SELECT v.id AS Id, v.branch_id AS BranchId, v.doc_date AS DocDate,
                   v.party_id AS CustomerId, v.party_name AS PartyName,
                   v.treasury_id AS TreasuryId, v.total_amount AS TotalAmount,
                   v.fee_total AS FeeTotal, v.shift_id AS ShiftId, v.status AS Status,
                   v.is_reversed AS IsReversed, v.receipt_type AS ReceiptType
            FROM vouchers v
            WHERE v.id = @id AND v.voucher_type = 'receipt' FOR UPDATE OF v
            """, new { id }, tx, cancellationToken: ct)) ?? throw new NotFoundAppException();
        if (original.Status != VoucherStatuses.Draft || original.IsReversed ||
            original.ReceiptType == VoucherReceiptTypes.Reversal || original.ShiftId is null)
            throw new ValidationAppException("validation.receipt_not_editable");
        var shiftOpen = await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM cashier_shifts WHERE id = @shiftId AND status = 'open')",
            new { shiftId = original.ShiftId }, tx, cancellationToken: ct));
        if (!shiftOpen) throw new ValidationAppException("validation.receipt_shift_closed");
        return original;
    }

    private static async Task<string> NextReceiptNoAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid branchId, DateTime docDate, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<string>(new CommandDefinition(
            "SELECT next_document_number('RCV'::varchar, @branchId::uuid, @date::date, " +
            "'RCV'::varchar, 6::smallint)", new { branchId, date = docDate.Date }, tx,
            cancellationToken: ct));

    private static Task InsertEditedVoucherAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid voucherId, string docNo, ReceiptEditRow original,
        Guid customerId, string customerName, Guid treasuryId, decimal amount, decimal fee,
        string receiptType, Guid parentId, Guid userId, string notes, CancellationToken ct) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO vouchers
                (id, branch_id, doc_date, doc_no, status, voucher_type, party_type, party_id,
                 party_name, treasury_id, total_amount, fee_total, receipt_type,
                 parent_receipt_id, shift_id, notes, created_by)
            VALUES (@voucherId, @branchId, @docDate, @docNo, 'draft', 'receipt', 'C', @customerId,
                    @customerName, @treasuryId, @amount, @fee, @receiptType, @parentId,
                    @shiftId, @notes, @userId)
            """, new
        {
            voucherId, branchId = original.BranchId, docDate = original.DocDate.Date, docNo,
            customerId, customerName, treasuryId, amount, fee, receiptType, parentId,
            shiftId = original.ShiftId, notes, userId
        }, tx, cancellationToken: ct));

    private static Task InsertEditedLineAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid voucherId, int lineNo, Guid methodId, decimal amount,
        decimal fee, string? reference, CancellationToken ct) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO voucher_lines (voucher_id, line_no, treasury_method_id, amount, fee_amount,
                reference)
            VALUES (@voucherId, @lineNo, @methodId, @amount, @fee, @reference)
            """, new { voucherId, lineNo, methodId, amount, fee, reference }, tx,
            cancellationToken: ct));

    private static async Task ReallocateBookingPaymentsAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid originalId, Guid adjustedId, ReceiptEditInput input,
        Guid userId, CancellationToken ct)
    {
        var rows = (await connection.QueryAsync<(Guid BookingId, decimal Amount)>(
            new CommandDefinition("""
            SELECT booking_id AS BookingId, amount AS Amount
            FROM booking_payments WHERE voucher_id = @voucherId ORDER BY created_at, booking_id
            """, new { voucherId = originalId }, tx, cancellationToken: ct))).ToList();
        if (rows.Count == 0) return;

        var paid = Math.Max(input.Amount - input.FeeAmount, 0);
        var originalPaid = rows.Sum(x => x.Amount);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM booking_payments WHERE voucher_id = @voucherId",
            new { voucherId = originalId }, tx, cancellationToken: ct));

        var remaining = paid;
        for (var i = 0; i < rows.Count; i++)
        {
            var amount = i == rows.Count - 1
                ? remaining
                : Math.Round(paid * rows[i].Amount / Math.Max(originalPaid, 1m), 2,
                    MidpointRounding.AwayFromZero);
            amount = Math.Min(amount, remaining);
            remaining = Math.Max(remaining - amount, 0);
            if (amount <= 0) continue;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO booking_payments (booking_id, voucher_id, amount, created_by, notes)
                VALUES (@bookingId, @voucherId, @amount, @userId, 'تعديل إيصال POS')
                """, new { rows[i].BookingId, voucherId = adjustedId, amount, userId }, tx,
                cancellationToken: ct));
        }
    }

    private sealed class ReceiptEditRow
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public DateTime DocDate { get; set; }
        public Guid CustomerId { get; set; }
        public string? PartyName { get; set; }
        public Guid TreasuryId { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal FeeTotal { get; set; }
        public Guid? ShiftId { get; set; }
        public string Status { get; set; } = "";
        public bool IsReversed { get; set; }
        public string ReceiptType { get; set; } = VoucherReceiptTypes.Original;
    }
}
