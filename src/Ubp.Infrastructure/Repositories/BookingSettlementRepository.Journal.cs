using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingSettlementRepository
{
    /// <summary>
    /// قيد تسوية حساب العميل (مسودة فقط): فرق السعر إلى الإيرادات، والمبلغ المسترد من العميل
    /// إلى حساب الخزينة المختارة. لا يُرحّل إلى الأستاذ إلا مع ترحيل السند/الشفت.
    /// </summary>
    private static async Task<Guid?> CreateDraftJournalAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid settlementId, Guid sourceId, string sourceType,
        BookingSettlementInput input, string customerName, TreasuryRow? treasury,
        IReadOnlyList<SettlementCalc> calcs, decimal cashAmount, Guid userId,
        CancellationToken ct)
    {
        var revenueAdjustment = Math.Round(calcs.Sum(c => c.RevenueAdjustment), 2,
            MidpointRounding.AwayFromZero);
        if (cashAmount == 0 && revenueAdjustment == 0) return null;

        var defaults = (await connection.QueryAsync<(string Key, Guid? AccountId)>(
            new CommandDefinition("SELECT setting_key, account_id FROM posting_defaults",
                transaction: tx, cancellationToken: ct)))
            .Where(r => r.AccountId.HasValue)
            .ToDictionary(r => r.Key, r => r.AccountId!.Value, StringComparer.OrdinalIgnoreCase);
        Guid Need(string key) => defaults.TryGetValue(key, out var account) ? account
            : throw new ValidationAppException("validation.posting_account_missing",
                new Dictionary<string, string> { ["key"] = key, ["module"] = "treasury" });

        var receivable = revenueAdjustment != 0 ? Need(PostingKeys.CustomerReceivable)
            : Guid.Empty;
        var revenue = revenueAdjustment != 0 ? Need(PostingKeys.SalesRevenue) : Guid.Empty;

        var gl = new List<JournalLeg>();
        if (revenueAdjustment > 0)
        {
            gl.Add(new JournalLeg(receivable, revenueAdjustment, 0, input.CustomerId));
            gl.Add(new JournalLeg(revenue, 0, revenueAdjustment, null));
        }
        else if (revenueAdjustment < 0)
        {
            gl.Add(new JournalLeg(revenue, -revenueAdjustment, 0, null));
            gl.Add(new JournalLeg(receivable, 0, -revenueAdjustment, input.CustomerId));
        }

        if (cashAmount != 0)
        {
            if (treasury is null)
                throw new ValidationAppException("validation.treasury_not_found");
            var advances = Need(PostingKeys.CustomerAdvances);
            var amount = Math.Abs(cashAmount);
            if (cashAmount > 0)
            {
                // رصيد متبقٍ للعميل: استرداد نقدي من الخزينة.
                gl.Add(new JournalLeg(advances, amount, 0, input.CustomerId));
                gl.Add(new JournalLeg(treasury.AccountId, 0, amount, null));
            }
            else
            {
                // العروض الجديدة أكبر من المستحق: تحصيل الفرق للخزينة.
                gl.Add(new JournalLeg(treasury.AccountId, amount, 0, null));
                gl.Add(new JournalLeg(advances, 0, amount, input.CustomerId));
            }
        }

        gl = gl.Where(l => l.Debit != 0 || l.Credit != 0).ToList();
        if (gl.Count == 0) return null;
        var debit = Math.Round(gl.Sum(l => l.Debit), 2, MidpointRounding.AwayFromZero);
        var credit = Math.Round(gl.Sum(l => l.Credit), 2, MidpointRounding.AwayFromZero);
        if (debit != credit)
            throw new ValidationAppException("validation.entry_not_balanced");

        var journalId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM journals WHERE is_active
            ORDER BY (journal_type = 'general') DESC, sort_order LIMIT 1
            """, transaction: tx, cancellationToken: ct))
            ?? throw new ValidationAppException("validation.journal_not_found");

        var entryId = Guid.CreateVersion7();
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entries
                (id, journal_id, branch_id, entry_date, description, status, source_type,
                 source_id, total_debit, total_credit, created_by)
            VALUES (@entryId, @journalId, @branchId, @docDate, @description, 'draft', @sourceType,
                    @sourceId, @debit, @credit, @userId)
            """, new
        {
            entryId, journalId, branchId = input.BranchId, docDate = input.DocDate.Date,
            description = $"تسوية حساب عميل — {customerName}", sourceType, sourceId, debit,
            credit, userId
        }, tx, cancellationToken: ct));

        var lineNo = 0;
        foreach (var leg in gl)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO journal_entry_lines
                    (id, entry_id, line_no, account_id, description, debit, credit, customer_id,
                     branch_id, entry_date)
                VALUES (@id, @entryId, @lineNo, @accountId, @description, @debit, @credit,
                        @customerId, @branchId, @docDate)
                """, new
            {
                id = Guid.CreateVersion7(), entryId, lineNo, accountId = leg.AccountId,
                description = $"تسوية حساب عميل — {customerName}", debit = leg.Debit,
                credit = leg.Credit, customerId = leg.CustomerId, branchId = input.BranchId,
                docDate = input.DocDate.Date
            }, tx, cancellationToken: ct));
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE customer_account_settlements SET journal_entry_id = @entryId WHERE id = @settlementId
            """, new { entryId, settlementId }, tx, cancellationToken: ct));
        return entryId;
    }
}
