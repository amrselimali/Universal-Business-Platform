using Ubp.Core.Results;

namespace Ubp.Core.Models;

/// <summary>أنواع دورات المرتبات (بند 12.3): الدورة العادية ودورة التسوية المستقلة.</summary>
public static class PayrollRunTypes
{
    public const string Regular = "REGULAR";
    public const string Adjustment = "ADJUSTMENT";

    public static bool IsValid(string? value) =>
        value is Regular or Adjustment;

    public static bool IsAdjustment(string? value) =>
        string.Equals(value, Adjustment, StringComparison.OrdinalIgnoreCase);

    public static string Normalize(string? value) =>
        IsAdjustment(value) ? Adjustment : Regular;
}

/// <summary>سطر تسوية محسوب (بلا أي تعديل على بيانات المصدر).</summary>
public sealed class PayrollAdjustmentLine
{
    public Guid AdjustmentId { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid? PayrollItemId { get; set; }
    public decimal Amount { get; set; }
    public bool IsTaxable { get; set; }
    public bool IsInsurable { get; set; }
    public DateOnly EffectiveDate { get; set; }
}

/// <summary>نتيجة دورة التسوية لموظف واحد: إضافات/استقطاعات وصافي، بلا راتب أساسي.</summary>
public sealed class PayrollAdjustmentResult
{
    public decimal GrossAmount { get; set; }
    public decimal DeductionsAmount { get; set; }
    public decimal NetAmount { get; set; }
    public IReadOnlyList<PayrollAdjustmentLine> Lines { get; set; } = Array.Empty<PayrollAdjustmentLine>();

    public bool HasAmounts => Lines.Count > 0 && (GrossAmount != 0 || DeductionsAmount != 0);

    /// <summary>هل يمكن صرف التسوية؟ صافي سالب يعني استرداد من الموظف، وليس صرفاً.</summary>
    public bool IsPayable => NetAmount > 0;
}

/// <summary>
/// محرك دورة التسوية: يجمع الإضافات والاستقطاعات فقط، بلا راتب أساسي وبلا ضرائب/تأمينات جديدة،
/// لأن آثارها القانونية عولجت في الدورة الأصلية أو تُعالج بتسوية قانونية منفصلة.
/// </summary>
public static class PayrollAdjustmentEngine
{
    public static PayrollAdjustmentResult Calculate(IReadOnlyList<PayrollAdjustment> adjustments)
    {
        var lines = adjustments
            .Where(x => x.Amount != 0)
            .Select(x => new PayrollAdjustmentLine
            {
                AdjustmentId = x.Id, EmployeeId = x.EmployeeId, PayrollItemId = x.PayrollItemId,
                Amount = x.Amount, IsTaxable = x.IsTaxable, IsInsurable = x.IsInsurable,
                EffectiveDate = x.EffectiveDate
            })
            .ToList();

        var gross = decimal.Round(lines.Where(x => x.Amount > 0).Sum(x => x.Amount), 2);
        var deductions = decimal.Round(lines.Where(x => x.Amount < 0).Sum(x => -x.Amount), 2);
        return new PayrollAdjustmentResult
        {
            GrossAmount = gross,
            DeductionsAmount = deductions,
            NetAmount = decimal.Round(gross - deductions, 2),
            Lines = lines
        };
    }

    /// <summary>تحقق قبل إنشاء دورة التسوية: لا دورات تسوية بلا حركات.</summary>
    public static void EnsureHasLines(PayrollAdjustmentResult result)
    {
        if (!result.HasAmounts)
            throw new ValidationAppException("validation.payroll_adjustment_run_empty");
    }
}
