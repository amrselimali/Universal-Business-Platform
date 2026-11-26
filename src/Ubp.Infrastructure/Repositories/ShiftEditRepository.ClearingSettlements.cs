using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// تعديل/حذف تسوية حساب وسيط (بطاقة/محفظة/شيك) إلى الخزينة من شاشة تعديل الشفت (0219):
/// التعديل يُنشئ قيد فرق بين الخزينة والحساب الوسيط، والحذف يعكس القيد المُرحَّل ثم يحذف التسوية.
/// </summary>
public sealed partial class ShiftEditRepository
{
    private static async Task<bool> ApplyClearingSettlementAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftLineEditInput input, Guid userId, CancellationToken ct)
    {
        var doc = await connection.QuerySingleOrDefaultAsync<ClearingSettlementEditRow>(
            new CommandDefinition("""
            SELECT cs.id AS Id, cs.branch_id AS BranchId, cs.amount AS Amount,
                   cs.reference AS Reference, cs.journal_entry_id AS EntryId,
                   cs.clearing_account_id AS ClearingAccountId,
                   t.account_id AS TreasuryAccountId
            FROM treasury_clearing_settlements cs
            JOIN treasuries t ON t.id = cs.treasury_id
            WHERE cs.id = @id FOR UPDATE OF cs
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc is null) throw new NotFoundAppException();

        var docNo = DocNo(doc.Id);
        if (input.Field == "description")
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE treasury_clearing_settlements SET reference = @v WHERE id = @id",
                new { v = string.IsNullOrWhiteSpace(input.NewValue) ? null : input.NewValue.Trim(),
                    id = input.DocId }, tx, cancellationToken: ct));
            return true;
        }
        if (input.Field != "amount")
            throw new ValidationAppException("validation.review_field_not_editable");

        var amount = Math.Round(Dec(input.NewValue), 2, MidpointRounding.AwayFromZero);
        if (amount == 0) throw new ValidationAppException("validation.settlement_amount");
        var delta = Math.Round(amount - doc.Amount, 2, MidpointRounding.AwayFromZero);
        if (delta != 0)
        {
            // الفرق يُقيَّد باتجاه الخزينة دائمًا: زيادة نقد الخزينة = مدين الخزينة / دائن الوسيط.
            var amt = Math.Abs(delta);
            if (delta > 0)
                await PostDifferenceAsync(connection, tx, doc.BranchId, docNo,
                    doc.TreasuryAccountId, null, null, doc.ClearingAccountId, null, null, amt,
                    doc.Id, userId, ct);
            else
                await PostDifferenceAsync(connection, tx, doc.BranchId, docNo,
                    doc.ClearingAccountId, null, null, doc.TreasuryAccountId, null, null, amt,
                    doc.Id, userId, ct);
        }
        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE treasury_clearing_settlements SET amount = @amount WHERE id = @id",
            new { amount, id = input.DocId }, tx, cancellationToken: ct));
        return true;
    }

    /// <summary>حذف تسوية حساب وسيط: عكس قيدها المُرحَّل ثم حذف التسوية فيختفي أثرها من الشفت.</summary>
    private static async Task<ShiftLineDeleteResult> DeleteClearingSettlementAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        Guid userId, CancellationToken ct)
    {
        var doc = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId,
            Guid? EntryId)>(new CommandDefinition("""
            SELECT id AS Id, branch_id AS BranchId, journal_entry_id AS EntryId
            FROM treasury_clearing_settlements WHERE id = @id FOR UPDATE
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc.Id == Guid.Empty) throw new NotFoundAppException();

        await ReversePostedEntryAsync(connection, tx, doc.EntryId, doc.BranchId, DocNo(doc.Id),
            "إلغاء تسوية حساب وسيط " + DocNo(doc.Id), doc.Id, userId, ct);
        // عكس قيود الفرق الناتجة عن أي تعديل سابق على قيمة التسوية.
        await ReverseSourceEntriesAsync(connection, tx, doc.Id, doc.BranchId, DocNo(doc.Id),
            "إلغاء تسوية حساب وسيط " + DocNo(doc.Id), userId, ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM treasury_clearing_settlements WHERE id = @id", new { id = doc.Id }, tx,
            cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
    }

    /// <summary>رقم مستند عرضي ثابت للتسوية (لا يوجد تسلسل مستندات لها).</summary>
    private static string DocNo(Guid id) => "CS-" + id.ToString("N")[..8];

    private sealed class ClearingSettlementEditRow
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public decimal Amount { get; set; }
        public string? Reference { get; set; }
        public Guid? EntryId { get; set; }
        public Guid TreasuryAccountId { get; set; }
        public Guid ClearingAccountId { get; set; }
    }
}
