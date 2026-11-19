namespace Ubp.Core.Models;

public static class PayrollRunStatuses
{
    public const string Draft = "draft";
    public const string Calculating = "calculating";
    public const string Calculated = "calculated";
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
    public DateOnly SalaryFrom { get; set; }
    public DateOnly SalaryTo { get; set; }
    public DateOnly VariablesFrom { get; set; }
    public DateOnly VariablesTo { get; set; }
    public DateOnly? ExpectedPaymentDate { get; set; }
    public int Version { get; set; }
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
