using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// شاشة «تسويات جردية»: قائمة الجرودات بفترة ومخزن، عرض تفاصيلها للقراءة فقط،
/// وترحيل موحّد ينفّذ الجرد + التسوية المخزنية + القيد المحاسبي بصلاحيات مستقلة.
/// </summary>
public sealed class StocktakeSettlementService
{
    private readonly IStocktakeRepository _stocktakes;
    private readonly IStocktakeSettlementRepository _settlements;
    private readonly IWarehouseRepository _warehouses;
    private readonly ISettingsService _settings;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;

    public StocktakeSettlementService(IStocktakeRepository stocktakes,
        IStocktakeSettlementRepository settlements, IWarehouseRepository warehouses,
        ISettingsService settings, PermissionService permissions, AuditService audit)
    {
        _stocktakes = stocktakes; _settlements = settlements; _warehouses = warehouses;
        _settings = settings; _permissions = permissions; _audit = audit;
    }

    /// <summary>مخازن فلتر الشاشة بصلاحية الشاشة الجديدة وحدها (بلا اشتراط صلاحية شاشة المخازن).</summary>
    public async Task<IReadOnlyList<Warehouse>> ListWarehousesAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.StocktakeSettlements,
            ActionCodes.View, ct: ct);
        return await _warehouses.ListOptionsForUserAsync(actor.UserId, actor.AllowedBranchIds,
            actor.IsAdmin, ct);
    }

    public async Task<PagedResult<Stocktake>> ListAsync(ActorContext actor, PageRequest request,
        DateTime? from, DateTime? to, Guid? warehouseId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.StocktakeSettlements,
            ActionCodes.View, ct: ct);
        if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date)
            throw new ValidationAppException("validation.date_range");
        return await _stocktakes.ListSettlementsAsync(request, from?.Date, to?.Date,
            warehouseId, actor.IsAdmin, actor.AllowedBranchIds, ct);
    }

    public async Task<StocktakeDetail> GetDetailAsync(ActorContext actor, Guid id,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.StocktakeSettlements,
            ActionCodes.View, ct: ct);
        return await LoadAsync(actor, id, ct);
    }

    public async Task<StocktakeSettlementResult> PostAsync(ActorContext actor, Guid id,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.StocktakeSettlements,
            ActionCodes.Post, ct: ct);
        var detail = await LoadAsync(actor, id, ct);
        if (detail.Header.Status != "DRAFT")
            throw new ValidationAppException("validation.stocktake_not_draft");

        var differences = detail.Lines.Where(l => l.Difference != 0).ToList();
        if (differences.Count == 0)
            throw new ValidationAppException("validation.stocktake_no_differences");

        var settings = await _settings.GetAsync(ct);
        StocktakeSettlementResult result;
        try
        {
            result = await _settlements.PostAsync(id, DateTime.UtcNow.Date, actor.UserId,
                settings.AllowNegativeStock, ct);
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }

        await _audit.WriteAsync(actor, "stocktakes", id.ToString(), "UPDATE",
            new { status = "DRAFT" }, new
            {
                status = "POSTED",
                documentId = result.DocumentId,
                documentNo = result.DocumentNo,
                entryId = result.EntryId,
                rows = result.LinesCount,
                totalCost = result.TotalCost
            }, ct);
        return result;
    }

    private async Task<StocktakeDetail> LoadAsync(ActorContext actor, Guid id,
        CancellationToken ct)
    {
        var detail = await _stocktakes.GetDetailAsync(id, ct) ?? throw new NotFoundAppException();
        if (!actor.CanAccessBranch(detail.Header.BranchId))
            throw new ForbiddenException("error.branch_not_allowed");
        return detail;
    }
}
