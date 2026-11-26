using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// رصيد الخزينة الحالي ومنع الصرف بدون رصيد: المتاح = الرصيد المُرحَّل على حساب الخزينة
/// + صافي حركات اليوم/الشفت من القيود **المسودة** (مصروف/قبض/صرف/تحويل لم يُعتمد بعد — 0220)
/// + حركة السندات المسودة التي لم يُنشأ لها قيد بعد − مصروفات تشغيلية مسودة لم تُرحَّل.
/// </summary>
public sealed partial class OperatingExpenseRepository
{
    internal static async Task<decimal> TreasuryAvailableBalanceAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid treasuryId, Guid? excludeExpenseId, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<decimal>(new CommandDefinition("""
            SELECT ROUND(
                -- (١) الرصيد المُرحَّل على حساب الخزينة (قيود مرحّلة فقط)
                COALESCE((SELECT SUM(l.debit - l.credit)
                          FROM journal_entry_lines l
                          JOIN journal_entries e ON e.id = l.entry_id
                          WHERE e.status = 'posted' AND l.account_id = t.account_id
                            AND (t.is_company_wide OR e.branch_id = t.branch_id)), 0)
                -- (٢) صافي حركات اليوم/الشفت المعلّقة كمسودة (شفت مفتوح أو بانتظار اعتماد المراجعة)
                + COALESCE((SELECT SUM(l.debit - l.credit)
                            FROM journal_entry_lines l
                            JOIN journal_entries e ON e.id = l.entry_id
                            WHERE e.status = 'draft' AND l.account_id = t.account_id
                              AND (t.is_company_wide OR e.branch_id = t.branch_id)
                              AND (e.shift_id IS NOT NULL OR e.entry_date >= CURRENT_DATE)
                              AND (@excludeId::uuid IS NULL
                                   OR e.source_type <> 'operating_expense'
                                   OR e.source_id IS DISTINCT FROM @excludeId::uuid)), 0)
                -- (٣) سندات لم يُنشأ لها قيد بعد (مسودة أو «مرحّلة بلا قيد») — بلا ازدواج مع البند ٢
                + COALESCE((SELECT SUM(CASE
                            WHEN v.voucher_type = 'receipt' THEN v.total_amount - v.provider_fee_total
                            WHEN v.voucher_type = 'payment' THEN -v.total_amount
                            WHEN v.voucher_type = 'transfer' AND v.treasury_id = t.id
                                 THEN -(v.total_amount + v.fee_total)
                            WHEN v.voucher_type = 'transfer' AND v.to_treasury_id = t.id
                                 THEN v.total_amount
                            ELSE 0 END)
                      FROM vouchers v
                      WHERE v.journal_entry_id IS NULL AND v.status IN ('draft', 'posted')
                        AND (v.treasury_id = t.id OR v.to_treasury_id = t.id)), 0)
                -- (٤) مصروفات تشغيلية مسودة لم تُرحَّل بعد (بلا قيد)
                - COALESCE((SELECT SUM(o.total_amount) FROM operating_expenses o
                            WHERE o.treasury_id = t.id AND o.status = 'DRAFT'
                              AND (@excludeId::uuid IS NULL OR o.id <> @excludeId::uuid)), 0)
            , 2)
            FROM treasuries t WHERE t.id = @treasuryId
            """, new { treasuryId, excludeId = excludeExpenseId }, tx, cancellationToken: ct));

    /// <summary>
    /// المتاح داخل **شفت مفتوح** = رصيد حساب الخزينة المُرحَّل لحظة فتح الشفت
    /// + صافي **حركة الشفت الفعلية** (إيصالات/صرف/تحويلات/تسليمات/سلف/تسويات وسيط — مرحّلة أو مسودة)
    /// − مصروفات تشغيلية مسودة لم تُرحَّل. يعيد null إذا لم يكن هناك شفت مفتوح لهذه الخزينة
    /// (فتُستخدم معادلة الأستاذ + المسودات).
    /// </summary>
    private static async Task<decimal?> OpenShiftCashAvailableAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid treasuryId, Guid? excludeExpenseId, CancellationToken ct)
    {
        var row = await connection.QuerySingleOrDefaultAsync<(Guid ShiftId, Guid BranchId,
            DateTimeOffset OpenedAt, decimal OpeningBalance)>(new CommandDefinition("""
            SELECT s.id AS ShiftId, s.branch_id AS BranchId, s.opened_at AS OpenedAt,
                   -- «أول المدة» الفعلي (آخر نقد معدود) وإن لم يوجد صفّ عدّ: رصيد الأستاذ لحظة الفتح.
                   COALESCE(c.opening_cash,
                            (SELECT SUM(l.debit - l.credit)
                             FROM journal_entry_lines l
                             JOIN journal_entries e ON e.id = l.entry_id
                             WHERE e.status = 'posted' AND l.account_id = t.account_id
                               AND e.created_at < s.opened_at
                               AND e.branch_id = CASE WHEN t.is_company_wide
                                                      THEN s.branch_id ELSE t.branch_id END),
                            0) AS OpeningBalance
            FROM cashier_shifts s
            JOIN treasuries t ON t.id = @treasuryId
                             AND (t.is_company_wide OR t.branch_id = s.branch_id)
            LEFT JOIN shift_cash_counts c ON c.shift_id = s.id AND c.treasury_id = t.id
            WHERE s.status = 'open'
            ORDER BY s.opened_at DESC
            LIMIT 1
            """, new { treasuryId }, tx, cancellationToken: ct));
        if (row.ShiftId == Guid.Empty) return null;

        var movement = await TreasuryRepository.TreasuryMovementAsync(connection, tx, treasuryId,
            row.BranchId, row.ShiftId, row.OpenedAt, null, ct);

        var draftExpenses = await connection.ExecuteScalarAsync<decimal>(new CommandDefinition("""
            SELECT COALESCE(SUM(o.total_amount), 0) FROM operating_expenses o
            WHERE o.treasury_id = @treasuryId AND o.status = 'DRAFT'
              AND (@excludeId::uuid IS NULL OR o.id <> @excludeId::uuid)
            """, new { treasuryId, excludeId = excludeExpenseId }, tx, cancellationToken: ct));

        return Math.Round(row.OpeningBalance + movement - draftExpenses, 2,
            MidpointRounding.AwayFromZero);
    }

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

        // داخل شفت مفتوح: النقد المتوقع فعليًا (أول المدة + صافي حركة اليوم حتى لو مسودات).
        var available = await OpenShiftCashAvailableAsync(connection, tx, id, excludeExpenseId, ct)
                        ?? await TreasuryAvailableBalanceAsync(connection, tx, id,
                            excludeExpenseId, ct);
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
