using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// مرتجعات مشتريات من شاشة مصروفات التشغيل: مرتبطة بفاتورة شراء أصلية، تُحفظ مسودة،
/// وتُرحَّل مع ترحيل الشفت (مخزون صادر + قيد + خصم مورد أو استرداد خزينة).
/// </summary>
public sealed class PurchaseReturnService
{
    private readonly IPurchaseReturnRepository _returns;
    private readonly ITreasuryRepository _treasury;
    private readonly ISettingsService _settings;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;

    public PurchaseReturnService(IPurchaseReturnRepository returns, ITreasuryRepository treasury,
        ISettingsService settings, PermissionService permissions, AuditService audit)
    {
        _returns = returns; _treasury = treasury; _settings = settings;
        _permissions = permissions; _audit = audit;
    }

    public async Task<IReadOnlyList<PurchaseReturn>> ListAsync(ActorContext actor,
        Guid? branchId, Guid? supplierId, string? status, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.OperatingExpenses, ActionCodes.View,
            ct: ct);
        var scoped = branchId ?? actor.CurrentBranchId ?? actor.AllowedBranchIds.FirstOrDefault();
        if (scoped == Guid.Empty) return Array.Empty<PurchaseReturn>();
        BranchScope.Ensure(actor, scoped);
        return await _returns.ListAsync(scoped, supplierId, status, 200, ct);
    }

    public async Task<IReadOnlyList<PurchaseReturnInvoiceOption>> ListInvoicesAsync(
        ActorContext actor, Guid branchId, Guid supplierId, string? search,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.OperatingExpenses, ActionCodes.Create,
            ct: ct);
        BranchScope.Ensure(actor, branchId);
        return await _returns.ListInvoicesAsync(branchId, supplierId, search, ct);
    }

    public async Task<PurchaseReturn> CreateAsync(ActorContext actor, PurchaseReturnInput input,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.OperatingExpenses, ActionCodes.Create,
            ct: ct);
        BranchScope.Ensure(actor, input.BranchId);
        var id = Guid.CreateVersion7();
        try { await _returns.CreateAsync(id, input, actor.UserId, ct); }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
        var created = await _returns.GetAsync(id, ct) ?? throw new NotFoundAppException();
        await _audit.WriteAsync(actor, "purchase_returns", id.ToString(), "INSERT", null, created,
            ct);
        return created;
    }

    public async Task<PurchaseReturn> PostAsync(ActorContext actor, Guid id,
        CancellationToken ct = default)
    {
        var existing = await _returns.GetAsync(id, ct) ?? throw new NotFoundAppException();
        await _permissions.RequireAsync(actor, ScreenCodes.OperatingExpenses, ActionCodes.Post,
            ct: ct);
        BranchScope.Ensure(actor, existing.BranchId);
        if (!existing.IsDraft)
            throw new ValidationAppException("validation.document_not_draft");
        var settings = await _settings.GetAsync(ct);
        try { await _returns.PostAsync(id, actor.UserId, settings.AllowNegativeStock, ct); }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
        var posted = await _returns.GetAsync(id, ct) ?? throw new NotFoundAppException();
        if (posted.VoucherId is { } voucherId)
            await _treasury.PostVoucherAsync(voucherId, actor.UserId, ct);
        await _audit.WriteAsync(actor, "purchase_returns", id.ToString(), "UPDATE",
            new { status = existing.Status }, new { status = posted.Status, posted.DocNo }, ct);
        return posted;
    }

    /// <summary>يُستدعى من ترحيل الشفت: ترحيل كل مرتجعات الشفت المسودة.</summary>
    public async Task<int> PostDraftsForShiftAsync(ActorContext actor, Guid shiftId,
        CancellationToken ct = default)
    {
        var ids = await _returns.ListDraftIdsForShiftAsync(shiftId, ct);
        var count = 0;
        foreach (var id in ids)
        {
            var current = await _returns.GetAsync(id, ct);
            if (current is null || !current.IsDraft) continue;
            var settings = await _settings.GetAsync(ct);
            await _returns.PostAsync(id, actor.UserId, settings.AllowNegativeStock, ct);
            var posted = await _returns.GetAsync(id, ct);
            if (posted?.VoucherId is { } voucherId)
                await _treasury.PostVoucherAsync(voucherId, actor.UserId, ct);
            await _audit.WriteAsync(actor, "purchase_returns", id.ToString(), "UPDATE",
                new { status = PurchaseReturnStatuses.Draft },
                new { status = PurchaseReturnStatuses.Posted }, ct);
            count++;
        }
        return count;
    }
}
