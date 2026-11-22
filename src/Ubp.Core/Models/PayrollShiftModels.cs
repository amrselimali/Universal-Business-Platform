namespace Ubp.Core.Models;

/// <summary>تعريف وردية عمل (attendance_shifts): أوقات، سماح، راحة، وبداية الإضافي.</summary>
public sealed class AttendanceShift
{
    public Guid Id { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid? BranchId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string StartTime { get; set; } = "09:00";
    public string EndTime { get; set; } = "17:00";
    public bool CrossesMidnight { get; set; }
    public int BreakMinutes { get; set; }
    public int GraceMinutes { get; set; }
    public int OvertimeAfterMinutes { get; set; }
    public bool IsActive { get; set; } = true;
    public int Version { get; set; }

    /// <summary>دقائق الوردية المجدولة (ناقص الراحة) مع دعم الوردية الليلية.</summary>
    public int ScheduledMinutes
    {
        get
        {
            if (!TimeOnly.TryParse(StartTime, out var start) || !TimeOnly.TryParse(EndTime, out var end))
                return 0;
            var startMinutes = start.Hour * 60 + start.Minute;
            var endMinutes = end.Hour * 60 + end.Minute;
            var minutes = endMinutes - startMinutes;
            if (minutes <= 0) minutes += 24 * 60;
            return Math.Max(0, minutes - Math.Max(0, BreakMinutes));
        }
    }
}

/// <summary>إسناد وردية لموظف بفترة سريان.</summary>
public sealed class AttendanceShiftAssignment
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid ShiftId { get; set; }
    public string? ShiftCode { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

/// <summary>نتيجة تطبيق قاعدة الوردية على يوم حضور واحد.</summary>
public sealed class ShiftDayEvaluation
{
    public Guid EmployeeId { get; init; }
    public DateOnly WorkDate { get; init; }
    public Guid? ShiftId { get; init; }
    public string? ShiftCode { get; init; }
    public int ScheduledMinutes { get; init; }
    public int WorkedMinutes { get; init; }
    public decimal AbsenceHours { get; init; }
    public decimal OvertimeHours { get; init; }
    public IReadOnlyList<string> Notes { get; init; } = Array.Empty<string>();
}
