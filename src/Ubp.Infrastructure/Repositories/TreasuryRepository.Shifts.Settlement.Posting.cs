using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    /// <summary>قيد تسوية: قبض (مدين خزينة/دكتور، دائن دفعات) أو صرف بالعكس.</summary>
    private static async Task<Guid> PostSettlementEntryAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftRow shift, Guid customerId, Guid treasuryAccount,
        Guid doctorAccount, Guid advances, decimal treasuryPart, decimal absolute,
        bool isReceipt, Guid voucherId, Guid userId, CancellationToken ct)
    {
        var entryId = Guid.CreateVersion7();
        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition(
            "SELECT COALESCE(doc_no, '') FROM vouchers WHERE id = @id", new { id = voucherId },
            tx, cancellationToken: ct));
        var journalId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT id FROM journals WHERE journal_type = 'sales' AND is_active " +
            "ORDER BY sort_order LIMIT 1", transaction: tx, cancellationToken: ct))
            ?? throw new ValidationAppException("validation.journal_not_found");
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entries
                (id, journal_id, branch_id, entry_date, reference, description, status,
                 source_type, source_id, total_debit, total_credit, created_by)
            VALUES (@entryId, @journalId, @branchId, current_date, @docNo, @description,
                    'draft', 'voucher', @voucherId, @amount, @amount, @userId)
            """, new
        {
            entryId, journalId, branchId = shift.BranchId, docNo,
            description = "تسوية شفت دكتور خارجى " + docNo, voucherId,
            amount = absolute, userId
        }, tx, cancellationToken: ct));

        var gl = new List<(Guid Account, decimal Debit, decimal Credit, Guid? Customer)>();
        if (isReceipt)
        {
            if (treasuryPart > 0) gl.Add((treasuryAccount, treasuryPart, 0, null));
            if (absolute - treasuryPart > 0)
                gl.Add((doctorAccount, absolute - treasuryPart, 0, customerId));
            gl.Add((advances, 0, absolute, customerId));
        }
        else
        {
            gl.Add((advances, absolute, 0, customerId));
            if (treasuryPart > 0) gl.Add((treasuryAccount, 0, treasuryPart, null));
            if (absolute - treasuryPart > 0)
                gl.Add((doctorAccount, 0, absolute - treasuryPart, customerId));
        }

        var lineNo = 0;
        foreach (var item in gl)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO journal_entry_lines
                    (id, entry_id, line_no, account_id, description, debit, credit,
                     customer_id, branch_id, entry_date)
                VALUES (@id, @entryId, @lineNo, @account, @description, @debit, @credit,
                        @customer, @branchId, current_date)
                """, new
            {
                id = Guid.CreateVersion7(), entryId, lineNo, account = item.Account,
                description = "تسوية شفت دكتور خارجى", debit = item.Debit, credit = item.Credit,
                customer = item.Customer, branchId = shift.BranchId
            }, tx, cancellationToken: ct));
        }
        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT fn_gl_post_entry(@entryId, @userId)", new { entryId, userId }, tx,
            cancellationToken: ct));
        return entryId;
    }

    private static async Task<(decimal Revenues, decimal Collections)> SettlementTotalsAsync(
        NpgsqlConnection connection, NpgsqlTransaction? tx, ShiftRow shift, Guid customerId,
        CancellationToken ct)
    {
        var revenues = await connection.ExecuteScalarAsync<decimal>(new CommandDefinition("""
            SELECT
              COALESCE((SELECT SUM(d.total) FROM commercial_documents d
                        WHERE d.branch_id = @branchId AND d.customer_id = @customerId
                          AND d.doc_type = 'sales_invoice' AND d.status = 'posted'
                          AND d.created_at >= @openedAt
                          AND (@until::timestamptz IS NULL OR d.created_at <= @until::timestamptz)), 0)
            + COALESCE((SELECT SUM(CASE WHEN bl.operation_type = 'gift' THEN 0
                                        ELSE el.net_amount END)
                        FROM booking_execution_lines el
                        JOIN booking_executions be ON be.id = el.execution_id
                        JOIN booking_lines bl ON bl.id = el.booking_line_id
                        JOIN bookings b ON b.id = be.booking_id
                        WHERE b.customer_id = @customerId AND be.branch_id = @branchId
                          AND be.status IN ('draft', 'posted')
                          AND be.created_at >= @openedAt
                          AND (@until::timestamptz IS NULL OR be.created_at <= @until::timestamptz)), 0)
            """, new { branchId = shift.BranchId, customerId, openedAt = shift.OpenedAt,
                until = shift.ClosedAt }, tx, cancellationToken: ct));
        var collections = await connection.ExecuteScalarAsync<decimal>(new CommandDefinition("""
            -- الصافي المسدد فعلاً للعميل: إجمالي السند ناقص عمولة التحصيل المحمَّلة عليه
            -- (العمولة لا تُقيَّد على حساب العميل، بل تُضاف لرصيد الخزينة عند مراجعة الشفت).
            SELECT COALESCE(SUM(v.total_amount - v.fee_total), 0) FROM vouchers v
            WHERE v.branch_id = @branchId AND v.voucher_type = 'receipt'
              AND v.party_type = 'C' AND v.party_id = @customerId
              AND v.status <> 'cancelled' AND NOT v.is_shift_settlement
              AND v.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR v.created_at <= @until::timestamptz)
            """, new { branchId = shift.BranchId, customerId, openedAt = shift.OpenedAt,
                until = shift.ClosedAt }, tx, cancellationToken: ct));
        return (Math.Round(revenues, 2, MidpointRounding.AwayFromZero),
            Math.Round(collections, 2, MidpointRounding.AwayFromZero));
    }
}
