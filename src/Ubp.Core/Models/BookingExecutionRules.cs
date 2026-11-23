namespace Ubp.Core.Models;

/// <summary>
/// قاعدة فرع 0213: هل تنفيذ الخدمة المحجوزة يشترط وجود حجز مؤكد للعميل مع الموظف في نفس اليوم؟
/// لا تُطبَّق إلا على أصناف الخدمات المسجّلة بطريقة "محجوز" (وليست المباشرة).
/// </summary>
public static class BookingExecutionRules
{
    public const string Code = "validation.execution_confirmed_booking_required";
    /// <summary>محاولة تنفيذ خدمة بموظف مسؤول من فرع آخر — 0214.</summary>
    public const string BranchMismatchCode = "validation.execution_employee_branch_mismatch";

    /// <summary>الحالات التي تُعدّ "حجزاً مؤكداً" صالحاً للتنفيذ.</summary>
    public static readonly IReadOnlySet<string> ConfirmedStatuses =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "confirmed", "partially_delivered" };

    /// <summary>هل يجب فحص وجود حجز مؤكد لهذا العنصر؟</summary>
    public static bool Applies(bool branchRequires, string? itemType, string? executionMode) =>
        branchRequires
        && !ItemExecutionModes.IsDirect(executionMode)
        && string.Equals(itemType, "SERVICE", StringComparison.OrdinalIgnoreCase);

    /// <summary>هل تاريخ الحجز (أو الموعد) هو اليوم المحدد؟</summary>
    public static bool IsSameDay(DateOnly? bookingDate, DateOnly today) =>
        bookingDate is not null && bookingDate.Value == today;

    /// <summary>هل الحجز نفسه مؤكد وصالح للتنفيذ في هذا اليوم؟</summary>
    public static bool IsConfirmedForDay(string? status, DateOnly? bookingDate, DateOnly today) =>
        ConfirmedStatuses.Contains(status ?? "") && IsSameDay(bookingDate, today);

    /// <summary>
    /// هل الموظف المسؤول يصلح للتنفيذ في هذا الفرع؟
    /// NULL = موظف على مستوى الشركة (0091) ⇒ مسموح؛ وإلا يجب أن يكون فرعه هو فرع التنفيذ.
    /// </summary>
    public static bool EmployeeBelongsToBranch(Guid? employeeBranchId, Guid branchId) =>
        employeeBranchId is null || employeeBranchId.Value == branchId;

    /// <summary>تاريخ "اليوم" بحسب المنطقة الزمنية المُعرَّفة في إعدادات التطبيق (UTC عند الفشل).</summary>
    public static DateOnly TodayIn(string? timeZone, DateTimeOffset utcNow)
    {
        var zone = TimeZoneInfo.Utc;
        if (!string.IsNullOrWhiteSpace(timeZone))
        {
            try { zone = TimeZoneInfo.FindSystemTimeZoneById(timeZone.Trim()); }
            catch (TimeZoneNotFoundException) { zone = TimeZoneInfo.Utc; }
            catch (InvalidTimeZoneException) { zone = TimeZoneInfo.Utc; }
        }
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(utcNow, zone).DateTime);
    }
}
