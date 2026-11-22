namespace Ubp.Core.Models;

/// <summary>سياسة ضريبة الدخل كما هي مخزنة في payroll_tax_policies (بلا تغيير في المخطط).</summary>
public sealed class PayrollTaxPolicy
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool Cumulative { get; set; } = true;
    public bool IsApproved { get; set; }
    public int Version { get; set; }
    public IReadOnlyList<PayrollTaxBracket> Brackets { get; set; } = Array.Empty<PayrollTaxBracket>();
}

public sealed class PayrollTaxBracket
{
    public Guid Id { get; set; }
    public Guid PolicyId { get; set; }
    public decimal UpperLimit { get; set; }
    public decimal Rate { get; set; }
    public int BracketOrder { get; set; }
}

/// <summary>إعفاء ضريبي (payroll_tax_exemptions): مبلغ أو نسبة أو إعفاء كامل بشرط اختياري.</summary>
public sealed class PayrollTaxExemption
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    /// <summary>amount | percentage | full</summary>
    public string ExemptionType { get; set; } = "amount";
    public decimal? Amount { get; set; }
    public decimal? Percentage { get; set; }
    public string? ConditionExpression { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>الرصيد التراكمي للضريبة (payroll_tax_balances) — مفتاحه المنطقي الموظف + الفترة الضريبية + النطاق.</summary>
public sealed class PayrollTaxBalance
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid TaxPeriodId { get; set; }
    public Guid EmployeeId { get; set; }
    public string ScopeType { get; set; } = PayrollTaxScopes.Company;
    public Guid? BranchId { get; set; }
    public decimal TaxableIncomeYtd { get; set; }
    public decimal TaxDueYtd { get; set; }
    public decimal TaxWithheldYtd { get; set; }
    public decimal CreditBalance { get; set; }
    public Guid? LastRunId { get; set; }
    public int RowVersion { get; set; }
}

public static class PayrollTaxScopes
{
    public const string Company = "COMPANY";
    public const string Branch = "BRANCH";

    public static bool IsValid(string? value) =>
        string.Equals(value, Company, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, Branch, StringComparison.OrdinalIgnoreCase);
}

/// <summary>سياسة التأمينات الاجتماعية (payroll_insurance_policies) — لكل فرع كود مستقل عند الحاجة.</summary>
public sealed class PayrollInsurancePolicy
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public decimal? MinimumBasis { get; set; }
    public decimal? MaximumBasis { get; set; }
    public decimal EmployeeRate { get; set; }
    public decimal EmployerRate { get; set; }
    public bool IsApproved { get; set; }
    public int Version { get; set; }
}

/// <summary>قاعدة التأمين الصحي الشامل: الوعاء معادلة نصية تُقيَّم بمقيّم المعادلات الآمن.</summary>
public sealed class PayrollHealthInsuranceRule
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string BasisExpression { get; set; } = "GROSS";
    public decimal EmployeeRate { get; set; }
    public decimal EmployerRate { get; set; }
    public bool IsApproved { get; set; }
}

public sealed class PayrollGrossUpPolicy
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string SolverCode { get; set; } = "bisection";
    public decimal Tolerance { get; set; } = 0.0001m;
    public int MaxIterations { get; set; } = 100;
    public bool IsApproved { get; set; }
}

/// <summary>ناتج محرك الضريبة التراكمي مع تفصيل الإعفاءات والرصيد المرحّل.</summary>
public sealed class PayrollTaxComputation
{
    public decimal TaxableIncome { get; init; }
    public decimal ExemptAmount { get; init; }
    public decimal CumulativeDue { get; init; }
    public decimal PreviouslyWithheld { get; init; }
    public decimal CurrentDue { get; init; }
    public decimal CreditBalance { get; init; }
    public IReadOnlyList<string> AppliedExemptions { get; init; } = Array.Empty<string>();
}

/// <summary>حل Net-to-Gross: يعيد الإجمالي المطلوب لتحقيق صافٍ مستهدف مع سبب الفشل إن وجد.</summary>
public sealed class NetToGrossSolution
{
    public bool Converged { get; init; }
    public decimal Gross { get; init; }
    public decimal AchievedNet { get; init; }
    public decimal Difference { get; init; }
    public int Iterations { get; init; }
    public string? Reason { get; init; }
}

public static class PayrollLineKinds
{
    public const string Earning = "earning";
    public const string Deduction = "deduction";
    public const string Employer = "employer";
    public const string Tax = "tax";
    public const string Insurance = "insurance";
    public const string HealthInsurance = "health_insurance";
    public const string Informational = "info";
}

