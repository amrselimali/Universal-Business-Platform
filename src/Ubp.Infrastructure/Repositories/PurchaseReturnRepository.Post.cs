using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class PurchaseReturnRepository
{
    private sealed class PostHeader
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public DateTime DocDate { get; set; }
        public Guid SupplierId { get; set; }
        public Guid? OriginalDocumentId { get; set; }
        public string ReturnMethod { get; set; } = PurchaseReturnMethods.Supplier;
        public Guid? TreasuryId { get; set; }
        public Guid? TreasuryMethodId { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = PurchaseReturnStatuses.Draft;
        public string? Notes { get; set; }
    }

    private sealed class PostLine
    {
        public Guid Id { get; set; }
        public int LineNo { get; set; }
        public Guid ItemId { get; set; }
        public Guid UnitId { get; set; }
        public Guid WarehouseId { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Amount { get; set; }
    }

    private sealed record GlLine(Guid AccountId, decimal Debit, decimal Credit,
        Guid? SupplierId = null);

    public async Task<PurchaseReturn> PostAsync(Guid id, Guid userId, bool allowNegative,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var head = await connection.QuerySingleOrDefaultAsync<PostHeader>(new CommandDefinition(
            """
            SELECT id AS Id, branch_id AS BranchId, doc_date AS DocDate,
                   supplier_id AS SupplierId, original_document_id AS OriginalDocumentId,
                   return_method AS ReturnMethod, treasury_id AS TreasuryId,
                   treasury_method_id AS TreasuryMethodId, total_amount AS TotalAmount,
                   status AS Status, notes AS Notes
            FROM purchase_returns WHERE id = @id FOR UPDATE
            """, new { id }, tx, cancellationToken: ct)) ?? throw new NotFoundAppException();
        if (head.Status != PurchaseReturnStatuses.Draft)
            throw new ValidationAppException("validation.document_not_draft");

        var lines = (await connection.QueryAsync<PostLine>(new CommandDefinition("""
            SELECT id AS Id, line_no AS LineNo, item_id AS ItemId, unit_id AS UnitId,
                   warehouse_id AS WarehouseId, quantity AS Quantity,
                   unit_price AS UnitPrice, amount AS Amount
            FROM purchase_return_lines WHERE return_id = @id ORDER BY line_no
            """, new { id }, tx, cancellationToken: ct))).ToList();
        if (lines.Count == 0)
            throw new ValidationAppException("validation.document_has_no_lines");

        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition(
            "SELECT next_document_number('PURCHASE_RETURN'::varchar, @branchId::uuid, " +
            "@date::date, 'PRET'::varchar, 6::smallint)",
            new { branchId = head.BranchId, date = head.DocDate.Date }, tx,
            cancellationToken: ct));

        var stockDocumentId = await PostStockAsync(connection, tx, head, lines, docNo, userId,
            allowNegative, ct);
        var entryId = await PostGlAsync(connection, tx, head, lines, docNo, userId, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE purchase_returns
            SET status = 'POSTED', doc_no = @docNo, posted_at = now(), posted_by = @userId,
                stock_document_id = @stockDocumentId, journal_entry_id = @entryId,
                updated_by = @userId
            WHERE id = @id
            """, new { docNo, userId, stockDocumentId, entryId, id }, tx,
            cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (await GetAsync(id, ct))!;
    }

    private static async Task<Guid?> PostStockAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, PostHeader head, IReadOnlyList<PostLine> lines, string docNo,
        Guid userId, bool allowNegative, CancellationToken ct)
    {
        Guid? first = null;
        foreach (var group in lines.GroupBy(l => l.WarehouseId))
        {
            var documentId = Guid.CreateVersion7();
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO stock_documents
                    (id, doc_type, doc_date, branch_id, warehouse_id, status, notes, created_by)
                VALUES (@id, 'ISSUE', @date, @branchId, @warehouseId, 'DRAFT', @notes, @userId)
                """, new
            {
                id = documentId,
                date = head.DocDate.Date,
                branchId = head.BranchId,
                warehouseId = group.Key,
                notes = $"مرتجع مشتريات {docNo}",
                userId
            }, tx, cancellationToken: ct));

            var lineNo = 0;
            foreach (var line in group)
            {
                lineNo++;
                await connection.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO stock_document_lines
                        (document_id, line_no, direction, item_id, unit_id, conversion_factor,
                         quantity, base_quantity, unit_cost, total_cost, notes)
                    VALUES (@documentId, @lineNo, 'OUT', @itemId, @unitId, 1, @quantity,
                            @quantity, @unitCost, @totalCost, @notes)
                    """, new
                {
                    documentId,
                    lineNo,
                    itemId = line.ItemId,
                    unitId = line.UnitId,
                    quantity = line.Quantity,
                    unitCost = line.UnitPrice,
                    totalCost = line.Amount,
                    notes = $"مرتجع مشتريات {docNo}"
                }, tx, cancellationToken: ct));
                await connection.ExecuteAsync(new CommandDefinition("""
                    UPDATE purchase_return_lines SET stock_document_id = @documentId
                    WHERE id = @lineId
                    """, new { documentId, lineId = line.Id }, tx, cancellationToken: ct));
            }

            await StockPostingRepository.PostCoreAsync(connection, tx, documentId, userId,
                allowNegative, ct);
            first ??= documentId;
        }
        return first;
    }

    private static async Task<Guid> PostGlAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, PostHeader head, IReadOnlyList<PostLine> lines, string docNo,
        Guid userId, CancellationToken ct)
    {
        // سطر مرتجع من مصروف تشغيلي: الدائن = حساب سطر المصروف نفسه (الذي دُيِّن عند الشراء)،
        // وغير ذلك: حساب مخزون فئة الصنف.
        var inventory = (await connection.QueryAsync<(Guid LineId, Guid? AccountId)>(
            new CommandDefinition("""
            SELECT l.id AS LineId,
                   COALESCE(oel.account_id, m.inventory_account_id) AS AccountId
            FROM purchase_return_lines l
            JOIN items i ON i.id = l.item_id
            LEFT JOIN operating_expense_lines oel ON oel.id = l.operating_expense_line_id
            LEFT JOIN item_category_accounts m ON m.category_id = i.category_id
            WHERE l.return_id = @id
            """, new { id = head.Id }, tx, cancellationToken: ct))).ToList();
        if (inventory.Any(x => x.AccountId is null))
            throw new ValidationAppException("validation.stock_accounts_missing");

        var total = Math.Round(lines.Sum(l => l.Amount), 2, MidpointRounding.AwayFromZero);
        var gl = new List<GlLine>();
        // في الحالتين يُخصم من المورد أولاً؛ في حالة الخزينة يعكس سند القبض
        // (مدين خزينة / دائن مورد) أثره، فيصبح الصافي: مدين خزينة / دائن مخزون.
        var payable = await NeedAsync(connection, tx, PostingKeys.SupplierPayable, ct);
        gl.Add(new GlLine(payable, total, 0, head.SupplierId));

        foreach (var line in lines)
        {
            var account = inventory.First(x => x.LineId == line.Id).AccountId!.Value;
            gl.Add(new GlLine(account, 0, line.Amount));
        }

        var difference = Math.Round(gl.Sum(x => x.Debit) - gl.Sum(x => x.Credit), 2,
            MidpointRounding.AwayFromZero);
        if (difference != 0)
        {
            var balancing = await TryAccountAsync(connection, tx, PostingKeys.PurchaseVariance, ct)
                            ?? await NeedAsync(connection, tx, PostingKeys.RoundingDifference, ct);
            gl.Add(new GlLine(balancing, difference > 0 ? difference : 0,
                difference < 0 ? -difference : 0));
        }

        var journalId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT id FROM journals WHERE journal_type = 'purchase' AND is_active " +
            "ORDER BY sort_order LIMIT 1", transaction: tx, cancellationToken: ct))
            ?? throw new ValidationAppException("validation.journal_not_found");

        var entryId = Guid.CreateVersion7();
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entries (id, journal_id, branch_id, entry_date, reference,
                description, status, source_type, source_id, total_debit, total_credit, created_by)
            VALUES (@entryId, @journalId, @branchId, @docDate, @docNo,
                    @description, 'draft', 'purchase_return', @sourceId, @debit, @credit, @userId)
            """, new
        {
            entryId,
            journalId,
            branchId = head.BranchId,
            docDate = head.DocDate.Date,
            docNo,
            description = $"مرتجع مشتريات {docNo}",
            sourceId = head.Id,
            debit = gl.Sum(x => x.Debit),
            credit = gl.Sum(x => x.Credit),
            userId
        }, tx, cancellationToken: ct));

        var lineNo = 0;
        foreach (var item in gl)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO journal_entry_lines (id, entry_id, line_no, account_id, description,
                    debit, credit, supplier_id, branch_id, entry_date)
                VALUES (@lineId, @entryId, @lineNo, @accountId, @description, @debit, @credit,
                        @supplierId, @branchId, @docDate)
                """, new
            {
                lineId = Guid.CreateVersion7(),
                entryId,
                lineNo,
                accountId = item.AccountId,
                description = $"مرتجع مشتريات {docNo}",
                debit = item.Debit,
                credit = item.Credit,
                supplierId = item.SupplierId,
                branchId = head.BranchId,
                docDate = head.DocDate.Date
            }, tx, cancellationToken: ct));
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT fn_gl_post_entry(@entryId, @userId)", new { entryId, userId }, tx,
            cancellationToken: ct));
        return entryId;
    }

    private static async Task<Guid> NeedAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, string key, CancellationToken ct) =>
        await TryAccountAsync(connection, tx, key, ct) ??
        throw new ValidationAppException("validation.posting_account_missing",
            new Dictionary<string, string> { ["key"] = key, ["module"] = "purchasing" });

    private static async Task<Guid?> TryAccountAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, string key, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT account_id FROM posting_defaults WHERE setting_key = @key", new { key }, tx,
            cancellationToken: ct));

    private static async Task<Guid?> DefaultMethodAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid treasuryId, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM treasury_methods
            WHERE treasury_id = @treasuryId AND is_active
            ORDER BY (code = 'DEFAULT') DESC, code LIMIT 1
            """, new { treasuryId }, tx, cancellationToken: ct));
}