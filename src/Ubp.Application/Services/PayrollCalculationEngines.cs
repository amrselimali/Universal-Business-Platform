namespace Ubp.Application.Services;

public sealed record TaxCalculation(decimal CumulativeDue, decimal CurrentDue);
public sealed record InsuranceCalculation(decimal EmployeeShare, decimal EmployerShare, decimal Basis);

public sealed class PayrollCalculationEngines
{
    public TaxCalculation CalculateCumulativeTax(decimal taxableCumulative, decimal previousTax,
        decimal previousPeriodsWithheld, IReadOnlyList<(decimal UpperLimit, decimal Rate)> brackets)
    {
        if (taxableCumulative < 0 || previousPeriodsWithheld < 0)
            throw new ArgumentOutOfRangeException(nameof(taxableCumulative));
        var due = 0m;
        var lower = 0m;
        foreach (var bracket in brackets.OrderBy(x => x.UpperLimit))
        {
            var amount = Math.Max(0, Math.Min(taxableCumulative, bracket.UpperLimit) - lower);
            due += amount * bracket.Rate;
            lower = bracket.UpperLimit;
            if (taxableCumulative <= bracket.UpperLimit) break;
        }
        if (taxableCumulative > lower && brackets.Count > 0)
            due += (taxableCumulative - lower) * brackets[^1].Rate;
        var current = Math.Max(0, due - previousPeriodsWithheld);
        return new TaxCalculation(due, current);
    }

    public InsuranceCalculation CalculateInsurance(decimal basis, decimal employeeRate,
        decimal employerRate, decimal? minimum = null, decimal? maximum = null)
    {
        var effectiveBasis = Math.Clamp(basis, minimum ?? decimal.MinValue, maximum ?? decimal.MaxValue);
        return new InsuranceCalculation(effectiveBasis * employeeRate, effectiveBasis * employerRate, effectiveBasis);
    }

    public decimal CalculateGrossUp(decimal targetNet, decimal fixedDeductions,
        Func<decimal, decimal> deductionsForGross, decimal tolerance = 0.0001m, int maxIterations = 100)
    {
        if (targetNet < 0 || tolerance <= 0 || maxIterations <= 0) throw new ArgumentOutOfRangeException(nameof(targetNet));
        var low = targetNet;
        var high = Math.Max(targetNet + fixedDeductions, targetNet * 2 + 1);
        for (var i = 0; i < maxIterations; i++)
        {
            var gross = (low + high) / 2m;
            var net = gross - fixedDeductions - deductionsForGross(gross);
            if (Math.Abs(net - targetNet) <= tolerance) return decimal.Round(gross, 4);
            if (net < targetNet) low = gross; else high = gross;
        }
        throw new InvalidOperationException("Gross-up solver did not converge within the configured limit.");
    }
}
