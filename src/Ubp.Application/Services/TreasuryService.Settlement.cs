using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Application.Services;

public sealed partial class TreasuryService
{
    /// <summary>معاينة تسوية شفت الدكتور الخارجي قبل الإقفال اليدوي.</summary>
    public async Task<ExternalDoctorSettlementPreview> GetExternalDoctorSettlementAsync(
        ActorContext actor, Guid shiftId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.View,
            ct: ct);
        var shift = await _treasury.GetShiftAsync(shiftId, ct) ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, shift.BranchId);
        return await _treasury.GetExternalDoctorSettlementAsync(shiftId, ct);
    }
}
