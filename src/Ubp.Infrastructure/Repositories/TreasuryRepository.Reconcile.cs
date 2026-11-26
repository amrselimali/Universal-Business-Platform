using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    /// <summary>
    /// أرصدة الحسابات الوسيطة (بطاقات/محافظ/شيكات) من الأرصدة الشهرية للأستاذ،
    /// بلا تكرار عند مشاركة أكثر من طريقة دفع لنفس الحساب.
    /// </summary>
    public async Task<IReadOnlyList<ClearingBalance>> ListClearingBalancesAsync(Guid? branchId,
        bool includeAllAccounts = false, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var sql = includeAllAccounts
            ? """
              SELECT a.id AS AccountId, a.code AS AccountCode, a.name_ar AS AccountName,
                     COALESCE(SUM(g.debit), 0) AS Debit, COALESCE(SUM(g.credit), 0) AS Credit,
                     EXISTS (SELECT 1 FROM treasury_methods m
                             WHERE m.is_active AND m.clearing_account_id = a.id) AS IsClearing
              FROM accounts a
              LEFT JOIN gl_balances g
                     ON g.account_id = a.id
                    AND (@branchId::uuid IS NULL OR g.branch_id = @branchId::uuid)
              WHERE a.is_active AND NOT a.is_group
              GROUP BY a.id, a.code, a.name_ar
              ORDER BY a.code
              """
            : """
              SELECT a.id AS AccountId, a.code AS AccountCode, a.name_ar AS AccountName,
                     COALESCE(SUM(g.debit), 0) AS Debit, COALESCE(SUM(g.credit), 0) AS Credit,
                     true AS IsClearing
              FROM (SELECT DISTINCT clearing_account_id AS id FROM treasury_methods
                    WHERE is_active AND clearing_account_id IS NOT NULL) m
              JOIN accounts a ON a.id = m.id
              LEFT JOIN gl_balances g
                     ON g.account_id = m.id
                    AND (@branchId::uuid IS NULL OR g.branch_id = @branchId::uuid)
              GROUP BY a.id, a.code, a.name_ar
              ORDER BY a.code
              """;
        return (await connection.QueryAsync<ClearingBalance>(new CommandDefinition(sql,
            new { branchId }, cancellationToken: ct))).ToList();
    }

    /// <summary>
    /// تسوية حساب وسيط: قيد واحد يُفرغ الرصيد إلى خزينة/بنك (أو العكس إذا كان دائناً)،
    /// ويُسجَّل صف في treasury_clearing_settlements مرتبطًا بالشفت المفتوح للفرع
    /// حتى يظهر في تقرير الشفت وحركة النقد (0219).
    /// </summary>
    public async Task<Guid> SettleClearingAsync(Guid treasuryId, Guid clearingAccountId,
        decimal amount, DateTime docDate, string? reference, Guid userId,
        Guid? branchId = null, Guid? shiftId = null, CancellationToken ct = default)
    {
        amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        if (amount == 0)
            throw new ValidationAppException("validation.settlement_amount");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var treasury = await GetTreasuryRowAsync(connection, tx, treasuryId, ct)
            ?? throw new ValidationAppException("validation.treasury_not_found");

        // الخزينة العامة تُحاسَب على فرع الشفت المختار، والخاصة تُحاسَب على فرعها.
        var targetBranch = treasury.IsCompanyWide ? branchId ?? treasury.BranchId
                                                  : treasury.BranchId;

        var account = await connection.QuerySingleOrDefaultAsync<(Guid Id, string Code)>(
            new CommandDefinition(
                "SELECT id, code FROM accounts WHERE id = @clearingAccountId AND is_active " +
                "AND NOT is_group", new { clearingAccountId }, tx, cancellationToken: ct));
        if (account.Id == Guid.Empty)
            throw new ValidationAppException("validation.clearing_account_not_found");

        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT fn_assert_period_open(@docDate::date, @branchId, 'ACCOUNTING')",
            new { docDate, branchId = targetBranch }, tx, cancellationToken: ct));

        var value = Math.Abs(amount);
        var gl = amount > 0
            ? new List<JournalLine>
            {
                new(treasury.AccountId, value, 0),
                new(clearingAccountId, 0, value)
            }
            : new List<JournalLine>
            {
                new(clearingAccountId, value, 0),
                new(treasury.AccountId, 0, value)
            };

        var description = $"تسوية حساب وسيط {account.Code}" +
                          (string.IsNullOrWhiteSpace(reference) ? "" : $" — {reference.Trim()}");
        // الشفت المستهدف: المحدَّد من النافذة (مفتوح أو مغلق تحت المراجعة)، وإلا الشفت المفتوح.
        var resolvedShiftId = await ResolveSettlementShiftAsync(connection, tx, targetBranch,
            shiftId, ct);

        var entryId = Guid.CreateVersion7();
        var settlementId = Guid.CreateVersion7();
        await CreateVoucherEntryAsync(connection, tx, entryId, treasury.TreasuryType,
            targetBranch, docDate, reference?.Trim() ?? account.Code, description, gl, userId,
            settlementId, ct, "clearing_settlement", deferToShift: resolvedShiftId);

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO treasury_clearing_settlements (id, branch_id, treasury_id,
                clearing_account_id, amount, doc_date, reference, journal_entry_id, shift_id,
                created_by)
            VALUES (@settlementId, @branchId, @treasuryId, @clearingAccountId, @amount,
                    @docDate, @reference, @entryId, @shiftId, @userId)
            """, new
        {
            settlementId, branchId = targetBranch, treasuryId, clearingAccountId,
            amount, docDate, reference = reference?.Trim(), entryId, shiftId = resolvedShiftId,
            userId
        }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return entryId;
    }

    /// <summary>
    /// يحدد شفت التسوية: المحدَّد صراحةً (مفتوح، أو مغلق ما زال تحت المراجعة) — وإلا الشفت المفتوح.
    /// يرفض شفتًا نهائيًا أو شفتًا من فرع آخر.
    /// </summary>
    private static async Task<Guid?> ResolveSettlementShiftAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid branchId, Guid? shiftId, CancellationToken ct)
    {
        if (shiftId is { } id)
        {
            var row = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId,
                string Status, string ReviewStatus)>(new CommandDefinition("""
                SELECT id AS Id, branch_id AS BranchId, status AS Status,
                       review_status AS ReviewStatus
                FROM cashier_shifts WHERE id = @id
                """, new { id }, tx, cancellationToken: ct));
            if (row.Id == Guid.Empty) throw new NotFoundAppException();
            if (row.BranchId != branchId)
                throw new ValidationAppException("validation.treasury_branch_mismatch");
            if (row.Status != "open" && row.ReviewStatus != "pending")
                throw new ValidationAppException("validation.shift_not_open");
            return row.Id;
        }

        return await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM cashier_shifts
            WHERE branch_id = @branchId AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
            """, new { branchId }, tx, cancellationToken: ct));
    }

    /// <summary>مستندات الطرف المرحّلة التي لها رصيد غير مخصص (لشاشة التخصيص).</summary>
    public async Task<IReadOnlyList<OpenDocument>> ListOpenDocumentsAsync(string partyType,
        Guid partyId, int limit, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return (await connection.QueryAsync<OpenDocument>(new CommandDefinition("""
            SELECT d.id AS Id, d.doc_type AS DocType, d.doc_no AS DocNo, d.doc_date AS DocDate,
                   d.total AS Total, d.allocated_total AS AllocatedTotal
            FROM commercial_documents d
            WHERE d.status = 'posted'
              AND d.total > d.allocated_total
              AND ((@partyType = 'S' AND d.supplier_id = @partyId)
                OR (@partyType = 'C' AND d.customer_id = @partyId))
            ORDER BY d.doc_date, d.id
            LIMIT @limit
            """, new { partyType, partyId, limit = Math.Clamp(limit, 1, 500) },
            cancellationToken: ct))).ToList();
    }
}
