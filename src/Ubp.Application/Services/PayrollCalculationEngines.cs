using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed record TaxCalculation(decimal CumulativeDue, decimal CurrentDue);
public sealed record InsuranceCalculation(decimal EmployeeShare, decimal EmployerShare, decimal Basis);

/// <summary>
/// المحركات الحسابية للمرتبات: ضريبة الدخل التراكمية والإعفاءات، التأمينات الاجتماعية،
/// التأمين الصحي الشامل، وGross-up / Net-to-Gross. كل الدوال نقية (Pure) بلا أي كتابة،
/// ولا تحتوي نسباً أو حدوداً قانونية ثابتة — كل القيم تأتي من إعدادات مؤرخة.
/// </summary>
public sealed class PayrollCalculationEngines
{
    private readonly PayrollExpressionEvaluator _evaluator = new();

    public TaxCalculation CalculateCumulativeTax(decimal taxableCumulative, decimal previousTax,
        decimal previousPeriodsWithheld, IReadOnlyList<(decimal UpperLimit, decimal Rate)> brackets)
    {
        if (taxableCumulative < 0 || previousPeriodsWithheld < 0)
            throw new ArgumentOutOfRangeException(nameof(taxableCumulative));
        var due = ProgressiveTax(taxableCumulative,
            brackets.Select(x => new PayrollTaxBracket { UpperLimit = x.UpperLimit, Rate = x.Rate }).ToArray());
        var current = Math.Max(0, due - previousPeriodsWithheld);
        return new TaxCalculation(due, current);
    }

    /// <summary>
    /// ضريبة تراكمية كاملة: إعفاءات مؤرخة ومشروطة، ثم الشرائح، ثم خصم المسدد سابقاً
    /// ورصيد دائن مرحّل. الرصيد السالب لا يُرد نقداً بل يُرحّل داخل نفس السنة الضريبية.
    /// </summary>
    public PayrollTaxComputation CalculateCumulativeTax(decimal taxableIncome,
        PayrollTaxPolicy? policy, IEnumerable<PayrollTaxExemption>? exemptions,
        decimal taxableIncomeYtd, decimal taxWithheldYtd, decimal creditBalance,
        IReadOnlyDictionary<string, decimal>? conditionVariables = null, DateOnly? asOfDate = null)
    {
        if (taxableIncome < 0) throw new ArgumentOutOfRangeException(nameof(taxableIncome));
        if (taxableIncomeYtd < 0 || taxWithheldYtd < 0) throw new ArgumentOutOfRangeException(nameof(taxableIncomeYtd));

        var applied = new List<string>();
        var exempt = 0m;
        var variables = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["TAXABLE_INCOME"] = taxableIncome,
            ["TAXABLE_YTD"] = taxableIncomeYtd,
            ["WITHHELD_YTD"] = taxWithheldYtd,
            ["CREDIT_BALANCE"] = creditBalance,
            ["EXEMPTION_AMOUNT"] = 0m
        };
        if (conditionVariables is not null)
            foreach (var pair in conditionVariables) variables[pair.Key] = pair.Value;

        foreach (var exemption in (exemptions ?? Array.Empty<PayrollTaxExemption>())
                     .Where(x => x.IsActive)
                     .Where(x => asOfDate is null ||
                                 (x.EffectiveFrom <= asOfDate && (x.EffectiveTo is null || x.EffectiveTo >= asOfDate)))
                     .OrderBy(x => x.Code))
        {
            if (!ConditionMet(exemption.ConditionExpression, variables)) continue;
            var amount = exemption.ExemptionType.ToLowerInvariant() switch
            {
                "full" or "all" => taxableIncome - exempt,
                "percentage" or "percent" => taxableIncome * (exemption.Percentage ?? 0m),
                _ => exemption.Amount ?? 0m
            };
            if (amount <= 0) continue;
            exempt = Math.Min(taxableIncome, exempt + amount);
            applied.Add(exemption.Code);
            variables["EXEMPTION_AMOUNT"] = exempt;
        }

        var currentTaxable = Math.Max(0, taxableIncome - exempt);
        var cumulativeTaxable = Math.Max(0, taxableIncomeYtd + currentTaxable);
        var brackets = policy?.Brackets?.ToArray() ?? Array.Empty<PayrollTaxBracket>();
        var due = ProgressiveTax(cumulativeTaxable, brackets);

        var credit = Math.Max(0, creditBalance);
        var raw = due - taxWithheldYtd - credit;
        var currentDue = Math.Max(0, raw);
        var resultingCredit = raw < 0
            ? -raw
            : Math.Max(0, credit - Math.Max(0, due - taxWithheldYtd));

