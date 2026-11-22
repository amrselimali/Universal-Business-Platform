using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات محركات الضريبة التراكمية والإعفاءات والتأمينات والصحي والـ Solvers.</summary>
public sealed class PayrollStatutoryEngineTests
{
    private static PayrollTaxPolicy Policy(params (decimal UpperLimit, decimal Rate)[] brackets) => new()
    {
        Id = Guid.NewGuid(), Code = "TEST", EffectiveFrom = new DateOnly(2020, 1, 1), IsApproved = true,
        Brackets = brackets.Select((b, i) => new PayrollTaxBracket
        {
            UpperLimit = b.UpperLimit, Rate = b.Rate, BracketOrder = i + 1
        }).ToArray()
    };

    [Fact]
    public void ProgressiveTaxAppliesMarginalBrackets()
    {
        var engines = new PayrollCalculationEngines();
        var result = engines.CalculateCumulativeTax(2500m, Policy((1000m, 0.10m), (2000m, 0.20m)),
            Array.Empty<PayrollTaxExemption>(), 0m, 0m, 0m);

        Assert.Equal(400m, result.CumulativeDue);
        Assert.Equal(400m, result.CurrentDue);
    }

    [Fact]
    public void AmountExemptionReducesTaxableIncome()
    {
        var engines = new PayrollCalculationEngines();
        var exemptions = new[]
        {
            new PayrollTaxExemption
            {
                Code = "EX", ExemptionType = "amount", Amount = 1000m,
                EffectiveFrom = new DateOnly(2020, 1, 1), IsActive = true
            }
        };
        var result = engines.CalculateCumulativeTax(5000m, Policy((100000m, 0.10m)), exemptions,
            0m, 0m, 0m, null, new DateOnly(2026, 1, 1));

        Assert.Equal(1000m, result.ExemptAmount);
        Assert.Equal(4000m, result.TaxableIncome);
        Assert.Equal(400m, result.CumulativeDue);
    }

    [Fact]
    public void ConditionalExemptionNotMetIsSkipped()
    {
        var engines = new PayrollCalculationEngines();
        var exemptions = new[]
        {
            new PayrollTaxExemption
            {
                Code = "FAMILY", ExemptionType = "amount", Amount = 1000m,
                ConditionExpression = "DEPENDENTS > 0",
                EffectiveFrom = new DateOnly(2020, 1, 1), IsActive = true
            }
        };
        var result = engines.CalculateCumulativeTax(5000m, Policy((100000m, 0.10m)), exemptions,
            0m, 0m, 0m, new Dictionary<string, decimal> { ["DEPENDENTS"] = 0m },
            new DateOnly(2026, 1, 1));

        Assert.Equal(0m, result.ExemptAmount);
        Assert.Empty(result.AppliedExemptions);
    }

    [Fact]
    public void NegativeTaxDifferenceCarriesForwardAsCredit()
    {
        var engines = new PayrollCalculationEngines();
        var result = engines.CalculateCumulativeTax(0m, Policy((100000m, 0.10m)),
            Array.Empty<PayrollTaxExemption>(), 1000m, 200m, 0m);

        Assert.Equal(0m, result.CurrentDue);
        Assert.Equal(100m, result.CreditBalance);
    }

    [Fact]
    public void InsuranceBasisIsClampedToConfiguredLimits()
    {
        var engines = new PayrollCalculationEngines();
        var policy = new PayrollInsurancePolicy
        {
            Code = "INS", EmployeeRate = 0.10m, EmployerRate = 0.20m,
            MinimumBasis = 2000m, MaximumBasis = 5000m
        };
        var result = engines.CalculateInsurance(1000m, policy);

        Assert.Equal(2000m, result.Basis);
        Assert.Equal(200m, result.EmployeeShare);
        Assert.Equal(400m, result.EmployerShare);
    }

    [Fact]
    public void HealthBasisExpressionIsEvaluatedSafely()
    {
        var engines = new PayrollCalculationEngines();
        var basis = engines.EvaluateHealthBasis("GROSS - 1000",
            new Dictionary<string, decimal> { ["GROSS"] = 5000m }, 0m);
        Assert.Equal(4000m, basis);

        var fallback = engines.EvaluateHealthBasis("UNKNOWN + 1",
            new Dictionary<string, decimal> { ["GROSS"] = 5000m }, 123m);
        Assert.Equal(123m, fallback);
    }

    [Fact]
    public void NetToGrossSolverReachesTargetNet()
    {
        var engines = new PayrollCalculationEngines();
        var solution = engines.SolveNetToGross(900m, 0m, gross => gross - gross * 0.10m);

        Assert.True(solution.Converged);
        Assert.InRange(solution.Gross, 999m, 1001m);
    }

    [Fact]
    public void NetToGrossSolverReportsUnboundedFunction()
    {
        var engines = new PayrollCalculationEngines();
        var solution = engines.SolveNetToGross(900m, 0m, _ => 0m);

        Assert.False(solution.Converged);
        Assert.Equal("NET_TO_GROSS_UNBOUNDED", solution.Reason);
    }

    [Fact]
    public void FunctionAndComparisonSupportWorkInFormulas()
    {
        var evaluator = new PayrollExpressionEvaluator();
        var variables = new Dictionary<string, decimal> { ["BASE"] = 1200m, ["RATE"] = 0.125m };

        Assert.Equal(1100m, evaluator.Evaluate("IF(BASE > 1000, BASE - 100, BASE)", variables));
        Assert.Equal(150m, evaluator.Evaluate("ROUND(BASE * RATE, 0)", variables));
        Assert.Equal(1200m, evaluator.Evaluate("MAX(BASE, 900)", variables));
        Assert.Equal(1m, evaluator.Evaluate("AND(BASE >= 1000, NOT(RATE = 0))", variables));
    }
}
