using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// الورديات: تعريف الوردية وإسنادها وتطبيق قواعدها على اليوميات (بند 11.2).
/// الوردية الليلية الممتدة بين يومين تُحسب ليوم واحد عبر دقائق مجدولة تتجاوز 24 ساعة عند الحاجة.
/// </summary>
public sealed class PayrollShiftService
{
    private readonly IPayrollShiftRepository _shifts;
    private readonly IPayrollOperationsRepository _operations;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollShiftService(IPayrollShiftRepository shifts, IPayrollOperationsRepository operations,
        PermissionService permissions, PayrollAuditWriter audit)
    {
        _shifts = shifts;
        _operations = operations;
        _permissions = permissions;
        _audit = audit;
    }

    public Task<IReadOnlyList<AttendanceShift>> ListAsync(CancellationToken ct = default) =>
        _shifts.ListAsync(ct);

    public Task<IReadOnlyList<AttendanceShiftAssignment>> ListAssignmentsAsync(Guid? employeeId,
        CancellationToken ct = default) => _shifts.ListAssignmentsAsync(employeeId, ct);

    public async Task<Guid> UpsertAsync(AttendanceShift shift, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        var id = await _shifts.UpsertAsync(shift, ct);
        await _audit.WriteAsync(actor, "attendance_shifts", id.ToString(), "UPDATE", null,
            new { shift.Code, shift.StartTime, shift.EndTime, shift.CrossesMidnight }, ct);
        return id;
    }

    public async Task<Guid> AssignAsync(AttendanceShiftAssignment assignment, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        var id = await _shifts.AssignAsync(assignment, ct);
        await _audit.WriteAsync(actor, "attendance_shift_assignments", id.ToString(), "UPDATE", null,
            new { assignment.EmployeeId, assignment.ShiftId, assignment.EffectiveFrom }, ct);
        return id;
    }

    /// <summary>قاعدة الوردية: الغياب نقص عن المجدول بعد السماح، والإضافي زيادة بعد بداية الإضافي.</summary>
    public static (decimal AbsenceHours, decimal OvertimeHours) Compute(int scheduledMinutes,
        int workedMinutes, int graceMinutes, int overtimeAfterMinutes)
    {
        if (scheduledMinutes <= 0) return (0m, 0m);
        var worked = Math.Max(0, workedMinutes);
        var shortage = Math.Max(0, scheduledMinutes - Math.Max(0, graceMinutes) - worked);
        var overtime = Math.Max(0, worked - scheduledMinutes - Math.Max(0, overtimeAfterMinutes));
        return (decimal.Round(shortage / 60m, 2), decimal.Round(overtime / 60m, 2));
    }

    private async Task EnsureAsync(ActorContext actor, string action, CancellationToken ct)
    {
        if (await _permissions.HasAsync(actor, ScreenCodes.PayrollAttendance, action, ct)) return;
        throw new ForbiddenException();
    }

    public async Task<IReadOnlyList<ShiftDayEvaluation>> EvaluateAsync(Guid employeeId, DateOnly from,
        DateOnly to, CancellationToken ct = default)
    {
        var attendance = await _operations.ListAttendanceAsync(from, to, employeeId, ct);
        var shifts = (await _shifts.ListAsync(ct)).ToDictionary(x => x.Id);
        var results = new List<ShiftDayEvaluation>();

        foreach (var day in attendance)
        {
            var assignment = await _shifts.GetAssignmentAsync(employeeId, day.WorkDate, ct);
            if (assignment is null || !shifts.TryGetValue(assignment.ShiftId, out var shift))
            {
                results.Add(new ShiftDayEvaluation
                {
                    EmployeeId = employeeId, WorkDate = day.WorkDate,
                    WorkedMinutes = (int)decimal.Round(day.WorkedHours * 60),
                    Notes = new[] { "PAYROLL_SHIFT_NOT_ASSIGNED" }
                });
                continue;
            }

            var workedMinutes = (int)decimal.Round(day.WorkedHours * 60);
            var (absenceHours, overtimeHours) = Compute(shift.ScheduledMinutes, workedMinutes,
                shift.GraceMinutes, shift.OvertimeAfterMinutes);
            results.Add(new ShiftDayEvaluation
            {
                EmployeeId = employeeId, WorkDate = day.WorkDate, ShiftId = shift.Id,
                ShiftCode = shift.Code, ScheduledMinutes = shift.ScheduledMinutes,
                WorkedMinutes = workedMinutes, AbsenceHours = absenceHours,
                OvertimeHours = overtimeHours
            });
        }
        return results;
    }

    /// <summary>يطبّق نتيجة الوردية على يوميات الحضور (غياب/إضافي) مع الحفاظ على الساعات المسجلة.</summary>
    public async Task<int> ApplyAsync(Guid employeeId, DateOnly from, DateOnly to, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        var attendance = await _operations.ListAttendanceAsync(from, to, employeeId, ct);
        var evaluations = await EvaluateAsync(employeeId, from, to, ct);
        var applied = 0;

        foreach (var evaluation in evaluations.Where(x => x.ShiftId is not null))
        {
            var day = attendance.FirstOrDefault(x => x.WorkDate == evaluation.WorkDate);
            if (day is null) continue;
            await _operations.UpsertAttendanceAsync(new PayrollAttendanceDaily
            {
                Id = day.Id, EmployeeId = employeeId, WorkDate = evaluation.WorkDate,
                WorkedHours = day.WorkedHours, OvertimeHours = evaluation.OvertimeHours,
                AbsenceHours = evaluation.AbsenceHours, Status = "processed"
            }, ct);
            applied++;
        }

        if (applied > 0)
            await _audit.WriteAsync(actor, "attendance_daily", employeeId.ToString(), "UPDATE", null,
                new { from, to, applied }, ct);
        return applied;
    }
}
