using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingExecutionRepository
{
    /// <summary>مخزون التنفيذ: صادر للكمية الموجبة (أصل/معدّل) ووارد للكمية السالبة (عكسي).</summary>
    private static async Task<(Guid DocumentId, Guid LineId, decimal Cost)> PostStockLineAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, PostExecutionHead head,
        PostExecutionLine line, Guid warehouseId, Guid userId, bool allowNegative,
        CancellationToken ct)
    {
        var issue = line.Quantity > 0;
        var quantity = Math.Abs(line.Quantity);
        var documentId = Guid.CreateVersion7();
        var lineId = Guid.CreateVersion7();
        var docType = issue ? StockDocumentTypes.Issue : StockDocumentTypes.Receipt;
        var direction = issue ? "OUT" : "IN";
        var note = (issue ? "تنفيذ " : "عكس تنفيذ ") + (head.DocNo ?? head.Id.ToString("N")[..8]);

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO stock_documents
                (id, doc_type, doc_date, branch_id, warehouse_id, status, notes, created_by)
            VALUES (@id, @docType, current_date, @branchId, @warehouseId, 'DRAFT', @note, @userId)
            """, new { id = documentId, docType, branchId = head.BranchId, warehouseId, note, userId },
            tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO stock_document_lines
                (id, document_id, line_no, direction, item_id, unit_id, conversion_factor,
                 quantity, base_quantity, unit_cost)
            VALUES (@id, @documentId, 1, @direction, @itemId, @unitId, 1, @quantity, @quantity,
                    @unitCost)
            """, new
        {
            id = lineId, documentId, direction, itemId = line.ItemId, unitId = line.UnitId,
            quantity, unitCost = issue ? 0 : Math.Max(line.UnitCost, 0)
        }, tx, cancellationToken: ct));

        await StockPostingRepository.PostCoreAsync(connection, tx, documentId, userId,
            allowNegative, ct);
        var cost = await connection.ExecuteScalarAsync<decimal>(new CommandDefinition(
            "SELECT COALESCE(total_cost, 0) FROM stock_document_lines WHERE id = @id",
            new { id = lineId }, tx, cancellationToken: ct));
        return (documentId, lineId, cost);
    }

    private static async Task<Guid> NeedAccountAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, string key, CancellationToken ct)
    {
        var id = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT account_id FROM posting_defaults WHERE setting_key = @key", new { key }, tx,
            cancellationToken: ct));
        return id ?? throw new ValidationAppException("validation.posting_account_missing",
            new Dictionary<string, string> { ["key"] = key, ["module"] = "sales" });
    }

    private static async Task<Guid> JournalAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, string type, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT id FROM journals WHERE journal_type = @type AND is_active " +
            "ORDER BY sort_order LIMIT 1", new { type }, tx, cancellationToken: ct))
        ?? throw new ValidationAppException("validation.journal_not_found");

    /// <summary>إيراد التنفيذ (أو عكسه): مدين ذمم العميل / دائن إيراد وضريبة، وبالعكس للعكسي.</summary>
    private static async Task<Guid?> PostExecutionRevenueAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, PostExecutionLine line, PostExecutionHead head, bool reverse,
        Guid userId, CancellationToken ct)
    {
        if (line.OperationType == ServiceOperationTypes.Gift) return null;
        var total = Math.Abs(line.TotalAmount);
        if (total <= 0) return null;
        var net = Math.Abs(line.NetAmount);
        if (net <= 0 || net > total) net = total;
        var tax = Math.Round(total - net, 2, MidpointRounding.AwayFromZero);

        var receivable = await NeedAccountAsync(connection, tx, PostingKeys.CustomerReceivable, ct);
        var revenue = await NeedAccountAsync(connection, tx, PostingKeys.SalesRevenue, ct);
        Guid? vat = tax > 0
            ? await NeedAccountAsync(connection, tx, PostingKeys.VatOutput, ct) : null;
        var treatment = line.OperationType == ServiceOperationTypes.Treatment;
        if (treatment && net > 0 && line.TreatmentAccountId is null)
            throw new ValidationAppException("validation.treatment_account_missing");

        var journalId = await JournalAsync(connection, tx, "sales", ct);
        var entryId = Guid.CreateVersion7();
        var docNo = head.DocNo ?? head.Id.ToString("N")[..8];
        var description = (reverse ? "عكس إيراد تنفيذ خدمة " : "إيراد تنفيذ خدمة ") + docNo;
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entries
                (id, journal_id, branch_id, entry_date, reference, description, status,
                 source_type, source_id, total_debit, total_credit, created_by)
            VALUES (@entryId, @journalId, @branchId, current_date, @docNo, @description, 'draft',
                    'execution', @sourceId, @total, @total, @userId)
            """, new
        {
            entryId, journalId, branchId = head.BranchId, docNo, description,
            sourceId = line.Id, total, userId
        }, tx, cancellationToken: ct));

        var gl = new List<(Guid Account, decimal Debit, decimal Credit, Guid? Customer)>();
        if (!reverse)
        {
            gl.Add((receivable, total, 0, line.CustomerId));
            if (treatment && net > 0)
            {
                gl.Add((line.TreatmentAccountId!.Value, net, 0, null));
                gl.Add((receivable, 0, net, line.CustomerId));
            }
            gl.Add((revenue, 0, net, null));
            if (vat is { } vatAccount) gl.Add((vatAccount, 0, tax, null));
        }
        else
        {
            gl.Add((receivable, 0, total, line.CustomerId));
            if (treatment && net > 0)
            {
                gl.Add((line.TreatmentAccountId!.Value, 0, net, null));
                gl.Add((receivable, net, 0, line.CustomerId));
            }
            gl.Add((revenue, net, 0, null));
            if (vat is { } vatAccount) gl.Add((vatAccount, tax, 0, null));
        }

        var lineNo = 0;
        foreach (var item in gl)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO journal_entry_lines
                    (id, entry_id, line_no, account_id, description, debit, credit, customer_id,
                     branch_id, entry_date)
                VALUES (@id, @entryId, @lineNo, @accountId, @description, @debit, @credit,
                        @customerId, @branchId, current_date)
                """, new
            {
                id = Guid.CreateVersion7(), entryId, lineNo, accountId = item.Account,
                description, debit = item.Debit, credit = item.Credit,
                customerId = item.Customer, branchId = head.BranchId
            }, tx, cancellationToken: ct));
        }

        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT fn_gl_post_entry(@entryId, @userId)", new { entryId, userId }, tx,
            cancellationToken: ct));
        return entryId;
    }

    /// <summary>تكلفة التنفيذ (أو عكسها): مدين تكلفة المخزون / دائن المخزون، وبالعكس للعكسي.</summary>
    private static async Task<Guid?> PostExecutionCogsAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, PostExecutionLine line, PostExecutionHead head, decimal cost,
        bool reverse, Guid userId, CancellationToken ct)
    {
        if (cost <= 0) return null;
        var category = await connection.QuerySingleOrDefaultAsync<(Guid? Cogs, Guid? Inventory)>(
            new CommandDefinition("""
            SELECT cogs_account_id AS Cogs, inventory_account_id AS Inventory
            FROM item_category_accounts WHERE category_id = @categoryId
            """, new { categoryId = line.CategoryId }, tx, cancellationToken: ct));
        var cogs = category.Cogs ??
                   await NeedAccountAsync(connection, tx, PostingKeys.StockCogs, ct);
        var inventory = category.Inventory ??
                        await NeedAccountAsync(connection, tx, PostingKeys.StockInventory, ct);

        var journalId = await JournalAsync(connection, tx, "stock", ct);
        var entryId = Guid.CreateVersion7();
        var docNo = head.DocNo ?? head.Id.ToString("N")[..8];
        var description = (reverse ? "عكس تكلفة تنفيذ " : "تكلفة تنفيذ ") + docNo;
        var debit = reverse ? inventory : cogs;
        var credit = reverse ? cogs : inventory;
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entries
                (id, journal_id, branch_id, entry_date, reference, description, status,
                 source_type, source_id, total_debit, total_credit, created_by)
            VALUES (@entryId, @journalId, @branchId, current_date, @docNo, @description, 'draft',
                    'execution', @sourceId, @cost, @cost, @userId)
            """, new
        {
            entryId, journalId, branchId = head.BranchId, docNo, description,
            sourceId = head.Id, cost, userId
        }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO journal_entry_lines
                (id, entry_id, line_no, account_id, description, debit, credit, branch_id,
                 entry_date)
            VALUES (@id1, @entryId, 1, @debit, @description, @cost, 0, @branchId, current_date),
                   (@id2, @entryId, 2, @credit, @description, 0, @cost, @branchId, current_date)
            """, new
        {
            id1 = Guid.CreateVersion7(), id2 = Guid.CreateVersion7(), entryId, debit, credit,
            description, cost, branchId = head.BranchId
        }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition(
            "SELECT fn_gl_post_entry(@entryId, @userId)", new { entryId, userId }, tx,
            cancellationToken: ct));
        return entryId;
    }

    /// <summary>تطبيق وحدات العدّاد عند الترحيل (سالب للعكسي) مع منع النزول تحت الصفر.</summary>
    private static async Task ApplyMeterAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid assetId, PostExecutionLine line, PostExecutionHead head,
        Guid userId, CancellationToken ct)
    {
        var asset = await connection.QuerySingleOrDefaultAsync<(decimal Current, bool IsMetered,
            string Status)>(new CommandDefinition("""
            SELECT current_meter_value AS Current, is_metered AS IsMetered, status AS Status
            FROM fixed_assets WHERE id = @id FOR UPDATE
            """, new { id = assetId }, tx, cancellationToken: ct));
        if (!asset.IsMetered || asset.Status != AssetStatuses.Active)
            throw new ValidationAppException("validation.asset_not_metered");
        var value = asset.Current + line.MeterUnits;
        if (value < 0) throw new ValidationAppException("validation.meter_value_invalid");
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO asset_meter_readings
                (asset_id, value, delta, source, note, source_line_id, created_by)
            VALUES (@assetId, @value, @delta, 'EXECUTION', @note, @sourceLineId, @userId)
            """, new
        {
            assetId, value, delta = line.MeterUnits,
            note = "تنفيذ خدمة " + (head.DocNo ?? ""), sourceLineId = line.Id, userId
        }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE fixed_assets
            SET current_meter_value = @value, updated_by = @userId, updated_at = now(),
                version = version + 1
            WHERE id = @id
            """, new { value, userId, id = assetId }, tx, cancellationToken: ct));
    }
}
