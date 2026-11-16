using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// تسوية حساب عميل للخدمات المحجوزة: شاشة التسوية + استهلاك المتبقي + إيصال وقيد مسودة.
/// لا تُرحّل القيود إلى الأستاذ إلا عند ترحيل السند أو اعتماد الشفت.
/// </summary>
public sealed class BookingSettlementService
{
    private readonly IBookingSettlementRepository _settlements;
    private readonly ITreasuryRepository _treasuries;
    private readonly IItemRepository _items;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;

    public BookingSettlementService(IBookingSettlementRepository settlements,
        ITreasuryRepository treasuries, IItemRepository items, PermissionService permissions,
        AuditService audit)
    {
        _settlements = settlements; _treasuries = treasuries; _items = items;
        _permissions = permissions; _audit = audit;
    }

    public async Task<IReadOnlyList<ItemOption>> ListServicesAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Reservations,
            ActionCodes.SettleAccount, ct: ct);
        return (await _items.ListServiceOptionsAsync(null, 500, ct)).ToList();
    }

    public async Task<BookingSettlementSheet?> GetSheetAsync(ActorContext actor, Guid branchId,
        Guid customerId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Reservations,
            ActionCodes.SettleAccount, ct: ct);
        BranchScope.Ensure(actor, branchId);
        return await _settlements.GetSheetAsync(branchId, customerId, ct);
    }

    public async Task<IReadOnlyList<Treasury>> ListTreasuriesAsync(ActorContext actor,
        Guid branchId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Reservations,
            ActionCodes.SettleAccount, ct: ct);
        BranchScope.Ensure(actor, branchId);
        return (await _treasuries.ListTreasuriesAsync(branchId, ct))
            .Where(t => t.IsActive).ToList();
    }

    public async Task<BookingSettlementResult> SettleAsync(ActorContext actor,
        BookingSettlementInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Reservations,
            ActionCodes.SettleAccount, ct: ct);
        BranchScope.Ensure(actor, input.BranchId);

        var settlementId = Guid.CreateVersion7();
        var voucherId = Guid.CreateVersion7();
        try
        {
            var result = await _settlements.CreateAsync(settlementId, voucherId, input,
                actor.UserId, ct);
            await _audit.WriteAsync(actor, "booking_settlements", settlementId.ToString(),
                "INSERT", null, new
                {
                    input.CustomerId, input.TreasuryId, result.TotalRefund,
                    result.TotalSettledQty, result.LinesCount, result.VoucherId,
                    result.NewBookingId, result.NewBookingNo
                }, ct);
            return result;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }
}
