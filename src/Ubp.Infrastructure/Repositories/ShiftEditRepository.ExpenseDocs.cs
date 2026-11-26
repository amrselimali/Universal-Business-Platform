using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// تعديل/حذف مستندات المصروفات المصروفة فورًا من شاشة المصروفات التشغيلية
/// (سلفة موظف وتسليم نقدية): التعديل يُنشئ **قيد فرق** لقيمة الفرق، والحذف يعكس
/// القيد المُرحَّل ويحذف المستند — فتبقى القيود سليمة والمصروف يختفي من الشفت.
/// </summary>
public sealed partial class ShiftEditRepository
{
    private static async Task<bool> ApplyEmployeeAdvanceAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftLineEditInput input, Guid userId, CancellationToken ct)
    {
        var doc = await connection.QuerySingleOrDefaultAsync<AdvanceEditRow>(
            new CommandDefinition("""
            SELECT a.id AS Id, a.branch_id AS BranchId, a.doc_no AS DocNo, a.amount AS Amount,
                   a.treasury_id AS TreasuryId, a.charge_account_id AS ChargeAccountId,
                   a.status AS Status
            FROM employee_advances a WHERE a.id = @id FOR UPDATE
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc is null) throw new NotFoundAppException();
        if (doc.Status != "posted")
            throw new ValidationAppException("validation.shift_edit_locked");

        if (input.Field == "description")
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE employee_advances SET notes = @v WHERE id = @id",
                new { v = input.NewValue, id = input.DocId }, tx, cancellationToken: ct));
            return true;
        }
        if (input.Field != "amount")
            throw new ValidationAppException("validation.review_field_not_editable");

        var amount = Dec(input.NewValue);
        if (amount <= 0) throw new ValidationAppException("validation.advance_amount");
        var delta = Math.Round(amount - doc.Amount, 2, MidpointRounding.AwayFromZero);
        if (delta != 0)
        {
            var treasuryAccount = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(
                "SELECT account_id FROM treasuries WHERE id = @id", new { id = doc.TreasuryId },
                tx, cancellationToken: ct));
            var docNo = doc.DocNo ?? input.DocId.ToString("N")[..8];
            var amt = Math.Abs(delta);
            // زيادة السلفة: مدين حساب التحميل / دائن الخزينة — والعكس عند التخفيض.
            if (delta > 0)
                await PostDifferenceAsync(connection, tx, doc.BranchId, docNo,
                    doc.ChargeAccountId, null, null, treasuryAccount, null, null, amt, input.DocId,
                    userId, ct);
            else
                await PostDifferenceAsync(connection, tx, doc.BranchId, docNo, treasuryAccount,
                    null, null, doc.ChargeAccountId, null, null, amt, input.DocId, userId, ct);
        }
        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE employee_advances SET amount = @amount WHERE id = @id",
            new { amount, id = input.DocId }, tx, cancellationToken: ct));
        return true;
    }

    private static async Task<bool> ApplyCashHandoverAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftLineEditInput input, Guid userId, CancellationToken ct)
    {
        var doc = await connection.QuerySingleOrDefaultAsync<HandoverEditRow>(
            new CommandDefinition("""
            SELECT h.id AS Id, h.branch_id AS BranchId, h.treasury_id AS TreasuryId,
                   h.clearing_account_id AS ClearingAccountId, h.amount AS Amount,
                   h.commission_amount AS CommissionAmount, t.account_id AS TreasuryAccountId,
                   t.provider_fee_account_id AS FeeAccountId, t.follow_in_shift AS FollowInShift
            FROM cash_handovers h
            JOIN treasuries t ON t.id = h.treasury_id
            WHERE h.id = @id FOR UPDATE OF h
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc is null) throw new NotFoundAppException();

        if (input.Field == "description")
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE cash_handovers SET notes = @v WHERE id = @id",
                new { v = input.NewValue, id = input.DocId }, tx, cancellationToken: ct));
            return true;
        }

        var docNo = "CH-" + input.DocId.ToString("N")[..8];
        if (input.Field == "amount")
        {
            var amount = Dec(input.NewValue);
            if (amount <= 0) throw new ValidationAppException("validation.voucher_amount");
            var delta = Math.Round(amount - doc.Amount, 2, MidpointRounding.AwayFromZero);
            if (delta != 0)
            {
                var amt = Math.Abs(delta);
                // زيادة المسلَّم: مدين الحساب الوسيط / دائن الخزينة — والعكس عند التخفيض.
                if (delta > 0)
                    await PostDifferenceAsync(connection, tx, doc.BranchId, docNo,
                        doc.ClearingAccountId, null, null, doc.TreasuryAccountId, null, null, amt,
                        input.DocId, userId, ct);
                else
                    await PostDifferenceAsync(connection, tx, doc.BranchId, docNo,
                        doc.TreasuryAccountId, null, null, doc.ClearingAccountId, null, null, amt,
                        input.DocId, userId, ct);
            }
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE cash_handovers SET amount = @amount WHERE id = @id",
                new { amount, id = input.DocId }, tx, cancellationToken: ct));
            return true;
        }

        if (input.Field != "commission")
            throw new ValidationAppException("validation.review_field_not_editable");
        var commission = Dec(input.NewValue);
        if (commission < 0) throw new ValidationAppException("validation.payment_fee");
        var feeDelta = Math.Round(commission - doc.CommissionAmount, 2,
            MidpointRounding.AwayFromZero);
        if (feeDelta == 0) return true;
        if (!doc.FollowInShift)
            throw new ValidationAppException("validation.handover_commission_requires_shift");
        var feeAccount = doc.FeeAccountId ?? await connection.ExecuteScalarAsync<Guid?>(
            new CommandDefinition("""
            SELECT COALESCE(
                (SELECT account_id FROM posting_defaults
                 WHERE setting_key = @key AND account_id IS NOT NULL),
                (SELECT account_id FROM posting_defaults
                 WHERE setting_key = @feesKey AND account_id IS NOT NULL))
            """, new { key = PostingKeys.CashHandoverCommission,
                feesKey = PostingKeys.PaymentFees }, tx, cancellationToken: ct));
        if (feeAccount is null)
            throw new ValidationAppException("validation.posting_account_missing",
                new Dictionary<string, string>
                {
                    ["key"] = PostingKeys.CashHandoverCommission, ["module"] = "treasury"
                });
        var feeAmt = Math.Abs(feeDelta);
        if (feeDelta > 0)
            await PostDifferenceAsync(connection, tx, doc.BranchId, docNo, feeAccount.Value,
                null, null, doc.TreasuryAccountId, null, null, feeAmt, input.DocId, userId, ct);
        else
            await PostDifferenceAsync(connection, tx, doc.BranchId, docNo, doc.TreasuryAccountId,
                null, null, feeAccount.Value, null, null, feeAmt, input.DocId, userId, ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE cash_handovers SET commission_amount = @c WHERE id = @id",
            new { c = commission, id = input.DocId }, tx, cancellationToken: ct));
        return true;
    }

    /// <summary>عكس قيد مُرحَّل بقيد جديد مُرحَّل (مدين/دائن معكوسة) مرتبط بالأصل — للحذف.</summary>
    private static async Task ReversePostedEntryAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid? entryId, Guid branchId, string? reference,
        string description, Guid sourceId, Guid userId, CancellationToken ct)
    {
        if (entryId is not { } original) return;
        var head = await connection.QuerySingleOrDefaultAsync<ReverseHeadRow>(
            new CommandDefinition("""
            SELECT journal_id AS JournalId, status AS Status, total_debit AS TotalDebit,
                   total_credit AS TotalCredit
            FROM journal_entries WHERE id = @id FOR UPDATE
            """, new { id = original }, tx, cancellationToken: ct));
        if (head is null) return;
        if (head.Status != "posted")
            throw new ValidationAppException("validation.shift_delete_document_in_use",
                new Dictionary<string, string> { ["links"] = "قيد المستند غير مُرحَّل" });

        var reversalId = Guid.CreateVersion7();
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entries
                (id, journal_id, branch_id, entry_date, reference, description, status,
                 source_type, source_id, reversal_of_id, total_debit, total_credit, created_by)
            VALUES (@id, @journalId, @branchId, current_date, @reference, @description, 'draft',
                    'review_adjustment', @sourceId, @original, @totalDebit, @totalCredit, @userId)
            """, new { id = reversalId, head.JournalId, branchId, reference, description,
                sourceId, original, head.TotalDebit, head.TotalCredit, userId }, tx,
            cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entry_lines
                (id, entry_id, line_no, account_id, description, debit, credit, customer_id,
                 supplier_id, cost_center_id, branch_id, entry_date)
            SELECT gen_random_uuid(), @newId, line_no, account_id, @description, credit, debit,
                   customer_id, supplier_id, cost_center_id, branch_id, current_date
            FROM journal_entry_lines WHERE entry_id = @original ORDER BY line_no
            """, new { newId = reversalId, description, original }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT fn_gl_post_entry(@id, @userId)", new { id = reversalId, userId }, tx,
            cancellationToken: ct));
    }

    /// <summary>حذف سلفة موظف: عكس قيدها المُرحَّل ثم حذف المستند فيختفي من الشفت.</summary>
    private static async Task<ShiftLineDeleteResult> DeleteEmployeeAdvanceAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        Guid userId, CancellationToken ct)
    {
        var doc = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId, string? DocNo,
            Guid? EntryId, string Status)>(new CommandDefinition("""
            SELECT id AS Id, branch_id AS BranchId, doc_no AS DocNo,
                   journal_entry_id AS EntryId, status AS Status
            FROM employee_advances WHERE id = @id FOR UPDATE
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc.Id == Guid.Empty) throw new NotFoundAppException();
        if (doc.Status != "posted")
            throw new ValidationAppException("validation.shift_edit_locked");

        await ReversePostedEntryAsync(connection, tx, doc.EntryId, doc.BranchId, doc.DocNo,
            "إلغاء سلفة موظف " + (doc.DocNo ?? ""), doc.Id, userId, ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM employee_advances WHERE id = @id", new { id = doc.Id }, tx,
            cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
    }

    /// <summary>حذف تسليم نقدية: عكس قيده المُرحَّل (شاملًا العمولة) ثم حذف المستند.</summary>
    private static async Task<ShiftLineDeleteResult> DeleteCashHandoverAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftLineDeleteInput input,
        Guid userId, CancellationToken ct)
    {
        var doc = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId,
            Guid? EntryId)>(new CommandDefinition("""
            SELECT id AS Id, branch_id AS BranchId, journal_entry_id AS EntryId
            FROM cash_handovers WHERE id = @id FOR UPDATE
            """, new { id = input.DocId }, tx, cancellationToken: ct));
        if (doc.Id == Guid.Empty) throw new NotFoundAppException();

        await ReversePostedEntryAsync(connection, tx, doc.EntryId, doc.BranchId,
            "CH-" + doc.Id.ToString("N")[..8], "إلغاء تسليم نقدية", doc.Id, userId, ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM cash_handovers WHERE id = @id", new { id = doc.Id }, tx,
            cancellationToken: ct));
        return new ShiftLineDeleteResult { Deleted = true, DocumentDeleted = true };
    }

    private sealed class AdvanceEditRow
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public string? DocNo { get; set; }
        public decimal Amount { get; set; }
        public Guid TreasuryId { get; set; }
        public Guid ChargeAccountId { get; set; }
        public string Status { get; set; } = "";
    }

    private sealed class HandoverEditRow
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public Guid TreasuryId { get; set; }
        public Guid ClearingAccountId { get; set; }
        public decimal Amount { get; set; }
        public decimal CommissionAmount { get; set; }
        public Guid TreasuryAccountId { get; set; }
        public Guid? FeeAccountId { get; set; }
        public bool FollowInShift { get; set; }
    }

    private sealed class ReverseHeadRow
    {
        public Guid JournalId { get; set; }
        public string Status { get; set; } = "";
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
    }
}
