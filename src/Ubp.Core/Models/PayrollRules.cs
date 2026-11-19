namespace Ubp.Core.Models;

public sealed class PayrollFormula
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string Expression { get; set; } = "";
    public int Version { get; set; }
}

public sealed class PayrollPolicy
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string ScopeType { get; set; } = "company";
    public Guid? ScopeId { get; set; }
    public int Priority { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string EffectType { get; set; } = "replace";
    public string? ValueExpression { get; set; }
    public bool IsApproved { get; set; }
    public int Version { get; set; }
}

public sealed class PayrollFormulaValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> EvaluationOrder { get; init; } = Array.Empty<string>();
}
