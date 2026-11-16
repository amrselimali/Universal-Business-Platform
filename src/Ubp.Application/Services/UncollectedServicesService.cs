using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>شاشة الخدمات غير المحصلة لكل العملاء — صلاحية مستقلة عن شاشة الحجوزات.</summary>
public sealed class UncollectedServicesService
{
    private readonly IReservationRepository _reservations;
    private readonly PermissionService _permissions;

    public UncollectedServicesService(IReservationRepository reservations,
        PermissionService permissions)
    {
        _reservations = reservations; _permissions = permissions;
    }

    public async Task<IReadOnlyList<ReservationRow>> ListAsync(ActorContext actor,
        DateTime? from, DateTime? to, Guid? branchId, string sort,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.UncollectedServices,
            ActionCodes.View, ct: ct);
        var branchIds = actor.IsSuperAdmin
            ? Array.Empty<Guid>()
            : actor.AllowedBranchIds.Distinct().ToArray();
        return await _reservations.ListUncollectedAsync(from?.Date, to?.Date, branchId,
            actor.IsSuperAdmin, branchIds, sort, ct);
    }
}
