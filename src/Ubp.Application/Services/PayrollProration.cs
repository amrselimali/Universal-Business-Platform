namespace Ubp.Application.Services;

/// <summary>
/// احتساب الشهر الجزئي (بند 2 و4): التعيين داخل الشهر أو انتهاء الخدمة وسطه يخفضان الاستحقاق
/// بنسبة الأيام القابلة للاحتساب إلى أيام الفترة. الطريقة قابلة للتهيئة (تقويمية أو أيام عمل).
/// </summary>
public static class PayrollProration
{
    public const string CalendarDays = "calendar_days";
    public const string WorkingDays = "working_days";

    public sealed record ProrationResult(decimal Factor, int ApplicableDays, int PeriodDays,
        string Method, IReadOnlyList<string> Notes);

    private static readonly DayOfWeek[] DefaultWeekend = { DayOfWeek.Friday, DayOfWeek.Saturday };

    public static ProrationResult Calculate(DateOnly periodFrom, DateOnly periodTo, DateOnly? hireDate,
        DateOnly? serviceEndDate, string method = CalendarDays,
        IReadOnlyCollection<DayOfWeek>? weekend = null)
    {
        if (periodTo < periodFrom)
            throw new ArgumentException("Payroll period range is invalid.");
        var notes = new List<string>();
        var periodDays = Math.Max(1, periodTo.DayNumber - periodFrom.DayNumber + 1);

        var start = hireDate is { } hire && hire > periodFrom ? hire : periodFrom;
        var end = serviceEndDate is { } serviceEnd && serviceEnd < periodTo ? serviceEnd : periodTo;
        if (start > end)
        {
            notes.Add("PAYROLL_NO_APPLICABLE_DAYS");
            return new ProrationResult(0m, 0, periodDays, method, notes);
        }

        int applicable;
        if (string.Equals(method, WorkingDays, StringComparison.OrdinalIgnoreCase))
        {
            var offDays = (weekend ?? DefaultWeekend).ToHashSet();
            applicable = CountWorkingDays(start, end, offDays);
            periodDays = CountWorkingDays(periodFrom, periodTo, offDays);
        }
        else
        {
            applicable = end.DayNumber - start.DayNumber + 1;
        }

        if (applicable == periodDays)
            return new ProrationResult(1m, applicable, periodDays, method, notes);

        notes.Add("PAYROLL_PARTIAL_MONTH");
        var factor = periodDays <= 0 ? 0m : decimal.Round((decimal)applicable / periodDays, 6);
        return new ProrationResult(factor, applicable, Math.Max(periodDays, 0), method, notes);
    }

    private static int CountWorkingDays(DateOnly from, DateOnly to, IReadOnlySet<DayOfWeek> weekend)
    {
        var count = 0;
        for (var date = from; date <= to; date = date.AddDays(1))
            if (!weekend.Contains(date.DayOfWeek)) count++;
        return count;
    }
}
