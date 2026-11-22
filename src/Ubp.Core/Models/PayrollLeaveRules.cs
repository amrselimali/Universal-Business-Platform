using Ubp.Core.Results;

namespace Ubp.Core.Models;

/// <summary>خطة استحقاق سنة إجازة: ما يُستحق + ما يُرحَّل من السابق + الإجمالي الافتتاحي.</summary>
public sealed class PayrollLeaveAccrualPlan
{
    public Guid EmployeeId { get; init; }
    public string LeaveTypeCode { get; init; } = "";
    public int Year { get; init; }
    public decimal AnnualEntitlement { get; init; }
    public int Months { get; init; }
    public decimal Accrued { get; init; }
    public decimal PreviousRemaining { get; init; }
    public decimal CarriedForward { get; init; }
    public decimal OpeningBalance => Accrued + CarriedForward;
    public bool CarryLimitApplied { get; init; }
    public bool CarryOverAllowed { get; init; }
}

/// <summary>
/// قواعد استحقاق الإجازات وحد الترحيل (دوال نقية، بلا قيود قانونية ثابتة):
/// الاستحقاق = السنوي × (أشهر الخدمة ÷ 12)، والترحيل = المتبقي بحد أقصى مُعرَّف أو صفر إذا مُنع.
/// </summary>
public static class PayrollLeaveRules
{
    public const int MaxMonths = 12;

    /// <summary>استحقاق متناسب مع أشهر الخدمة (0..12)، مقرّب لخانتين.</summary>
    public static decimal Accrue(decimal annualEntitlement, int months)
    {
        if (annualEntitlement < 0) throw new ArgumentOutOfRangeException(nameof(annualEntitlement));
        var effectiveMonths = Math.Clamp(months, 0, MaxMonths);
        if (annualEntitlement == 0 || effectiveMonths == 0) return 0m;
        return Round(annualEntitlement * effectiveMonths / MaxMonths);
    }

    /// <summary>
    /// حد الترحيل: صفر إذا منع الترحيل، وإلا min(المتبقي، الحد) — أو المتبقي كله إذا لا حد.
    /// </summary>
    public static decimal CarriedForward(decimal previousRemaining, bool carryOverAllowed, decimal? carryOverLimit)
    {
        if (!carryOverAllowed) return 0m;
        var remaining = previousRemaining <= 0 ? 0m : previousRemaining;
        if (carryOverLimit is not { } limit) return remaining;
        if (limit < 0) throw new ArgumentOutOfRangeException(nameof(carryOverLimit));
        return Math.Min(remaining, limit);
    }

    public static PayrollLeaveAccrualPlan PlanYear(Guid employeeId, string leaveTypeCode, int year,
        decimal annualEntitlement, int months, decimal previousRemaining,
        bool carryOverAllowed, decimal? carryOverLimit)
    {
        if (string.IsNullOrWhiteSpace(leaveTypeCode))
            throw new ValidationAppException("validation.leave_type_required");
        if (year is < 1900 or > 2999)
            throw new ValidationAppException("validation.leave_year_invalid");

        var accrued = Accrue(annualEntitlement, months);
        var carried = CarriedForward(previousRemaining, carryOverAllowed, carryOverLimit);
        return new PayrollLeaveAccrualPlan
        {
            EmployeeId = employeeId, LeaveTypeCode = leaveTypeCode.Trim(), Year = year,
            AnnualEntitlement = annualEntitlement, Months = Math.Clamp(months, 0, MaxMonths),
            Accrued = accrued, PreviousRemaining = previousRemaining < 0 ? 0m : previousRemaining,
            CarriedForward = carried, CarryOverAllowed = carryOverAllowed,
            CarryLimitApplied = carryOverAllowed && carried < (previousRemaining < 0 ? 0m : previousRemaining)
        };
    }

    /// <summary>مرجع الحركة: يمنع تكرار الاستحقاق لنفس السنة عند إعادة التشغيل.</summary>
    public static string AccrualReference(int year) => $"ACCRUAL-{year:D4}";

    private static decimal Round(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
