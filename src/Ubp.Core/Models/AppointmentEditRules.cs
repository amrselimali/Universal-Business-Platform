namespace Ubp.Core.Models;

/// <summary>
/// قواعد تعديل دوام الموظف (شاشة مواعيد الموظفين): التاريخ الجديد لا يسبق اليوم،
/// وأي حجز مؤكد يقع خارج الوقت الجديد يعود مسودة عند التأكيد.
/// </summary>
public static class AppointmentEditRules
{
    /// <summary>تاريخ بداية الدوام الجديد في الماضي.</summary>
    public const string DateInPastCode = "validation.appointment_date_past";

    /// <summary>تاريخ بداية الدوام الجديد يجب أن يكون اليوم أو تاريخًا لاحقًا.</summary>
    public static bool IsDateAllowed(DateOnly newDate, DateOnly today) => newDate >= today;

    /// <summary>
    /// هل الحجز خارج وقت الدوام الجديد؟ (يبدأ قبل بدايته أو ينتهي بعد نهايته)
    /// الحجز الواقع بالكامل داخل الوقت الجديد لا يتأثر.
    /// </summary>
    public static bool IsOutside(DateTimeOffset bookingStarts, DateTimeOffset bookingEnds,
        DateTimeOffset newStarts, DateTimeOffset newEnds) =>
        bookingStarts < newStarts || bookingEnds > newEnds;

    /// <summary>هل يتقاطع الحجز مع فترة الدوام؟</summary>
    public static bool Overlaps(DateTimeOffset bookingStarts, DateTimeOffset bookingEnds,
        DateTimeOffset starts, DateTimeOffset ends) =>
        bookingStarts < ends && bookingEnds > starts;
}
