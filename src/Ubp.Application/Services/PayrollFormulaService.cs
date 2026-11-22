using System.Globalization;
using System.Text.RegularExpressions;
using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed class PayrollFormulaService
{
    private static readonly Regex Identifier = new("[A-Za-z_][A-Za-z0-9_]*", RegexOptions.Compiled);
    private static readonly HashSet<string> Functions = new(StringComparer.OrdinalIgnoreCase)
        { "IF", "AND", "OR", "NOT", "ROUND", "CEILING", "FLOOR", "ABS", "COALESCE", "NULLIF", "MIN", "MAX" };

    public PayrollFormulaValidationResult Validate(IReadOnlyCollection<PayrollFormula> formulas,
        IReadOnlyCollection<string>? externalVariables = null)
    {
        var errors = new List<string>();
        var byCode = formulas.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
        var external = externalVariables is null
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : externalVariables.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var dependencies = new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var formula in formulas)
        {
            if (string.IsNullOrWhiteSpace(formula.Code) || string.IsNullOrWhiteSpace(formula.Expression))
            {
                errors.Add($"Formula '{formula.Code}' must have a code and expression.");
                continue;
            }

            var names = Identifier.Matches(formula.Expression).Select(x => x.Value)
                .Where(x => !decimal.TryParse(x, NumberStyles.Any, CultureInfo.InvariantCulture, out _)
                    && !Functions.Contains(x) && !string.Equals(x, "true", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(x, "false", StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            dependencies[formula.Code] = names;
            foreach (var dependency in names)
                if (!byCode.ContainsKey(dependency) && !external.Contains(dependency))
                    errors.Add($"Formula '{formula.Code}' references unknown variable '{dependency}'.");
            if (Regex.IsMatch(formula.Expression, @"/\s*0(?:\.0*)?(?:\D|$)"))
                errors.Add($"Formula '{formula.Code}' contains a constant division by zero.");
        }

        var order = TopologicalOrder(dependencies, errors);
        return new PayrollFormulaValidationResult { Errors = errors, EvaluationOrder = order };
    }

    private static IReadOnlyList<string> TopologicalOrder(
        IReadOnlyDictionary<string, IReadOnlyList<string>> dependencies, List<string> errors)
    {
        var state = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        var result = new List<string>();
        void Visit(string code)
        {
            if (state.TryGetValue(code, out var current))
            {
                if (current == 1) errors.Add($"Circular formula dependency detected at '{code}'.");
                return;
            }
            state[code] = 1;
            if (dependencies.TryGetValue(code, out var values))
                foreach (var dependency in values)
                    if (dependencies.ContainsKey(dependency)) Visit(dependency);
            state[code] = 2;
            result.Add(code);
        }
        foreach (var code in dependencies.Keys) Visit(code);
        return result;
    }
}