/// <summary>سطر واحد في نتيجة الحساب مع تفسير المصدر (المصدر/المعادلة/الإصدار).</summary>
public sealed class PayrollCalculationLine
{
    public string Code { get; init; } = "";
    public string NameAr { get; init; } = "";
    public string Kind { get; init; } = PayrollLineKinds.Earning;
    public decimal Amount { get; init; }
    public decimal TaxableAmount { get; init; }
    public decimal InsurableAmount { get; init; }
    public decimal CostAmount { get; init; }
    public string? FormulaCode { get; init; }
    public string? SourceKey { get; init; }
    public string? Explanation { get; init; }
}

/// <summary>مدخلات حساب موظف واحد (تُستخدم في التشغيل وفي المحاكاة دون أي كتابة).</summary>
public sealed class PayrollEmployeeCalculationInput
{
    public Guid EmployeeId { get; init; }
    public string EmployeeName { get; init; } = "";
    public Guid? BranchId { get; init; }
    public string CurrencyCode { get; init; } = "EGP";
    public DateOnly PeriodFrom { get; init; }
    public DateOnly PeriodTo { get; init; }
    public DateOnly AsOfDate { get; init; }
    public string CalculationVersion { get; init; } = "";

    public decimal ContractGross { get; init; }
    public decimal? ContractInsurable { get; init; }
    public bool SalarySuspended { get; init; }
    public string? TaxTreatmentCode { get; init; }
    public string? InsuranceStatusCode { get; init; }
    public string? NationalityCode { get; init; }
    public int NonWorkingWives { get; init; }
    public int Dependents { get; init; }
    public bool HealthInsuranceApplicable { get; init; }

    public IReadOnlyCollection<PayrollItem> Items { get; init; } = Array.Empty<PayrollItem>();
    public IReadOnlyCollection<PayrollItemVersion> Versions { get; init; } = Array.Empty<PayrollItemVersion>();
    public IReadOnlyCollection<PayrollFormula> Formulas { get; init; } = Array.Empty<PayrollFormula>();
    public IReadOnlyDictionary<string, decimal> Inputs { get; init; } = new Dictionary<string, decimal>();

    public PayrollTaxPolicy? TaxPolicy { get; init; }
    public IReadOnlyCollection<PayrollTaxExemption> TaxExemptions { get; init; } = Array.Empty<PayrollTaxExemption>();
    public decimal TaxableIncomeYtd { get; init; }
    public decimal TaxWithheldYtd { get; init; }
    public decimal TaxCreditBalance { get; init; }

    public PayrollInsurancePolicy? InsurancePolicy { get; init; }
    public PayrollHealthInsuranceRule? HealthRule { get; init; }
    public decimal EmployerBorneAmount { get; init; }
    /// <summary>قواعد تحمّل الشركة لكل بند (Gross-up) — مفتاحها معرف بند المرتب.</summary>
    public IReadOnlyDictionary<Guid, PayrollGrossUpItemRule>? GrossUpRules { get; init; }
}

/// <summary>نتيجة حساب موظف واحد قابلة للتفسير سطراً بسطر.</summary>
public sealed class PayrollCalculationBreakdown
{
    public Guid EmployeeId { get; init; }
    public string CurrencyCode { get; init; } = "";
    public decimal GrossAmount { get; init; }
    public decimal DeductionsAmount { get; init; }
    public decimal NetAmount { get; init; }
    public decimal EmployerCost { get; init; }

    public decimal TaxableIncome { get; init; }
    public decimal TaxExemptAmount { get; init; }
    public decimal TaxableIncomeYtd { get; init; }
    public decimal TaxCumulativeDue { get; init; }
    public decimal TaxPreviouslyWithheld { get; init; }
    public decimal TaxCurrent { get; init; }
    public decimal TaxCreditBalance { get; init; }

    public decimal InsurableBase { get; init; }
    public decimal HealthInsuranceBasis { get; init; }
    public decimal EmployeeInsurance { get; init; }
    public decimal EmployerInsurance { get; init; }
    public decimal EmployeeHealthInsurance { get; init; }
    public decimal EmployerHealthInsurance { get; init; }

    public string? TaxPolicyCode { get; init; }
    public string? InsurancePolicyCode { get; init; }
    public string? HealthRuleCode { get; init; }
    public IReadOnlyList<PayrollCalculationLine> Lines { get; init; } = Array.Empty<PayrollCalculationLine>();
    public IReadOnlyList<string> Notes { get; init; } = Array.Empty<string>();
}
