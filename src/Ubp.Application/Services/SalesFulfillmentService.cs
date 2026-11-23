using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>المواعيد: صلاحيات + تحقق + تدقيق.</summary>
public sealed class SalesFulfillmentService
{
    private readonly IAppointmentRepository _appointments;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;
    private readonly ISettingsService _settings;

    public SalesFulfillmentService(IAppointmentRepository appointments,
        PermissionService permissions, AuditService audit, ISettingsService settings)
    {
        _appointments = appointments; _permissions = permissions; _audit = audit;
        _settings = settings;
    }

    public async Task<IReadOnlyList<Appointment>> ListAppointmentsAsync(ActorContext actor,
        Guid? branchId, DateTime date, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.SalesAppointments, ActionCodes.View,
            ct: ct);
        // إلغاء الفلتر لا يعرض كل الفروع لغير السوبر أدمن — 0096.
        return await _appointments.ListDayAsync(BranchScope.Effective(actor, branchId), date, ct);
    }

    public async Task<Appointment> CreateAppointmentAsync(ActorContext actor,
        AppointmentInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.SalesAppointments, ActionCodes.Manage,
            ct: ct);
        BranchScope.Ensure(actor, input.BranchId);
        var id = Guid.CreateVersion7();
        await _appointments.CreateAsync(id, input, actor.UserId, ct);
        await _audit.WriteAsync(actor, "appointments", id.ToString(), "INSERT", null, input, ct);
        return await _appointments.GetAsync(id, ct) ?? throw new NotFoundAppException();
    }

    public async Task<Appointment> SetAppointmentStatusAsync(ActorContext actor, Guid id,
        int version, string status, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.SalesAppointments, ActionCodes.Manage,
            ct: ct);
        var appointment = await _appointments.SetStatusAsync(id, version, status, actor.UserId, ct);
        await _audit.WriteAsync(actor, "appointments", id.ToString(), "UPDATE", null,
            new { status }, ct);
        return appointment;
    }

    /// <summary>
    /// معاينة أثر تعديل الدوام: الحجوزات المؤكدة للموظف التي ستُعاد مسودة لأنها خارج
    /// الوقت الجديد — تُعرض في رسالة تنبيه قبل التأكيد.
    /// </summary>
    public async Task<IReadOnlyList<AppointmentImpactBooking>> GetAppointmentEditImpactAsync(
        ActorContext actor, Guid id, DateTimeOffset startsAt, DateTimeOffset endsAt,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.SalesAppointments, ActionCodes.Manage,
            ct: ct);
        var existing = await _appointments.GetAsync(id, ct) ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, existing.BranchId);
        return await _appointments.ListConfirmedBookingsOutsideAsync(id, startsAt, endsAt, ct);
    }

    /// <summary>
    /// تعديل دوام موظف: التاريخ الجديد لا يسبق تاريخ اليوم (بحسب إعدادات المنطقة الزمنية)،
    /// وعند اعتماد التعديل تُعاد الحجوزات المؤكدة الواقعة خارج الوقت الجديد إلى مسودات.
    /// </summary>
    public async Task<AppointmentUpdateResult> UpdateAppointmentAsync(ActorContext actor, Guid id,
        int version, AppointmentInput input, bool revertOutsideBookings,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.SalesAppointments, ActionCodes.Manage,
            ct: ct);
        var existing = await _appointments.GetAsync(id, ct) ?? throw new NotFoundAppException();
        BranchScope.Ensure(actor, existing.BranchId);

        var settings = await _settings.GetAsync(ct);
        var today = BookingExecutionRules.TodayIn(settings.TimeZone, DateTimeOffset.UtcNow);
        if (!AppointmentEditRules.IsDateAllowed(DateOnly.FromDateTime(input.StartsAt.DateTime),
                today))
            throw new ValidationAppException(AppointmentEditRules.DateInPastCode);

        var result = await _appointments.UpdateAsync(id, version, input, revertOutsideBookings,
            actor.UserId, ct);
        await _audit.WriteAsync(actor, "appointments", id.ToString(), "UPDATE",
            new { existing.StartsAt, existing.EndsAt, existing.Notes, existing.IsLeave },
            new { input.StartsAt, input.EndsAt, input.Notes, input.IsLeave,
                  result.RevertedBookings }, ct);
        return result;
    }
}
