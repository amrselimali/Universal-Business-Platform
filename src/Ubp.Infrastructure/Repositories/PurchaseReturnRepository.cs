using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPurchaseReturnRepository
{
    Task<IReadOnlyList<PurchaseReturn>> ListAsync(Guid? branchId, Guid? supplierId,
        string? status, int limit, CancellationToken ct = default);
    Task<PurchaseReturn?> GetAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<PurchaseReturnInvoiceOption>> ListInvoicesAsync(Guid branchId,
        Guid supplierId, string? search, CancellationToken ct = default);
    Task<IReadOnlyList<OperatingExpenseStockLineOption>> ListOperatingExpenseStockLinesAsync(
        Guid branchId, string? search, CancellationToken ct = default);
    Task<Guid> CreateAsync(Guid id, PurchaseReturnInput input, Guid userId,
        CancellationToken ct = default);
    Task<PurchaseReturn> PostAsync(Guid id, Guid userId, bool allowNegative,
        CancellationToken ct = default);
    Task<IReadOnlyList<Guid>> ListDraftIdsForShiftAsync(Guid shiftId,
        CancellationToken ct = default);
}

public sealed partial class PurchaseReturnRepository : IPurchaseReturnRepository
{
    private readonly IDbConnectionFactory _factory;
    public PurchaseReturnRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string HeaderColumns = """
        r.id AS Id, r.branch_id AS BranchId, b.name_ar AS BranchName, r.doc_no AS DocNo,
        r.doc_date AS DocDate, r.supplier_id AS SupplierId, s.name_ar AS SupplierName,
        r.original_document_id AS OriginalDocumentId,
        r.operating_expense_id AS OperatingExpenseId,
        COALESCE(d.doc_no, e.doc_no) AS OriginalDocNo,
        r.source_type AS SourceType, r.return_method AS ReturnMethod, r.treasury_id AS TreasuryId,
        t.name_ar AS TreasuryName, r.treasury_method_id AS TreasuryMethodId,
        r.total_amount AS TotalAmount, r.status AS Status, r.notes AS Notes,
        r.stock_document_id AS StockDocumentId, r.voucher_id AS VoucherId,
        r.journal_entry_id AS JournalEntryId, r.created_at AS CreatedAt,
        r.posted_at AS PostedAt
        """;

    private const string HeaderJoins = """
        FROM purchase_returns r
        JOIN branches b ON b.id = r.branch_id
        JOIN suppliers s ON s.id = r.supplier_id
        LEFT JOIN commercial_documents d ON d.id = r.original_document_id
        LEFT JOIN operating_expenses e ON e.id = r.operating_expense_id
        LEFT JOIN treasuries t ON t.id = r.treasury_id
        """;

    public async Task<IReadOnlyList<PurchaseReturn>> ListAsync(Guid? branchId,
        Guid? supplierId, string? status, int limit, CancellationToken ct = default)
    {
        var take = limit is < 1 or > 500 ? 200 : limit;
        await using var connection = await _factory.OpenAsync(ct);
        var rows = (await connection.QueryAsync<PurchaseReturn>(new CommandDefinition($"""
            SELECT {HeaderColumns} {HeaderJoins}
            WHERE (@branchId::uuid IS NULL OR r.branch_id = @branchId::uuid)
              AND (@supplierId::uuid IS NULL OR r.supplier_id = @supplierId::uuid)
              AND (@status::varchar IS NULL OR r.status = @status::varchar)
            ORDER BY r.doc_date DESC, r.created_at DESC
            LIMIT @take
            """, new { branchId, supplierId, status, take }, cancellationToken: ct))).ToList();
        foreach (var row in rows) row.Lines = await LoadLinesAsync(connection, row.Id, ct);
        return rows;
    }

    public async Task<PurchaseReturn?> GetAsync(Guid id, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var header = await connection.QuerySingleOrDefaultAsync<PurchaseReturn>(
            new CommandDefinition($"SELECT {HeaderColumns} {HeaderJoins} WHERE r.id = @id",
                new { id }, cancellationToken: ct));
        if (header is null) return null;
        header.Lines = await LoadLinesAsync(connection, id, ct);
        return header;
    }

    private static async Task<IReadOnlyList<PurchaseReturnLine>> LoadLinesAsync(
        NpgsqlConnection connection, Guid id, CancellationToken ct) =>
        (await connection.QueryAsync<PurchaseReturnLine>(new CommandDefinition("""
            SELECT l.id AS Id, l.line_no AS LineNo, l.original_line_id AS OriginalLineId,
                   l.operating_expense_line_id AS OperatingExpenseLineId,
                   CASE WHEN l.operating_expense_line_id IS NOT NULL
                        THEN 'OPERATING_EXPENSE' ELSE 'INVOICE' END AS SourceType,
                   l.item_id AS ItemId, i.code AS ItemCode, i.name_ar AS ItemName,
                   l.unit_id AS UnitId, l.warehouse_id AS WarehouseId,
                   w.name_ar AS WarehouseName, l.quantity AS Quantity,
                   l.unit_price AS UnitPrice, l.amount AS Amount,
                   l.stock_document_id AS StockDocumentId
            FROM purchase_return_lines l
            JOIN items i ON i.id = l.item_id
            JOIN warehouses w ON w.id = l.warehouse_id
            WHERE l.return_id = @id ORDER BY l.line_no
            """, new { id }, cancellationToken: ct))).ToList();

