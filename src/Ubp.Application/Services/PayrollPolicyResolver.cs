using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed class PayrollPolicyResolutionContext
{
    public Guid? CompanyId { get; init; }
    public Guid? BranchId { get; init; }
    public Guid? DepartmentId { get; init; }
    public Guid? JobId { get; init; }
    public Guid? PayrollGroupId { get; init; }
    public Guid EmployeeId { get; init; }
}

public sealed class PayrollPolicyResolver
{
    private static readonly string[] DefaultPriority =
    {
        "employee", "payroll_group", "job", "department", "branch", "company", "default"
    };

    public PayrollPolicy? Resolve(string code, DateOnly date, PayrollPolicyResolutionContext context,
        IReadOnlyCollection<PayrollPolicy> policies, IReadOnlyList<string>? priority = null)
    {
        var order = priority is null || priority.Count == 0 ? DefaultPriority : priority;
        return policies.Where(x => string.Equals(x.Code, code, StringComparison.OrdinalIgnoreCase))
            .Where(x => x.IsApproved && x.EffectiveFrom <= date && (x.EffectiveTo is null || x.EffectiveTo >= date))
            .Where(x => MatchesScope(x, context))
            .OrderBy(x => PriorityOf(x.ScopeType, order))
            .ThenByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.Version)
            .FirstOrDefault();
    }

    private static int PriorityOf(string scope, IReadOnlyList<string> order)
    {
        var index = -1;
        for (var i = 0; i < order.Count; i++)
            if (string.Equals(order[i], scope, StringComparison.OrdinalIgnoreCase)) { index = i; break; }
        return index < 0 ? int.MaxValue : index;
    }

    private static bool MatchesScope(PayrollPolicy policy, PayrollPolicyResolutionContext context) =>
        policy.ScopeType.ToLowerInvariant() switch
        {
            "employee" => policy.ScopeId == context.EmployeeId,
            "payroll_group" => policy.ScopeId == context.PayrollGroupId,
            "job" => policy.ScopeId == context.JobId,
            "department" => policy.ScopeId == context.DepartmentId,
            "branch" => policy.ScopeId == context.BranchId,
            "company" => policy.ScopeId == context.CompanyId,
            "default" => policy.ScopeId is null,
            _ => false
        };
}
