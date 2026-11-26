using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// رصيد الخزينة الحالي ومنع الصرف بدون رصيد: المتاح = الرصيد المُرحَّل على حساب الخزينة
/// + حركة السندات المسودة (قبض/صرف/تحويل) − مصروفات تشغيلية مسودة لم تُرحَّل من نفس الخزينة.
/// </summary>
public sealed partial class OperatingExpenseRepository
{
    internal static async Task<decimal> TreasuryAvailableBalanceAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid treasuryId, Guid? excludeExpenseId, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<decimal>(new CommandDefinition("""
            SELECT ROUND(
                COALESCE((SELECT SUM(l.debit - l.credit)
                          FROM journal_entry_lines l
                          JOIN journal_entries e ON e.id = l.entry_id
                          WHERE e.status = 'posted' AND l.account_id = t.account_id
                            AND (t.is_company_wide OR e.branch_id = t.branch_id)), 0)
              + COALESCE((SELECT SUM(CASE
                          WHEN v.voucher_type = 'receipt' THEN v.total_amount - v.provider_fee_total
                          WHEN v.voucher_type = 'payment' THEN -v.total_amount
                          WHEN v.voucher_type = 'transfer' AND v.treasury_id = t.id
                               THEN -(v.total_amount + v.fee_total)
                          WHEN v.voucher_type = 'transfer' AND v.to_treasury_id = t.id
                               THEN v.total_amount
                          ELSE 0 END)
                    FROM vouchers v
                    WHERE v.status = 'draft'
                      AND (v.treasury_id = t.id OR v.to_treasury_id = t.id)), 0)
              - COALESCE((SELECT SUM(o.total_amount) FROM operating_expenses o
                          WHERE o.treasury_id = t.id AND o.status = 'DRAFT'
                            AND (@excludeId::uuid IS NULL OR o.id <> @excludeId::uuid)), 0)
            , 2)
            FROM treasuries t WHERE t.id = @treasuryId
            """, new { treasuryId, excludeId = excludeExpenseId }, tx, cancellationToken: ct));

    /// <summary>
    /// لا يُسمح بالصرف إن كان رصيد الخزينة الحالي لا يغطي قيمة المصروف — مع بيان
    /// المتاح والمطلوب واسم الخزينة في الرسالة.
    /// </summary>
    private static async Task EnsureTreasuryCoversAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid? treasuryId, decimal total, Guid? excludeExpenseId,
        CancellationToken ct)
    {
        // آجل على حساب المورد: لا صرف نقدي من خزينة.
        if (treasuryId is not { } id) return;
        total = Math.Round(total, 2, MidpointRounding.AwayFromZero);
        if (total <= 0) return;

        var available = await TreasuryAvailableBalanceAsync(connection, tx, id, excludeExpenseId, ct);
        if (available >= total) return;

        var name = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT name_ar FROM treasuries WHERE id = @id", new { id }, tx,
            cancellationToken: ct)) ?? "";
        throw new ValidationAppException("validation.expense_treasury_balance",
            new Dictionary<string, string>
            {
                ["treasury"] = name,
                ["available"] = available.ToString("N2"),
                ["required"] = total.ToString("N2")
            });
    }

    private static Task EnsureTreasuryCoversAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, OperatingExpenseInput input, Guid? excludeExpenseId,
        CancellationToken ct) =>
        EnsureTreasuryCoversAsync(connection, tx, input.TreasuryId,
            input.Lines.Sum(l => l.Amount), excludeExpenseId, ct);
}