    public async Task<IReadOnlyList<PurchaseReturnInvoiceOption>> ListInvoicesAsync(
        Guid branchId, Guid supplierId, string? search, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var headers = (await connection.QueryAsync<PurchaseReturnInvoiceOption>(
            new CommandDefinition("""
                SELECT d.id AS Id, d.doc_no AS DocNo, d.doc_date AS DocDate,
                       d.supplier_id AS SupplierId, s.name_ar AS SupplierName, d.total AS Total,
                       d.status AS Status
                FROM commercial_documents d
                JOIN suppliers s ON s.id = d.supplier_id
                WHERE d.branch_id = @branchId AND d.supplier_id = @supplierId
                  AND d.doc_type = 'purchase_invoice'
                  AND d.status IN ('draft', 'posted')
                  AND (@search::varchar IS NULL OR d.doc_no ILIKE '%' || @search || '%')
                ORDER BY d.doc_date DESC, d.doc_no DESC
                LIMIT 100
                """, new { branchId, supplierId, search }, cancellationToken: ct))).ToList();
        if (headers.Count == 0) return headers;

        var ids = headers.Select(h => h.Id).ToArray();
        var lines = (await connection.QueryAsync<InvoiceLineRow>(new CommandDefinition("""
            SELECT l.document_id AS DocumentId,
                   l.id AS OriginalLineId, l.item_id AS ItemId, i.code AS ItemCode,
                   i.name_ar AS ItemName, l.unit_id AS UnitId, d.warehouse_id AS WarehouseId,
                   l.quantity AS Quantity, l.returned_qty AS ReturnedQty,
                   GREATEST(l.quantity - l.returned_qty - COALESCE((
                       SELECT SUM(prl.quantity) FROM purchase_return_lines prl
                       JOIN purchase_returns pr ON pr.id = prl.return_id
                       WHERE prl.original_line_id = l.id
                   ), 0), 0) AS ReturnableQty,
                   l.unit_price AS UnitPrice
            FROM commercial_document_lines l
            JOIN commercial_documents d ON d.id = l.document_id
            JOIN items i ON i.id = l.item_id
            WHERE l.document_id = ANY(@ids)
            ORDER BY l.line_no
            """, new { ids }, cancellationToken: ct))).ToList();

        foreach (var header in headers)
            header.Lines = lines.Where(x => x.DocumentId == header.Id)
                .Select(x => new PurchaseReturnInvoiceLineOption
                {
                    OriginalLineId = x.OriginalLineId,
                    ItemId = x.ItemId,
                    ItemCode = x.ItemCode,
                    ItemName = x.ItemName,
                    UnitId = x.UnitId,
                    WarehouseId = x.WarehouseId,
                    Quantity = x.Quantity,
                    ReturnedQty = x.ReturnedQty,
                    ReturnableQty = x.ReturnableQty,
                    UnitPrice = x.UnitPrice
                }).ToList();
        return headers;
    }

    private sealed class InvoiceLineRow
    {
        public Guid DocumentId { get; set; }
        public Guid OriginalLineId { get; set; }
        public Guid ItemId { get; set; }
        public string? ItemCode { get; set; }
        public string? ItemName { get; set; }
        public Guid UnitId { get; set; }
        public Guid WarehouseId { get; set; }
        public decimal Quantity { get; set; }
        public decimal ReturnedQty { get; set; }
        public decimal ReturnableQty { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public async Task<IReadOnlyList<OperatingExpenseStockLineOption>> ListOperatingExpenseStockLinesAsync(
        Guid branchId, string? search, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<OperatingExpenseStockLineOption>(new CommandDefinition("""
            SELECT l.id AS Id, l.expense_id AS ExpenseId, e.supplier_id AS SupplierId,
                   e.doc_no AS ExpenseDocNo, e.doc_date AS ExpenseDocDate,
                   l.item_id AS ItemId, i.code AS ItemCode, i.name_ar AS ItemName,
                   l.unit_id AS UnitId, l.warehouse_id AS WarehouseId,
                   w.name_ar AS WarehouseName, l.quantity AS OriginalQty,
                   COALESCE((
                       SELECT SUM(prl.quantity)
                       FROM purchase_return_lines prl
                       JOIN purchase_returns pr ON pr.id = prl.return_id
                       WHERE prl.operating_expense_line_id = l.id
                   ), 0) AS ReturnedQty,
                   GREATEST(l.quantity - COALESCE((
                       SELECT SUM(prl.quantity)
                       FROM purchase_return_lines prl
                       JOIN purchase_returns pr ON pr.id = prl.return_id
                       WHERE prl.operating_expense_line_id = l.id
                   ), 0), 0) AS ReturnableQty,
                   l.unit_price AS UnitPrice
            FROM operating_expense_lines l
            JOIN operating_expenses e ON e.id = l.expense_id
            JOIN items i ON i.id = l.item_id
            LEFT JOIN warehouses w ON w.id = l.warehouse_id
            WHERE l.item_id IS NOT NULL
              AND e.branch_id = @branchId
              AND e.status = 'POSTED'
              AND (@search::varchar IS NULL OR i.code ILIKE '%' || @search || '%'
                   OR i.name_ar ILIKE '%' || @search || '%')
            ORDER BY e.doc_date DESC, l.line_no
            LIMIT 200
            """, new { branchId, search }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<Guid>> ListDraftIdsForShiftAsync(Guid shiftId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var ids = await connection.QueryAsync<Guid>(new CommandDefinition("""
            SELECT r.id
            FROM purchase_returns r
            JOIN cashier_shifts s ON s.id = @shiftId
            WHERE r.status = 'DRAFT' AND r.branch_id = s.branch_id
              AND r.created_at >= s.opened_at
              AND (s.closed_at IS NULL OR r.created_at <= s.closed_at)
            """, new { shiftId }, cancellationToken: ct));
        return ids.ToList();
    }
}