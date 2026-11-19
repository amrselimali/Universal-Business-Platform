using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class PurchaseReturnRepository
{
    private sealed record CalcLine(Guid? OriginalLineId, Guid? ExpenseLineId, Guid ItemId,
        Guid UnitId, Guid WarehouseId, decimal Quantity, decimal UnitPrice, decimal Amount);

    public async Task<Guid> CreateAsync(Guid id, PurchaseReturnInput input, Guid userId,
        CancellationToken ct = default)
    {
        if (!PurchaseReturnSourceTypes.IsValid(input.SourceType) ||
            input.BranchId == Guid.Empty || input.SupplierId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");

        var fromExpense = input.SourceType == PurchaseReturnSourceTypes.OperatingExpense;
        var sourceId = fromExpense ? input.OperatingExpenseId : input.OriginalDocumentId;
        if (sourceId is null || sourceId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");

        if (!PurchaseReturnMethods.IsValid(input.ReturnMethod))
            throw new ValidationAppException("validation.required_fields");
        if (input.ReturnMethod == PurchaseReturnMethods.Cash && input.TreasuryId is null)
            throw new ValidationAppException("validation.treasury_required");
        if (input.Lines.Count == 0)
            throw new ValidationAppException("validation.document_has_no_lines");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var calculated = new List<CalcLine>();

        if (!fromExpense)
        {
            var invoice = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId,
                Guid SupplierId, Guid? WarehouseId, string Status, string DocType)>(
                new CommandDefinition("""
                    SELECT id AS Id, branch_id AS BranchId, supplier_id AS SupplierId,
                           warehouse_id AS WarehouseId, status AS Status, doc_type AS DocType
                    FROM commercial_documents WHERE id = @id
                    """, new { id = sourceId }, tx, cancellationToken: ct));
            if (invoice.Id == Guid.Empty || invoice.DocType != "purchase_invoice" ||
                invoice.Status is not ("draft" or "posted") || invoice.BranchId != input.BranchId ||
                invoice.SupplierId != input.SupplierId || invoice.WarehouseId is null)
                throw new ValidationAppException("validation.invoice_not_found");

            var originalIds = input.Lines.Select(l => l.OriginalLineId).ToArray();
            if (originalIds.Distinct().Count() != originalIds.Length)
                throw new ValidationAppException("validation.booking_duplicate_line");

            var originals = (await connection.QueryAsync<OriginalLine>(new CommandDefinition("""
                SELECT l.id AS Id, l.item_id AS ItemId, l.unit_id AS UnitId,
                       l.quantity AS Quantity, l.returned_qty AS ReturnedQty,
                       l.unit_price AS UnitPrice,
                       COALESCE((SELECT SUM(prl.quantity) FROM purchase_return_lines prl
                                 JOIN purchase_returns pr ON pr.id = prl.return_id
                                 WHERE prl.original_line_id = l.id), 0) AS PriorReturnQty
                FROM commercial_document_lines l
                WHERE l.document_id = @documentId AND l.id = ANY(@ids)
                """, new { documentId = sourceId, ids = originalIds }, tx,
                cancellationToken: ct))).ToDictionary(x => x.Id);
            if (originals.Count != originalIds.Length)
                throw new ValidationAppException("validation.invoice_line_not_found");

            foreach (var line in input.Lines)
            {
                var original = originals[line.OriginalLineId];
                var returnable = Math.Max(original.Quantity - original.ReturnedQty -
                                          original.PriorReturnQty, 0);
                if (line.Quantity <= 0 || line.Quantity > returnable)
                    throw new ValidationAppException("validation.return_quantity_exceeds");
                var amount = Math.Round(line.Quantity * original.UnitPrice, 2,
                    MidpointRounding.AwayFromZero);
                calculated.Add(new CalcLine(original.Id, null, original.ItemId, original.UnitId,
                    invoice.WarehouseId.Value, line.Quantity, original.UnitPrice, amount));
            }
        }
        else
        {
            var expense = await connection.QuerySingleOrDefaultAsync<(Guid Id, Guid BranchId,
                Guid SupplierId, string Status)>(
                new CommandDefinition("""
                    SELECT id AS Id, branch_id AS BranchId, supplier_id AS SupplierId,
                           status AS Status
                    FROM operating_expenses WHERE id = @id
                    """, new { id = sourceId }, tx, cancellationToken: ct));
            if (expense.Id == Guid.Empty || expense.Status != "POSTED" ||
                expense.BranchId != input.BranchId || expense.SupplierId != input.SupplierId)
                throw new ValidationAppException("validation.invoice_not_found");

            if (input.Lines.Any(l => l.OperatingExpenseLineId is null ||
                                     l.OperatingExpenseLineId == Guid.Empty))
                throw new ValidationAppException("validation.required_fields");
            var lineIds = input.Lines.Select(l => l.OperatingExpenseLineId!.Value).ToArray();
            if (lineIds.Distinct().Count() != lineIds.Length)
                throw new ValidationAppException("validation.booking_duplicate_line");

            var originals = (await connection.QueryAsync<ExpenseOriginalLine>(
                new CommandDefinition("""
                SELECT l.id AS Id, l.item_id AS ItemId, l.unit_id AS UnitId,
                       l.warehouse_id AS WarehouseId, l.quantity AS Quantity,
                       l.unit_price AS UnitPrice,
                       COALESCE((SELECT SUM(prl.quantity) FROM purchase_return_lines prl
                                 WHERE prl.operating_expense_line_id = l.id), 0) AS PriorReturnQty
                FROM operating_expense_lines l
                WHERE l.expense_id = @expenseId AND l.id = ANY(@ids)
                  AND l.item_id IS NOT NULL
                """, new { expenseId = sourceId, ids = lineIds }, tx,
                cancellationToken: ct))).ToDictionary(x => x.Id);
            if (originals.Count != lineIds.Length)
                throw new ValidationAppException("validation.invoice_line_not_found");

            foreach (var line in input.Lines)
            {
                var original = originals[line.OperatingExpenseLineId!.Value];
                if (original.ItemId is null || original.UnitId is null ||
                    original.WarehouseId is null)
                    throw new ValidationAppException("validation.invoice_line_not_found");
                var returnable = Math.Max(original.Quantity - original.PriorReturnQty, 0);
                if (line.Quantity <= 0 || line.Quantity > returnable)
                    throw new ValidationAppException("validation.return_quantity_exceeds");
                var amount = Math.Round(line.Quantity * original.UnitPrice, 2,
                    MidpointRounding.AwayFromZero);
                calculated.Add(new CalcLine(null, original.Id, original.ItemId.Value,
                    original.UnitId.Value, original.WarehouseId.Value, line.Quantity,
                    original.UnitPrice, amount));
            }
        }

        var total = calculated.Sum(x => x.Amount);

        Guid? voucherId = null;
        if (input.ReturnMethod == PurchaseReturnMethods.Cash)
        {
            var methodId = input.TreasuryMethodId ?? await connection.ExecuteScalarAsync<Guid?>(
                new CommandDefinition("""
                SELECT id FROM treasury_methods
                WHERE treasury_id = @treasuryId AND is_active
                ORDER BY (code = 'DEFAULT') DESC, code LIMIT 1
                """, new { treasuryId = input.TreasuryId }, tx, cancellationToken: ct));
            if (methodId is null)
                throw new ValidationAppException("validation.treasury_method_not_found");
            voucherId = Guid.CreateVersion7();
            var supplierName = await connection.ExecuteScalarAsync<string>(new CommandDefinition(
                "SELECT name_ar FROM suppliers WHERE id = @id", new { id = input.SupplierId }, tx,
                cancellationToken: ct));
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO vouchers
                    (id, branch_id, doc_date, status, voucher_type, party_type, party_id,
                     party_name, treasury_id, total_amount, fee_total, notes, created_by)
                VALUES (@voucherId, @branchId, @docDate, 'draft', 'receipt', 'S', @supplierId,
                        @supplierName, @treasuryId, @total, 0, @notes, @userId)
                """, new
            {
                voucherId,
                branchId = input.BranchId,
                docDate = input.DocDate.Date,
                supplierId = input.SupplierId,
                supplierName,
                treasuryId = input.TreasuryId,
                total,
                notes = "استرداد مرتجع مشتريات",
                userId
            }, tx, cancellationToken: ct));
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO voucher_lines (voucher_id, line_no, treasury_method_id, amount, fee_amount)
                VALUES (@voucherId, 1, @methodId, @total, 0)
                """, new { voucherId, methodId, total }, tx, cancellationToken: ct));
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO purchase_returns
                (id, branch_id, doc_date, supplier_id, original_document_id, source_type,
                 operating_expense_id, return_method, treasury_id, treasury_method_id,
                 total_amount, status, notes, voucher_id, created_by)
            VALUES (@id, @branchId, @docDate, @supplierId, @originalDocumentId, @sourceType,
                    @operatingExpenseId, @returnMethod, @treasuryId, @treasuryMethodId,
                    @total, 'DRAFT', @notes, @voucherId, @userId)
            """, new
        {
            id,
            branchId = input.BranchId,
            docDate = input.DocDate.Date,
            supplierId = input.SupplierId,
            originalDocumentId = fromExpense ? (Guid?)null : sourceId,
            sourceType = input.SourceType,
            operatingExpenseId = fromExpense ? sourceId : (Guid?)null,
            returnMethod = input.ReturnMethod,
            input.TreasuryId,
            input.TreasuryMethodId,
            total,
            notes = Clean(input.Notes),
            voucherId,
            userId
        }, tx, cancellationToken: ct));

        var lineNo = 0;
        foreach (var item in calculated)
        {
            lineNo++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO purchase_return_lines
                    (return_id, line_no, original_line_id, operating_expense_line_id, item_id,
                     unit_id, warehouse_id, quantity, unit_price, amount)
                VALUES (@returnId, @lineNo, @originalLineId, @expenseLineId, @itemId,
                        @unitId, @warehouseId, @quantity, @unitPrice, @amount)
                """, new
            {
                returnId = id,
                lineNo,
                originalLineId = item.OriginalLineId,
                expenseLineId = item.ExpenseLineId,
                itemId = item.ItemId,
                unitId = item.UnitId,
                warehouseId = item.WarehouseId,
                quantity = item.Quantity,
                unitPrice = item.UnitPrice,
                amount = item.Amount
            }, tx, cancellationToken: ct));
        }

        await tx.CommitAsync(ct);
        return id;
    }

    private sealed class OriginalLine
    {
        public Guid Id { get; set; }
        public Guid ItemId { get; set; }
        public Guid UnitId { get; set; }
        public decimal Quantity { get; set; }
        public decimal ReturnedQty { get; set; }
        public decimal PriorReturnQty { get; set; }
        public decimal UnitPrice { get; set; }
    }

    private sealed class ExpenseOriginalLine
    {
        public Guid Id { get; set; }
        public Guid? ItemId { get; set; }
        public Guid? UnitId { get; set; }
        public Guid? WarehouseId { get; set; }
        public decimal Quantity { get; set; }
        public decimal PriorReturnQty { get; set; }
        public decimal UnitPrice { get; set; }
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}