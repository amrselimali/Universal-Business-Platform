using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IStocktakeSettlementRepository
{
    /// <summary>
    /// ترحيل موحّد وذرّي: مستند تسوية مخزنية + حركة المخزون + قيد محاسبي مرحّل.
    /// كل الخطوات في معاملة واحدة؛ أي فشل (حسابات/فترة/رصيد) يلغي كل شيء.
    /// </summary>
    Task<StocktakeSettlementResult> PostAsync(Guid stocktakeId, DateTime docDate,
        Guid userId, bool allowNegative, CancellationToken ct = default);
}

/// <summary>
/// تنفيذ تسوية الجرد كوحدة واحدة: إنشاء مستند ADJUSTMENT من فروق الجرد وترحيله،
/// ثم توليد قيد المخزون وترحيله إلى الأستاذ — دون الخروج من نفس المعاملة.
/// </summary>
public sealed class StocktakeSettlementRepository : IStocktakeSettlementRepository
{
    private readonly IDbConnectionFactory _factory;

    public StocktakeSettlementRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<StocktakeSettlementResult> PostAsync(Guid stocktakeId, DateTime docDate,
        Guid userId, bool allowNegative, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var header = await connection.QuerySingleOrDefaultAsync<PostHeader>(
            new CommandDefinition("""
                SELECT id AS Id, code AS Code, branch_id AS BranchId,
                       warehouse_id AS WarehouseId, status AS Status
                FROM stocktakes WHERE id = @stocktakeId FOR UPDATE
                """, new { stocktakeId }, tx, cancellationToken: ct))
            ?? throw new NotFoundAppException();

        if (header.Status != "DRAFT")
            throw new ValidationAppException("validation.stocktake_not_draft");

        var differences = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT count(*)::int FROM stocktake_lines WHERE stocktake_id = @stocktakeId AND difference <> 0",
            new { stocktakeId }, tx, cancellationToken: ct));
        if (differences == 0)
            throw new ValidationAppException("validation.stocktake_no_differences");

        var documentId = Guid.CreateVersion7();
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO stock_documents
                (id, doc_type, doc_date, branch_id, warehouse_id, notes, created_by, stocktake_id)
            VALUES
                (@documentId, 'ADJUSTMENT', @docDate, @branchId, @warehouseId, @notes, @userId,
                 @stocktakeId)
            """, new
        {
            documentId, docDate, header.BranchId, header.WarehouseId, userId, stocktakeId,
            notes = $"تسوية جرد {header.Code}"
        }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO stock_document_lines
                (document_id, line_no, direction, item_id, unit_id, conversion_factor,
                 quantity, base_quantity, unit_cost, notes)
            SELECT @documentId,
                   (row_number() OVER (ORDER BY l.item_id))::smallint,
                   CASE WHEN l.difference > 0 THEN 'IN' ELSE 'OUT' END,
                   l.item_id, i.base_unit_id, 1,
                   abs(l.difference), abs(l.difference), l.unit_cost,
                   'فرق جرد: ' || l.difference::text
            FROM stocktake_lines l
            JOIN items i ON i.id = l.item_id
            WHERE l.stocktake_id = @stocktakeId AND l.difference <> 0
            """, new { documentId, stocktakeId }, tx, cancellationToken: ct));

        await StockPostingRepository.PostCoreAsync(connection, tx, documentId, userId,
            allowNegative, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE stocktakes
               SET status = 'POSTED', posted_at = now(), posted_by = @userId
             WHERE id = @stocktakeId AND status = 'DRAFT'
            """, new { stocktakeId, userId }, tx, cancellationToken: ct));

        Guid entryId;
        try
        {
            entryId = await StockAccountingRepository.GenerateCoreAsync(connection, tx,
                documentId, userId, ct);
        }
        catch (ValidationAppException ex) when (ex.Code == "validation.document_has_no_lines")
        {
            // فروق بكميات لكن بتكلفة صفرية: لا يوجد قيد محاسبي بقيمة، ويظل ترحيل المخزون صحيحًا.
            entryId = Guid.Empty;
        }

        var info = await connection.QuerySingleAsync<DocumentInfo>(new CommandDefinition("""
            SELECT doc_no AS DocumentNo, total_cost AS TotalCost,
                   (SELECT count(*)::int FROM stock_document_lines
                     WHERE document_id = @documentId) AS LinesCount
            FROM stock_documents WHERE id = @documentId
            """, new { documentId }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return new StocktakeSettlementResult(stocktakeId, documentId, info.DocumentNo,
            entryId, info.TotalCost, info.LinesCount);
    }

    private sealed class PostHeader
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = "";
        public Guid BranchId { get; set; }
        public Guid WarehouseId { get; set; }
        public string Status { get; set; } = "";
    }

    private sealed class DocumentInfo
    {
        public string? DocumentNo { get; set; }
        public decimal TotalCost { get; set; }
        public int LinesCount { get; set; }
    }
}
