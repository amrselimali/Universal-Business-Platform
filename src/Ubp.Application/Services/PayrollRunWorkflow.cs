using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed class PayrollRunWorkflow
{
    private static readonly IReadOnlyDictionary<string, string[]> Allowed = new Dictionary<string, string[]>
    {
        [PayrollRunStatuses.Draft] = new[] { PayrollRunStatuses.Calculating, PayrollRunStatuses.Cancelled },
        [PayrollRunStatuses.Calculating] = new[] { PayrollRunStatuses.Calculated, PayrollRunStatuses.Draft },
        [PayrollRunStatuses.Calculated] = new[] { PayrollRunStatuses.UnderReview, PayrollRunStatuses.Calculating },
        [PayrollRunStatuses.UnderReview] = new[] { PayrollRunStatuses.Approved, PayrollRunStatuses.Calculating },
        [PayrollRunStatuses.Approved] = new[] { PayrollRunStatuses.Posted },
        [PayrollRunStatuses.Posted] = new[] { PayrollRunStatuses.PartiallyPaid, PayrollRunStatuses.Paid },
        [PayrollRunStatuses.PartiallyPaid] = new[] { PayrollRunStatuses.PartiallyPaid, PayrollRunStatuses.Paid },
        [PayrollRunStatuses.Paid] = new[] { PayrollRunStatuses.Closed },
        [PayrollRunStatuses.Closed] = Array.Empty<string>(),
        [PayrollRunStatuses.Cancelled] = Array.Empty<string>()
    };

    public bool CanTransition(string from, string to) =>
        Allowed.TryGetValue(from, out var targets) && targets.Contains(to, StringComparer.OrdinalIgnoreCase);

    public string Transition(string from, string to, IReadOnlyCollection<PayrollRunIssue> issues,
        bool overrideBlockingIssues = false, string? overrideReason = null)
    {
        if (!CanTransition(from, to)) throw new InvalidOperationException($"Invalid payroll transition: {from} -> {to}.");
        if (to is PayrollRunStatuses.Approved or PayrollRunStatuses.Posted)
        {
            var blocking = issues.Where(x => x.Severity.Equals("blocking", StringComparison.OrdinalIgnoreCase)
                && !x.IsOverridden).ToList();
            if (blocking.Count > 0 && (!overrideBlockingIssues || string.IsNullOrWhiteSpace(overrideReason)))
                throw new InvalidOperationException("Blocking payroll issues require an authorized override and reason.");
        }
        return to;
    }
}
