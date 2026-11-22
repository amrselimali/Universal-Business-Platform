namespace Ubp.Core.Models;

/// <summary>إعداد نطاق التراكم الضريبي لكل سنة ضريبية (COMPANY أو BRANCH) + سياسة نقل الرصيد بين الفروع.</summary>
public sealed class PayrollTaxSettings
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string TaxYearCode { get; set; } = "";
    public string ScopeType { get; set; } = PayrollTaxScopes.Company;
    public string BranchCarryPolicy { get; set; } = PayrollTaxBranchCarryPolicies.CarryForward;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "draft";
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public int Version { get; set; }
}

public static class PayrollTaxBranchCarryPolicies
{
    /// <summary>الفرع الجديد يبدأ من صفر.</summary>
    public const string Reset = "RESET";
    /// <summary>ينقل الرصيد السابق معه كرصيد افتتاحي.</summary>
    public const string CarryForward = "CARRY_FORWARD";
}

/// <summary>قاعدة تحمّل الشركة لبند: كلياً / نسبة / مبلغ مقطوع، بحد أقصى (بند 10.3).</summary>
public sealed class PayrollGrossUpItemRule
{
    public Guid Id { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid PayrollItemId { get; set; }
    public string ShoulderType { get; set; } = PayrollGrossUpShoulders.Full;
    public decimal? ShoulderValue { get; set; }
    public decimal? MaxAmount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public int Version { get; set; }
}

public static class PayrollGrossUpShoulders
{
    public const string Full = "FULL";
    public const string Percent = "PERCENT";
    public const string Amount = "AMOUNT";
}

/// <summary>إسناد فرع مؤرخ للموظف (employee_assignments) — أساس توزيع التكلفة على الفروع.</summary>
public sealed class EmployeeBranchAssignment
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid BranchId { get; set; }
    public string? BranchName { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

/// <summary>توزيع تكلفة موظف على فرع داخل الدورة (payroll_branch_cost_allocations).</summary>
public sealed class PayrollBranchCostAllocation
{
    public Guid RunId { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid BranchId { get; set; }
    public decimal WorkDays { get; set; }
    public string AllocationBasis { get; set; } = "work_days";
    public decimal AllocationRatio { get; set; }
    public decimal GrossCost { get; set; }
    public decimal EmployerContribution { get; set; }
    public decimal TotalCost { get; set; }
}

/// <summary>توزيع جزء فرع على مراكز تكلفة داخل الفرع بنسب مجموعها 100%.</summary>
public sealed class PayrollCostCenterSplit
{
    public Guid BranchId { get; set; }
    public Guid CostCenterId { get; set; }
    public decimal AllocationRatio { get; set; }
    public decimal AllocatedAmount { get; set; }
}

/// <summary>رصيد إجازة (leave_balances) مع حد الترحيل.</summary>
public sealed class PayrollLeaveBalance
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string LeaveTypeCode { get; set; } = "";
    public DateOnly BalanceDate { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal UsedBalance { get; set; }
    public decimal RemainingBalance { get; set; }
    public bool CarryOverAllowed { get; set; }
    public decimal? CarryOverLimit { get; set; }
    public int Version { get; set; }
}

public sealed class PayrollLeaveTransaction
{
    public Guid Id { get; set; }
    public Guid BalanceId { get; set; }
    public DateOnly TransactionDate { get; set; }
    public string TransactionType { get; set; } = "USED";
    public decimal Quantity { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Notes { get; set; }
}