        return new PayrollTaxComputation
        {
            TaxableIncome = currentTaxable,
            ExemptAmount = exempt,
            CumulativeDue = due,
            PreviouslyWithheld = taxWithheldYtd,
            CurrentDue = decimal.Round(currentDue, 2, MidpointRounding.AwayFromZero),
            CreditBalance = decimal.Round(resultingCredit, 2, MidpointRounding.AwayFromZero),
            AppliedExemptions = applied
        };
    }

    public InsuranceCalculation CalculateInsurance(decimal basis, decimal employeeRate,
        decimal employerRate, decimal? minimum = null, decimal? maximum = null)
    {
        var effectiveBasis = Math.Clamp(basis, minimum ?? decimal.MinValue, maximum ?? decimal.MaxValue);
        if (effectiveBasis < 0) effectiveBasis = 0;
        return new InsuranceCalculation(
            decimal.Round(effectiveBasis * employeeRate, 2, MidpointRounding.AwayFromZero),
            decimal.Round(effectiveBasis * employerRate, 2, MidpointRounding.AwayFromZero),
            effectiveBasis);
    }

    public InsuranceCalculation CalculateInsurance(decimal basis, PayrollInsurancePolicy? policy)
        => policy is null
            ? new InsuranceCalculation(0m, 0m, Math.Max(0, basis))
            : CalculateInsurance(basis, policy.EmployeeRate, policy.EmployerRate,
                policy.MinimumBasis, policy.MaximumBasis);

    /// <summary>التأمين الصحي الشامل مستقل تماماً: وعاؤه معادلة قابلة للإعداد.</summary>
    public InsuranceCalculation CalculateHealthInsurance(decimal basis, PayrollHealthInsuranceRule? rule)
    {
        if (rule is null) return new InsuranceCalculation(0m, 0m, Math.Max(0, basis));
        var coveredBasis = Math.Max(0, basis);
        return new InsuranceCalculation(
            decimal.Round(coveredBasis * rule.EmployeeRate, 2, MidpointRounding.AwayFromZero),
            decimal.Round(coveredBasis * rule.EmployerRate, 2, MidpointRounding.AwayFromZero),
            coveredBasis);
    }

    /// <summary>يقيّم وعاء التأمين الصحي كمعادلة (مثال: GROSS أو GROSS - EXEMPT_ALLOWANCES).</summary>
    public decimal EvaluateHealthBasis(string? expression, IReadOnlyDictionary<string, decimal> variables,
        decimal fallback)
    {
        if (string.IsNullOrWhiteSpace(expression)) return fallback;
        try
        {
            return Math.Max(0, _evaluator.Evaluate(expression, variables));
        }
        catch (Exception ex) when (ex is FormatException or KeyNotFoundException or DivideByZeroException)
        {
            return fallback;
        }
    }

    /// <summary>Net-to-Gross: بحث ثنائي على إجمالي يُنتج صافياً مستهدفاً مع كشف عدم الرتابة.</summary>
    public NetToGrossSolution SolveNetToGross(decimal targetNet, decimal fixedDeductions,
        Func<decimal, decimal> netForGross, decimal tolerance = 0.01m, int maxIterations = 100)
    {
        if (targetNet < 0) throw new ArgumentOutOfRangeException(nameof(targetNet));
        if (tolerance <= 0 || maxIterations <= 0) throw new ArgumentOutOfRangeException(nameof(tolerance));

        var low = 0m;
        var high = Math.Max(targetNet * 2 + fixedDeductions + 1m, 1m);
        var lowNet = netForGross(low);
        var highNet = netForGross(high);
        var expansions = 0;
        while (highNet < targetNet && expansions < 20)
        {
            low = high;
            lowNet = highNet;
            high *= 2;
            highNet = netForGross(high);
            expansions++;
        }
        if (highNet < targetNet)
            return new NetToGrossSolution { Converged = false, Reason = "NET_TO_GROSS_UNBOUNDED" };
        if (lowNet > targetNet)
            return new NetToGrossSolution { Converged = false, Reason = "NET_TO_GROSS_BELOW_TARGET" };

        for (var i = 1; i <= maxIterations; i++)
        {
            var gross = (low + high) / 2m;
            var net = netForGross(gross);
            if (Math.Abs(net - targetNet) <= tolerance)
                return new NetToGrossSolution
                {
                    Converged = true, Gross = decimal.Round(gross, 4), AchievedNet = net,
                    Difference = net - targetNet, Iterations = i
                };
            if (net < targetNet) low = gross; else high = gross;
        }
        var midpoint = (low + high) / 2m;
        return new NetToGrossSolution
        {
            Converged = false, Gross = decimal.Round(midpoint, 4), AchievedNet = netForGross(midpoint),
            Difference = netForGross(midpoint) - targetNet, Iterations = maxIterations,
            Reason = "NET_TO_GROSS_MAX_ITERATIONS"
        };
    }

    public decimal CalculateGrossUp(decimal targetNet, decimal fixedDeductions,
        Func<decimal, decimal> deductionsForGross, decimal tolerance = 0.0001m, int maxIterations = 100)
    {
        if (targetNet < 0 || tolerance <= 0 || maxIterations <= 0)
            throw new ArgumentOutOfRangeException(nameof(targetNet));
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

    private static decimal ProgressiveTax(decimal taxable, IReadOnlyList<PayrollTaxBracket> brackets)
    {
        if (taxable <= 0 || brackets.Count == 0) return 0m;
        var ordered = brackets.OrderBy(x => x.UpperLimit).ToArray();
        var due = 0m;
        var lower = 0m;
        foreach (var bracket in ordered)
        {
            if (taxable <= lower) break;
            var amount = Math.Min(taxable, bracket.UpperLimit) - lower;
            if (amount > 0) due += amount * bracket.Rate;
            lower = bracket.UpperLimit;
        }
        if (taxable > lower) due += (taxable - lower) * ordered[^1].Rate;
        return decimal.Round(due, 2, MidpointRounding.AwayFromZero);
    }

    private bool ConditionMet(string? expression, IReadOnlyDictionary<string, decimal> variables)
    {
        if (string.IsNullOrWhiteSpace(expression)) return true;
        try
        {
            return _evaluator.Evaluate(expression, variables) != 0m;
        }
        catch (Exception ex) when (ex is FormatException or KeyNotFoundException or DivideByZeroException)
        {
            return false;
        }
    }
}
