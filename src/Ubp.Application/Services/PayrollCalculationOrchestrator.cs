using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed class PayrollCalculationRequest
{
    public Guid EmployeeId { get; set; }
    public string CurrencyCode { get; set; } = "";
    public IReadOnlyCollection<PayrollItem> Items { get; init; } = Array.Empty<PayrollItem>();
    public IReadOnlyCollection<PayrollItemVersion> Versions { get; init; } = Array.Empty<PayrollItemVersion>();
    public IReadOnlyCollection<PayrollFormula> Formulas { get; init; } = Array.Empty<PayrollFormula>();
    public IReadOnlyDictionary<string, decimal> Inputs { get; init; } = new Dictionary<string, decimal>();
    public DateOnly AsOfDate { get; set; }
    public string CalculationVersion { get; set; } = "";
}

public sealed class PayrollCalculatedLine
{
    public string ItemCode { get; init; } = "";
    public decimal Amount { get; init; }
    public string? FormulaCode { get; init; }
}

public sealed class PayrollCalculationResult
{
    public Guid EmployeeId { get; init; }
    public string CurrencyCode { get; init; } = "";
    public decimal GrossAmount { get; init; }
    public decimal DeductionsAmount { get; init; }
    public decimal NetAmount { get; init; }
    public IReadOnlyList<PayrollCalculatedLine> Lines { get; init; } = Array.Empty<PayrollCalculatedLine>();
}

public sealed class PayrollCalculationOrchestrator
{
    private readonly PayrollExpressionEvaluator _evaluator;
    private readonly PayrollFormulaService _formulaService;

    public PayrollCalculationOrchestrator(PayrollExpressionEvaluator evaluator, PayrollFormulaService formulaService)
    {
        _evaluator = evaluator;
        _formulaService = formulaService;
    }

    public PayrollCalculationResult Calculate(PayrollCalculationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrencyCode))
            throw new ArgumentException("Payroll currency is required.", nameof(request));
        var validation = _formulaService.Validate(request.Formulas.ToArray(), request.Inputs.Keys.ToArray());
        if (!validation.IsValid)
            throw new InvalidOperationException(string.Join(" ", validation.Errors));

        var values = request.Inputs.ToDictionary(x => x.Key, x => x.Value, StringComparer.OrdinalIgnoreCase);
        var formulas = request.Formulas.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
        var lines = new List<PayrollCalculatedLine>();
        foreach (var item in request.Items)
        {
            var version = request.Versions.Where(x => x.PayrollItemId == item.Id &&
                    x.EffectiveFrom <= request.AsOfDate && (x.EffectiveTo is null || x.EffectiveTo >= request.AsOfDate))
                .OrderByDescending(x => x.EffectiveFrom).FirstOrDefault();
            if (version is null) continue;

            var amount = values.TryGetValue(item.Code, out var input) ? input : 0m;
            if (version.CalculationType.Equals("formula", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(version.FormulaCode) || !formulas.TryGetValue(version.FormulaCode, out var formula))
                    throw new InvalidOperationException($"No formula is configured for payroll item '{item.Code}'.");
                amount = _evaluator.Evaluate(formula.Expression, values);
            }
            if (!item.AllowNegative && amount < 0) amount = 0;
            if (version.MinimumValue is not null) amount = Math.Max(amount, version.MinimumValue.Value);
            if (version.MaximumValue is not null) amount = Math.Min(amount, version.MaximumValue.Value);
            amount = ApplyRounding(amount, version.RoundingMode);
            values[item.Code] = amount;
            lines.Add(new PayrollCalculatedLine { ItemCode = item.Code, Amount = amount, FormulaCode = version.FormulaCode });
        }

        var gross = lines.Where(x => request.Items.First(i => i.Code == x.ItemCode).AffectsNetSalary &&
                request.Items.First(i => i.Code == x.ItemCode).CategoryCode.Equals("earning", StringComparison.OrdinalIgnoreCase))
            .Sum(x => x.Amount);
        var deductions = lines.Where(x => request.Items.First(i => i.Code == x.ItemCode).AffectsNetSalary &&
                !request.Items.First(i => i.Code == x.ItemCode).CategoryCode.Equals("earning", StringComparison.OrdinalIgnoreCase))
            .Sum(x => x.Amount);
        return new PayrollCalculationResult
        {
            EmployeeId = request.EmployeeId, CurrencyCode = request.CurrencyCode,
            GrossAmount = gross, DeductionsAmount = deductions, NetAmount = gross - deductions, Lines = lines
        };
    }

    private static decimal ApplyRounding(decimal value, string mode) => mode.ToLowerInvariant() switch
    {
        "up" or "ceiling" => decimal.Ceiling(value),
        "down" or "floor" => decimal.Floor(value),
        "nearest" or "round" => decimal.Round(value, 2, MidpointRounding.AwayFromZero),
        _ => value
    };
}
