namespace Ubp.Core.Models;

public static class PayrollEmployeeStatuses
{
    public const string Draft = "draft";
    public const string Incomplete = "incomplete";
    public const string Approved = "approved";
    public const string Suspended = "suspended";
    public const string Terminated = "terminated";
}

public sealed class PayrollEmployeeProfile
{
    public Guid EmployeeId { get; set; }
    public string Status { get; set; } = PayrollEmployeeStatuses.Draft;
    public string? NationalId { get; set; }
    public string? PassportNumber { get; set; }
    public string? InsuranceNumber { get; set; }
    public string? TaxTreatmentCode { get; set; }
    public string? InsuranceStatusCode { get; set; }
    public string? NationalityCode { get; set; }
    public string? WorkPermitStatus { get; set; }
    public DateOnly? ServiceEndDate { get; set; }
    public int? WorkingHoursPerMonth { get; set; }
    public bool TimeManagementEnabled { get; set; }
    public bool SalarySuspended { get; set; }
    public int NonWorkingWives { get; set; }
    public int Dependents { get; set; }
    public int Version { get; set; }
}

public sealed class PayrollEmployeeProfileInput
{
    public string Status { get; set; } = PayrollEmployeeStatuses.Draft;
    public string? NationalId { get; set; }
    public string? PassportNumber { get; set; }
    public string? InsuranceNumber { get; set; }
    public string? TaxTreatmentCode { get; set; }
    public string? InsuranceStatusCode { get; set; }
    public string? NationalityCode { get; set; }
    public string? WorkPermitStatus { get; set; }
    public DateOnly? ServiceEndDate { get; set; }
    public int? WorkingHoursPerMonth { get; set; }
    public bool TimeManagementEnabled { get; set; }
    public bool SalarySuspended { get; set; }
    public int NonWorkingWives { get; set; }
    public int Dependents { get; set; }
}

public sealed class PayrollEmployeeFieldSetting
{
    public Guid Id { get; set; }
    public Guid? CompanyId { get; set; }
    public string FieldCode { get; set; } = "";
    public bool IsVisible { get; set; } = true;
    public bool IsRequired { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public int Version { get; set; }
}

public sealed class PayrollEmployeeContract
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string CurrencyCode { get; set; } = "";
    public decimal GrossSalary { get; set; }
    public decimal? InsurableSalary { get; set; }
    public bool IsApproved { get; set; }
    public int Version { get; set; }
}

public sealed class PayrollCostCenterAllocation
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid CostCenterId { get; set; }
    public decimal AllocationPercent { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

public sealed class PayrollPaymentSetting
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string PaymentMethodCode { get; set; } = "";
    public decimal? Amount { get; set; }
    public decimal? Percentage { get; set; }
    public string? AccountReference { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}
