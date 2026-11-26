using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// تعديل موحّد لبيانات الشفت من تقرير الشفت: اليوزر العادي يعدّل مسودات الشفت **المفتوحة**،
/// والمحاسب يعدّل ما لم يُرحَّل (شفت مُغلقة بانتظار المراجعة). يعدّل المستند الأصلي بكل آثاره.
/// </summary>
public sealed class ShiftEditService
{
    private readonly IShiftEditRepository _repo;
    private readonly ITreasuryRepository _treasury;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;

    public ShiftEditService(IShiftEditRepository repo, ITreasuryRepository treasury,
        PermissionService permissions, AuditService audit)
    {
        _repo = repo; _treasury = treasury; _permissions = permissions; _audit = audit;
    }

    public async Task<IReadOnlyList<ShiftEditableLine>> ListAsync(ActorContext actor, Guid shiftId,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.View, ct: ct);
        return await _repo.ListEditableAsync(shiftId, ct);
    }

    public async Task<ShiftEditOutcome> ApplyAsync(ActorContext actor, ShiftLineEditInput input,
        CancellationToken ct = default)
    {
        var isExecution = input.EntityType == "booking_execution";
        if (isExecution)
        {
            // صلاحية مستقلة لتعديل الخدمات المنفذة؛ لا تشترط حالة الشفت أو مسودة التنفيذ.
            await _permissions.RequireAsync(actor, ScreenCodes.Reservations,
                ActionCodes.EditExecuted, ct: ct);
        }
        else
        {
            await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.Edit,
                ct: ct);
        }
        var shift = await _treasury.GetShiftAsync(input.ShiftId, ct)
                    ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, shift.BranchId);

        if (!isExecution && !shift.IsOpen)
        {
            // بعد الإغلاق: فقط المحاسب (اعتماد المراجعة) وقبل الترحيل.
            await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.Approve,
                ct: ct);
            if (!shift.IsPendingReview)
                throw new ValidationAppException("validation.shift_edit_locked");
        }

        var outcome = await _repo.ApplyAsync(input, actor.UserId, ct);
        await _audit.WriteAsync(actor, "shift_edits", input.DocId.ToString(), "UPDATE", null,
            new { input.EntityType, input.LineId, input.Field, input.NewValue, input.Note }, ct);
        return outcome;
    }

    /// <summary>
    /// حذف سطر من مستندات الشفت (وليس تعديله): يُشترط عدم وجود تنفيذ أو حركة على السطر،
    /// وسطور المستندات تُحذف في المسودة فقط. السطر يُحذف من المصدر فيختفي من كل الشاشات.
    /// </summary>
    public async Task<ShiftLineDeleteResult> DeleteAsync(ActorContext actor,
        ShiftLineDeleteInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.Edit,
            ct: ct);
        var shift = await _treasury.GetShiftAsync(input.ShiftId, ct)
                    ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, shift.BranchId);

        if (!shift.IsOpen)
        {
            await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.Approve,
                ct: ct);
            if (!shift.IsPendingReview)
                throw new ValidationAppException("validation.shift_edit_locked");
        }

        var result = await _repo.DeleteLineAsync(input, actor.UserId, ct);
        await _audit.WriteAsync(actor, "shift_edits", input.DocId.ToString(), "DELETE",
            new { input.EntityType, input.LineId, input.Note },
            new { result.DocumentDeleted }, ct);
        return result;
    }
}
