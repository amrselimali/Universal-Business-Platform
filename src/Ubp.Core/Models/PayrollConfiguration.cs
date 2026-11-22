namespace Ubp.Core.Models;

public sealed class PayrollItem
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public string CategoryCode { get; set; } = "earning";
    public bool IsVariable { get; set; }
    public bool AffectsNetSalary { get; set; } = true;
    public bool IsTaxable { get; set; }
    public bool IsInsurable { get; set; }
    public bool EmployerBorne { get; set; }
    public bool AllowNegative { get; set; }
    public int Version { get; set; }
}

public sealed class PayrollItemVersion
{
    public Guid Id { get; set; }
    public Guid PayrollItemId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string CalculationType { get; set; } = "manual";
    public string? FormulaCode { get; set; }
    public decimal? MinimumValue { get; set; }
    public decimal? MaximumValue { get; set; }
    public string RoundingMode { get; set; } = "none";
    public int Version { get; set; }
    public bool IsApproved { get; set; }
}

public sealed class PayrollDataSource
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string ProviderCode { get; set; } = "";
    public string AggregationCode { get; set; } = "sum";
    public bool IncludeCancelled { get; set; }
    public bool IsActive { get; set; } = true;
    public int Version { get; set; }
}

public sealed class PayrollSourceAllocation
{
    public Guid Id { get; set; }
    public Guid SourceSnapshotId { get; set; }
    public Guid EmployeeId { get; set; }
    public string AllocationMethod { get; set; } = "direct";
    public decimal SourceValue { get; set; }
    public decimal AllocatedValue { get; set; }
    public decimal? AllocationPercent { get; set; }
    public string? RuleVersion { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>مجموعة مرتبات (payroll_groups): تربط الموظفين بدورة وقواعد وعملة.</summary>
public sealed class PayrollGroup
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public bool IsActive { get; set; } = true;
    public int Version { get; set; }
}
