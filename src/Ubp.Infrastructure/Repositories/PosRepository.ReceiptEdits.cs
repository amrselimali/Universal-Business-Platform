using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class PosRepository
{
    /// <summary>
    /// تعديل إيصال POS: قفل الأصل وإنشاء إيصال عكسي سالب وإيصال معدّل، ثم ترحيلهما مع الشفت
    /// (أو فورًا إن لم يوجد شفت مفتوح/معلّق). يعمل للأصل المسودة أو المُرحّل بصلاحية مستقلة.
    /// </summary>
    public async Task<ReceiptEditResult> EditReceiptAsync(Guid id, ReceiptEditInput input,
        Guid userId, CancellationToken ct = default)
    {
        if (input.Amount <= 0 || input.FeeAmount < 0 || input.FeeAmount >= input.Amount)
            throw new ValidationAppException("validation.voucher_amount");
        if (input.CustomerId == Guid.Empty || input.TreasuryId == Guid.Empty ||
            input.TreasuryMethodId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var original = await LoadEditableAsync(connection, tx, id, ct);

        var treasury = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId)>(
            new CommandDefinition("""
            SELECT t.id AS Id, t.branch_id AS BranchId
            FROM treasuries t JOIN treasury_methods m ON m.treasury_id = t.id AND m.id = @methodId
            WHERE t.id = @treasuryId AND t.is_active
            """, new { treasuryId = input.TreasuryId, methodId = input.TreasuryMethodId }, tx,
            cancellationToken: ct));
        if (treasury.Id == Guid.Empty)
            throw new ValidationAppException("validation.treasury_method_not_found");
        var customer = await connection.QuerySingleOrDefaultAsync<(Guid Id, string Name)>(
            new CommandDefinition("SELECT id AS Id, name_ar AS Name FROM customers " +
                                  "WHERE id = @id AND is_active", new { id = input.CustomerId },
                tx, cancellationToken: ct));
        if (customer.Id == Guid.Empty)
            throw new ValidationAppException("validation.customer_not_found");

        var lines = (await connection.QueryAsync<(int LineNo, Guid MethodId, decimal Amount,
            decimal Fee, string? Reference)>(new CommandDefinition("""
            SELECT line_no AS LineNo, treasury_method_id AS MethodId, amount AS Amount,
                   fee_amount AS Fee, reference AS Reference
            FROM voucher_lines WHERE voucher_id = @id ORDER BY line_no
            """, new { id }, tx, cancellationToken: ct))).ToList();
        if (lines.Count == 0)
            throw new ValidationAppException("validation.document_has_no_lines");

        // شفت الترحيل: الشفت المفتوح الحالي، وإلا شفت الأصل المغلقة بانتظار المراجعة.
        var targetShiftId = await ResolveEditShiftAsync(connection, tx, original, ct);
        var originalWasPosted = original.Status == VoucherStatuses.Posted;

        var reversalId = Guid.CreateVersion7();
        var adjustedId = Guid.CreateVersion7();
        var reversalNo = await NextReceiptNoAsync(connection, tx, original.BranchId,
            original.DocDate, ct);
        var adjustedNo = await NextReceiptNoAsync(connection, tx, original.BranchId,
            original.DocDate, ct);

        // الأصل المسودة لم يُرحَّل بعد، فلا حاجة لترحيل العكسي: يُحفظ ملغى للأثر فقط.
        await InsertEditedVoucherAsync(connection, tx, reversalId, reversalNo, original,
            input.CustomerId, customer.Name, input.TreasuryId, -original.TotalAmount,
            -original.FeeTotal, VoucherReceiptTypes.Reversal, original.Id, targetShiftId,
            VoucherStatuses.Draft, userId, $"عكس إيصال {original.Id:N} — تعديل", ct);
        foreach (var line in lines)
            await InsertEditedLineAsync(connection, tx, reversalId, line.LineNo, line.MethodId,
                -line.Amount, -line.Fee, line.Reference, ct);
        if (!originalWasPosted)
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE vouchers SET status = 'cancelled' WHERE id = @id",
                new { id = reversalId }, tx, cancellationToken: ct));

        await InsertEditedVoucherAsync(connection, tx, adjustedId, adjustedNo, original,
            input.CustomerId, customer.Name, input.TreasuryId, input.Amount, input.FeeAmount,
            VoucherReceiptTypes.Adjusted, original.Id, targetShiftId, VoucherStatuses.Draft,
            userId, string.IsNullOrWhiteSpace(input.Notes) ? "إيصال معدّل" : input.Notes.Trim(),
            ct);
        await InsertEditedLineAsync(connection, tx, adjustedId, 1, input.TreasuryMethodId,
            input.Amount, input.FeeAmount, null, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE vouchers SET
                status = CASE WHEN status = 'draft' THEN 'cancelled' ELSE status END,
                is_reversed = true, reversed_at = now(),
                updated_at = now(), updated_by = @userId
            WHERE id = @id AND status IN ('draft', 'posted')
            """, new { id, userId }, tx, cancellationToken: ct));

        await ReallocateBookingPaymentsAsync(connection, tx, id, adjustedId, input, userId, ct);
        await tx.CommitAsync(ct);
        return new ReceiptEditResult
        {
            AdjustedId = adjustedId, ReversalId = reversalId,
            OriginalWasPosted = originalWasPosted, ReversalCreated = originalWasPosted,
            NeedsImmediatePosting = targetShiftId is null
        };
    }

    /// <summary>توافق خلفي: يعيد رقم الإيصال المعدّل.</summary>
    public async Task<Guid> EditDraftReceiptAsync(Guid id, ReceiptEditInput input, Guid userId,
        CancellationToken ct = default) =>
        (await EditReceiptAsync(id, input, userId, ct)).AdjustedId;

    private static async Task<Guid?> ResolveEditShiftAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ReceiptEditRow original, CancellationToken ct)
    {
        var open = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM cashier_shifts
            WHERE branch_id = @branchId AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
            """, new { branchId = original.BranchId }, tx, cancellationToken: ct));
        if (open is { } openShift) return openShift;
        if (original.ShiftId is { } shiftId && original.ShiftReviewStatus != "reviewed")
            return shiftId;
        return null;
    }
}
