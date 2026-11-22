namespace Ubp.Core.Models;

public static class PayrollRunStatuses
{
    public const string Draft = "draft";
    public const string Calculating = "calculating";
    public const string Calculated = "calculated";
    /// <summary>توجد أخطاء/استثناءات مانعة تتطلب معالجة قبل المراجعة.</summary>
    public const string NeedsCorrection = "needs_correction";
    public const string UnderReview = "under_review";
    public const string Approved = "approved";
    public const string Posted = "posted";
    public const string PartiallyPaid = "partially_paid";
    public const string Paid = "paid";
    public const string Closed = "closed";
    public const string Cancelled = "cancelled";
}

public sealed class PayrollRun
{
    public Guid Id { get; set; }
    public string Status { get; set; } = PayrollRunStatuses.Draft;
    /// <summary>نوع الدورة: REGULAR أو ADJUSTMENT (بند 12.3).</summary>
    public string RunType { get; set; } = PayrollRunTypes.Regular;
    /// <summary>الدورة الأصلية عند إنشاء دورة تسوية تصحيحية.</summary>
    public Guid? SourceRunId { get; set; }
    public DateOnly SalaryFrom { get; set; }
    public DateOnly SalaryTo { get; set; }
    public DateOnly VariablesFrom { get; set; }
    public DateOnly VariablesTo { get; set; }
    public DateOnly? ExpectedPaymentDate { get; set; }
    /// <summary>لحظة قطع بيانات المصادر (Data Cutoff) — لا تُقرأ أي حركة بعدها في هذه الدورة.</summary>
    public DateTime? CutoffAt { get; set; }
    /// <summary>منشئ الدورة — أساس فصل المهام عند الاعتماد.</summary>
    public Guid? CreatedBy { get; set; }
    public int Version { get; set; }
}

public static class PayrollIssueSeverities
{
    /// <summary>يمنع الاعتماد والترحيل.</summary>
    public const string Critical = "critical";
    /// <summary>يمنع إكمال حساب الموظف/الدورة.</summary>
    public const string Blocking = "blocking";
    /// <summary>يتطلب مراجعة أو تجاوزاً بصلاحية وسبب.</summary>
    public const string Warning = "warning";
    /// <summary>لا يمنع.</summary>
    public const string Info = "info";
}

public sealed class PayrollRunIssue
{
    public Guid Id { get; set; }
    public Guid PayrollRunId { get; set; }
    public string Severity { get; set; } = "warning";
    public string Code { get; set; } = "";
    public string Message { get; set; } = "";
    public bool IsOverridden { get; set; }
    public string? OverrideReason { get; set; }
}

public sealed class PayrollResult
{
    public Guid Id { get; set; }
    public Guid PayrollRunId { get; set; }
    public Guid EmployeeId { get; set; }
    public string CurrencyCode { get; set; } = "";
    public decimal GrossAmount { get; set; }
    public decimal DeductionsAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string CalculationVersion { get; set; } = "";
}

public sealed class PayrollResultDetail
{
    public Guid Id { get; set; }
    public Guid PayrollResultId { get; set; }
    public string ItemCode { get; set; } = "";
    public decimal Amount { get; set; }
    public string? FormulaReference { get; set; }
}

public static class PayrollRunEmployeeStatuses
{
    public const string Pending = "pending";
    public const string Calculating = "calculating";
    public const string Calculated = "calculated";
    public const string Failed = "failed";
    public const string Skipped = "skipped";
}

/// <summary>
/// سجل تنفيذ الموظف داخل الدورة (payroll_run_employees) — بلا أي مبالغ:
/// المبالغ في payroll_results، وهذا السجل للحالة والمحاولات والاستئناف فقط.
/// </summary>
public sealed class PayrollRunEmployeeState
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public Guid EmployeeId { get; set; }
    public int RunSegment { get; set; } = 1;
    public Guid? BranchId { get; set; }
    public string CalculationStatus { get; set; } = PayrollRunEmployeeStatuses.Pending;
    public int Attempts { get; set; }
    public string? ErrorCode { get; set; }
    public string? EngineVersion { get; set; }
    public decimal? WorkDays { get; set; }
    public DateTime? CalculatedAt { get; set; }
}

public sealed class PayrollRunEmployeeStats
{
    public int Total { get; set; }
    public int Pending { get; set; }
    public int Calculating { get; set; }
    public int Calculated { get; set; }
    public int Failed { get; set; }
    public int Skipped { get; set; }
}
