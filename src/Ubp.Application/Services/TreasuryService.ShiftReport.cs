using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Application.Services;

/// <summary>تقرير الشفت ومراجعتها: عرض شامل للتسجيلات ثم اعتماد المحاسب.</summary>
public sealed partial class TreasuryService
{
    /// <summary>
    /// تقرير الشفت: تحصيلات وإيرادات وحركة خزائن، وعملاء بلا متابعة أو حجز مستقبلي،
    /// وحجوزات ومواعيد موظفي الغد، وكل ما سُجّل في الشفت (مسودات ومرحّل غير الملغى).
    /// </summary>
    public async Task<ShiftReport> GetShiftReportAsync(ActorContext actor, Guid shiftId,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.View, ct: ct);
        var report = await _treasury.GetShiftReportAsync(shiftId, ct);
        BranchScope.Ensure(actor, report.Shift.BranchId);
        return report;
    }

    public async Task<IReadOnlyList<ShiftReviewItem>> ListReviewItemsAsync(ActorContext actor,
        Guid shiftId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.View, ct: ct);
        return await _treasury.ListReviewItemsAsync(shiftId, ct);
    }

    /// <summary>
    /// الحركات المسودة المعلّقة على الشفت (تُعرض للمحاسب قبل تأكيد اعتماد المراجعة) — 0220.
    /// </summary>
    public async Task<IReadOnlyList<ShiftDraftPosting>> ListDraftPostingsAsync(ActorContext actor,
        Guid shiftId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.View, ct: ct);
        var shift = await _treasury.GetShiftAsync(shiftId, ct) ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, shift.BranchId);
        return await _treasury.ListDraftPostingsAsync(shiftId, ct);
    }

    /// <summary>
    /// إرسال الشفت للمراجعة بلا أي ترحيل محاسبي (0220): كل الحركات مسودات حتى «اعتماد المراجعة».
    /// </summary>
    public async Task PostShiftToAccountsAsync(ActorContext actor, Guid shiftId,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.Approve,
            ct: ct);
        var shift = await _treasury.GetShiftAsync(shiftId, ct) ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, shift.BranchId);
        // لا يُرحَّل شيء هنا: الترحيل الفعلي يتم عند اعتماد المراجعة بعد عرض المسودات — 0220.
        if (!await _treasury.PostShiftAsync(shiftId, actor.UserId, ct))
            throw new ValidationAppException("validation.shift_not_closed");
        await _audit.WriteAsync(actor, "cashier_shifts", shiftId.ToString(), "UPDATE", null,
            new { review_status = ShiftReviewStatuses.Pending }, ct);
    }

    /// <summary>
    /// اعتماد مراجعة الشفت: يوزر محاسب يملك صلاحية APPROVE (تُمنح وقت تكويد المستخدم)
    /// يُرحّل كل الحركات المسودة المعلّقة على الشفت (0220) ثم يغلق دورة المراجعة.
    /// </summary>
    public async Task<Shift> ReviewShiftAsync(ActorContext actor, Guid shiftId,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.TreasuryShifts, ActionCodes.Approve,
            ct: ct);
        var shift = await _treasury.GetShiftAsync(shiftId, ct) ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, shift.BranchId);

        // 1) ترحيل المستندات المسودة المعلّقة على الشفت (مرتجعات مشتريات + إيصالات + تنفيذات).
        await _purchaseReturns.PostDraftsForShiftAsync(actor, shiftId, ct);
        foreach (var voucherId in await _treasury.AdoptAndListDraftReceiptIdsForShiftAsync(
                     shiftId, ct))
            await _treasury.PostVoucherAsync(voucherId, actor.UserId, ct);
        var settings = await _settings.GetAsync(ct);
        await _executions.PostDraftsForShiftAsync(shiftId, actor.UserId,
            settings.AllowNegativeStock, ct);

        // 2) ترحيل باقي قيود الشفت المسودة (بيع POS/تكلفة، سلف، تسليمات، تسويات، فروق…) + قيد العجز.
        var reviewed = await _treasury.ReviewShiftAsync(shiftId, actor.UserId, ct);
        await _audit.WriteAsync(actor, "shift_review_items", shiftId.ToString(), "UPDATE",
            new { status = ShiftReviewStatuses.Pending },
            new { status = reviewed.ReviewStatus }, ct);
        return reviewed;
    }
}
