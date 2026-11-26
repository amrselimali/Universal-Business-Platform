using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class PosRepository
{
    /// <summary>
    /// حذف إيصال قبض: المسودة تُحذف فعليًا (مع مدفوعات الحجز والقيد المسودة)،
    /// والمُرحّل يُعالَج بإيصال عكسي سالب وتعليم الأصل معكوسًا حتى تبقى القيود سليمة.
    /// </summary>
    public async Task<ReceiptDeleteResult> DeleteReceiptAsync(Guid id, Guid userId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var original = await LoadDeletableAsync(connection, tx, id, ct);

        if (original.Status == VoucherStatuses.Draft)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM booking_payments WHERE voucher_id = @id", new { id }, tx,
                cancellationToken: ct));
            await DeleteDraftReceiptEntryAsync(connection, tx, id, ct);
            var deleted = await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM vouchers WHERE id = @id AND status = 'draft'", new { id }, tx,
                cancellationToken: ct));
            if (deleted == 0)
                throw new ValidationAppException("validation.receipt_not_deletable");
            await tx.CommitAsync(ct);
            return new ReceiptDeleteResult { Deleted = true };
        }

        // مُرحّل: إيصال عكسي سالب + تعليم الأصل + إزالة مدفوعات الحجز (يرجع «غير المسدد»).
        var targetShiftId = await ResolveEditShiftAsync(connection, tx, original, ct);
        var reversalId = Guid.CreateVersion7();
        var reversalNo = await NextReceiptNoAsync(connection, tx, original.BranchId,
            original.DocDate, ct);
        await InsertEditedVoucherAsync(connection, tx, reversalId, reversalNo, original,
            original.CustomerId, original.PartyName ?? "", original.TreasuryId,
            -original.TotalAmount, -original.FeeTotal, -original.ProviderFeeTotal,
            VoucherReceiptTypes.Reversal, original.Id, targetShiftId, VoucherStatuses.Draft,
            userId, $"عكس إيصال {original.Id:N} — حذف", ct);

        var lines = (await connection.QueryAsync<(int LineNo, Guid MethodId, decimal Amount,
            decimal Fee, string? Reference)>(new CommandDefinition("""
            SELECT line_no AS LineNo, treasury_method_id AS MethodId, amount AS Amount,
                   fee_amount AS Fee, reference AS Reference
            FROM voucher_lines WHERE voucher_id = @id ORDER BY line_no
            """, new { id }, tx, cancellationToken: ct))).ToList();
        foreach (var line in lines)
            await InsertEditedLineAsync(connection, tx, reversalId, line.LineNo, line.MethodId,
                -line.Amount, -line.Fee, line.Reference, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE vouchers SET is_reversed = true, reversed_at = now(),
                updated_at = now(), updated_by = @userId
            WHERE id = @id
            """, new { id, userId }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM booking_payments WHERE voucher_id = @id", new { id }, tx,
            cancellationToken: ct));

        await tx.CommitAsync(ct);
        return new ReceiptDeleteResult
        {
            Deleted = false, ReversalId = reversalId,
            NeedsImmediatePosting = targetShiftId is null
        };
    }

    /// <summary>قواعد حذف الإيصال (يُرفض إيصال التسوية/المعكوس/الملغى/المرتبط بتسوية حجز).</summary>
    private static async Task<ReceiptEditRow> LoadDeletableAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid id, CancellationToken ct)
    {
        var original = await connection.QuerySingleOrDefaultAsync<ReceiptEditRow>(
            new CommandDefinition("""
            SELECT v.id AS Id, v.branch_id AS BranchId, v.doc_date AS DocDate,
                   v.party_id AS CustomerId, v.party_name AS PartyName,
                   v.treasury_id AS TreasuryId, v.total_amount AS TotalAmount,
                   v.fee_total AS FeeTotal, v.provider_fee_total AS ProviderFeeTotal,
                   v.shift_id AS ShiftId, v.status AS Status,
                   v.is_reversed AS IsReversed, v.receipt_type AS ReceiptType,
                   v.is_shift_settlement AS IsShiftSettlement,
                   COALESCE((SELECT s.review_status FROM cashier_shifts s
                             WHERE s.id = v.shift_id), '') AS ShiftReviewStatus
            FROM vouchers v
            WHERE v.id = @id AND v.voucher_type = 'receipt' FOR UPDATE OF v
            """, new { id }, tx, cancellationToken: ct)) ?? throw new NotFoundAppException();

        var links = new List<string>();
        if (original.IsReversed || original.ReceiptType == VoucherReceiptTypes.Reversal)
            links.Add("إيصال معكوس سابقًا");
        if (original.Status is not (VoucherStatuses.Draft or VoucherStatuses.Posted))
            links.Add($"حالة الإيصال: {original.Status}");
        if (original.IsShiftSettlement) links.Add("إيصال تسوية شفت الدكتور الخارجي");
        var used = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT count(*)::int FROM booking_settlements WHERE refund_voucher_id = @id",
            new { id }, tx, cancellationToken: ct));
        if (used > 0) links.Add($"تسويات حجز: {used}");
        if (links.Count > 0)
            throw new ValidationAppException("validation.receipt_not_deletable",
                new Dictionary<string, string> { ["links"] = string.Join(" • ", links) });

        // إيصال تسوية حساب عميل يُدار من شاشة تعديل الشفت (حذف التسوية نفسها).
        var isSettlement = await connection.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS (SELECT 1 FROM customer_account_settlements WHERE voucher_id = @id)",
            new { id }, tx, cancellationToken: ct));
        if (isSettlement)
            throw new ValidationAppException("validation.receipt_delete_settlement");
        return original;
    }

    /// <summary>حذف القيد المسودة المرتبط بالإيصال (المرحّل لا يُحذف).</summary>
    private static async Task DeleteDraftReceiptEntryAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid voucherId, CancellationToken ct)
    {
        var entryId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM journal_entries
            WHERE source_type = 'voucher' AND source_id = @id AND status = 'draft'
            FOR UPDATE
            """, new { id = voucherId }, tx, cancellationToken: ct));
        if (entryId is not { } journalId) return;
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM journal_entry_lines WHERE entry_id = @id", new { id = journalId }, tx,
            cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM journal_entries WHERE id = @id", new { id = journalId }, tx,
            cancellationToken: ct));
    }
}
