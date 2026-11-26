using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>تنفيذ حجز مباشرة من شاشة الحجوزات مع تسجيل وحدات عدّاد الأصل.</summary>
public sealed class BookingExecutionService
{
    private readonly IBookingExecutionRepository _executions;
    private readonly IBranchRepository _branches;
    private readonly ISettingsService _settings;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;

    public BookingExecutionService(IBookingExecutionRepository executions,
        IBranchRepository branches,
        ISettingsService settings, PermissionService permissions, AuditService audit)
    {
        _executions = executions; _branches = branches; _settings = settings;
        _permissions = permissions; _audit = audit;
    }

    public async Task<BookingExecutionPreview> GetPreviewAsync(ActorContext actor,
        Guid bookingLineId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Reservations, ActionCodes.Execute, ct: ct);
        var preview = await _executions.GetPreviewAsync(bookingLineId, ct);
        BranchScope.Ensure(actor, preview.BranchId);
        var settings = await _settings.GetAsync(ct);
        preview.UnitsColumnLabel = settings.MeterUnitLabel;
        return preview;
    }

    public async Task<BookingExecutionResult> ExecuteAsync(ActorContext actor,
        BookingExecutionInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Reservations, ActionCodes.Execute, ct: ct);
        var preview = await _executions.GetPreviewAsync(input.BookingLineId, ct);
        BranchScope.Ensure(actor, preview.BranchId);
        var direct = ItemExecutionModes.IsDirect(preview.ExecutionMode);
        // الموظف المطلوب للتنفيذ: مَن سجّله الحجز/الموعد (preview) **أو المنفّذ المختار في الحوار**
        // (input.EmployeeId). اختيار منفّذ صالح في شاشة التنفيذ يكفي ولا يُرفض الطلب.
        var hasEmployee = !string.IsNullOrWhiteSpace(preview.EmployeeName) ||
                          input.EmployeeId is not null;
        if (!direct && preview.ItemType == "SERVICE" && !hasEmployee)
            throw new ValidationAppException("validation.execution_employee_required");
        // 0214: لا يُنفَّذ حجز فرع بموظف مسؤول مسجّل على فرع آخر (موظف الشركة بلا فرع مقبول).
        if (!BookingExecutionRules.EmployeeBelongsToBranch(preview.EmployeeBranchId,
                preview.BranchId))
            throw new ValidationAppException(BookingExecutionRules.BranchMismatchCode);
        if (input.Quantity <= 0 || input.Quantity > preview.RemainingQty)
            throw new ValidationAppException("validation.booking_quantity_exceeds_remaining");

        if (preview.ItemIsMetered && !direct)
        {
            // الأصناف المرتبطة بعدّاد: اختيار الأصل وعدد وحدات أكبر من صفر إجباري، وإلا لا يُقبل التنفيذ.
            if (input.MeteredAssetId is null ||
                preview.MeterAssets.All(a => a.Id != input.MeteredAssetId))
                throw new ValidationAppException("validation.asset_meter_required");
            if (input.MeterUnits <= 0)
                throw new ValidationAppException("validation.meter_units_required");
        }
        else if (!preview.ItemIsMetered && (input.MeteredAssetId is not null || input.MeterUnits > 0))
        {
            throw new ValidationAppException("validation.item_not_metered");
        }

        var settings = await _settings.GetAsync(ct);
        input.UnitsColumnLabel = settings.MeterUnitLabel;

        // 0213: إعداد الفرع — تنفيذ خدمة محجوزة يشترط حجزاً مؤكداً لنفس العميل مع الموظف في نفس اليوم.
        // عند تعطيل الإعداد يبقى السلوك السابق كما هو (تنفيذ بدون هذا الشرط).
        var branch = await _branches.GetAsync(preview.BranchId, ct);
        if (branch is not null &&
            BookingExecutionRules.Applies(branch.RequireConfirmedBookingForExecution,
                preview.ItemType, preview.ExecutionMode))
        {
            var today = BookingExecutionRules.TodayIn(settings.TimeZone, DateTimeOffset.UtcNow);
            var hasConfirmed = await _executions.HasConfirmedBookingTodayAsync(
                preview.CustomerId, preview.AssignedEmployeeId, today, ct);
            if (!hasConfirmed)
                throw new ValidationAppException(BookingExecutionRules.Code);
        }

        try
        {
            var result = await _executions.ExecuteAsync(input, actor.UserId,
                settings.AllowNegativeStock, ct);
            await _audit.WriteAsync(actor, "booking_executions", result.ExecutionId.ToString(),
                "INSERT", null, result, ct);
            return result;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }
}
