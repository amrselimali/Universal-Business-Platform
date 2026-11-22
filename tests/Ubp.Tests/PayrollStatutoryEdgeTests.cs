using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حواف محركات المرتبات: حدود الشرائح، الإعفاءات، حدود وعاء التأمين، والصحي،
/// واختيار سياسة التأمينات حسب اصطلاح كود الفرع.
/// </summary>
public sealed class PayrollStatutoryEdgeTests
{
    private readonly PayrollCalculationEngines _engines = new();

    private static PayrollTaxPolicy Policy(params (decimal Limit, decimal Rate)[] brackets) => new()
    {
        Id = Guid.NewGuid(), Code = "P1", EffectiveFrom = new DateOnly(2025, 1, 1),
        Cumulative = true, IsApproved = true,
        Brackets = brackets.Select((bracket, index) => new PayrollTaxBracket
        {
            Id = Guid.NewGuid(), UpperLimit = bracket.Limit, Rate = bracket.Rate, BracketOrder = index + 1
        }).ToList()
    };

    private static PayrollTaxExemption Exemption(string type, decimal? amount = null, decimal? percent = null) => new()
    {
        Id = Guid.NewGuid(), Code = "EX", NameAr = "إعفاء", ExemptionType = type,
        Amount = amount, Percentage = percent, EffectiveFrom = new DateOnly(2025, 1, 1), IsActive = true
    };

    [Fact]
    public void ZeroIncomeProducesNoTax()
    {
        var result = _engines.CalculateCumulativeTax(0m, Policy((10000m, 0m), (20000m, 0.1m)),
            Array.Empty<PayrollTaxExemption>(), 0m, 0m, 0m);

        Assert.Equal(0m, result.CurrentDue);
        Assert.Equal(0m, result.CumulativeDue);
        Assert.Equal(0m, result.CreditBalance);
    }

    [Fact]
    public void IncomeExactlyAtBracketLimitStaysInTheZeroBand()
    {
        var result = _engines.CalculateCumulativeTax(10000m, Policy((10000m, 0m), (20000m, 0.1m)),
            Array.Empty<PayrollTaxExemption>(), 0m, 0m, 0m);

        Assert.Equal(0m, result.CumulativeDue);
        Assert.Equal(0m, result.CurrentDue);
    }

    [Fact]
    public void PercentageExemptionReducesTaxableIncomeOnly()
    {
        var result = _engines.CalculateCumulativeTax(20000m, Policy((10000m, 0.05m)),
            new[] { Exemption("percentage", percent: 0.25m) }, 0m, 0m, 0m);

        Assert.Equal(5000m, result.ExemptAmount);
        Assert.Equal(15000m, result.TaxableIncome);
        Assert.Equal(750m, result.CumulativeDue);
        Assert.Contains("EX", result.AppliedExemptions);
    }

    [Fact]
    public void FullExemptionRemovesAllTax()
    {
        var result = _engines.CalculateCumulativeTax(20000m, Policy((10000m, 0.05m)),
            new[] { Exemption("full") }, 0m, 0m, 0m);

        Assert.Equal(0m, result.TaxableIncome);
        Assert.Equal(0m, result.CumulativeDue);
        Assert.Equal(0m, result.CurrentDue);
    }

    [Fact]
    public void InsuranceBasisIsRaisedToMinimumAndCappedAtMaximum()
    {
        var below = _engines.CalculateInsurance(1000m, 0.1m, 0.2m, minimum: 2000m, maximum: 9000m);
        var above = _engines.CalculateInsurance(50000m, 0.1m, 0.2m, minimum: 2000m, maximum: 9000m);

        Assert.Equal(2000m, below.Basis);
        Assert.Equal(200m, below.EmployeeShare);
        Assert.Equal(400m, below.EmployerShare);
        Assert.Equal(9000m, above.Basis);
        Assert.Equal(900m, above.EmployeeShare);
        Assert.Equal(1800m, above.EmployerShare);
    }

    [Fact]
    public void NegativeInsuranceBasisYieldsZeroContributions()
    {
        var result = _engines.CalculateInsurance(-500m, 0.1m, 0.2m);

        Assert.Equal(0m, result.Basis);
        Assert.Equal(0m, result.EmployeeShare);
        Assert.Equal(0m, result.EmployerShare);
    }

    [Fact]
    public void MissingInsurancePolicyIsReportedAsZeroNotSilentlyPriced()
    {
        var result = _engines.CalculateInsurance(8000m, null);

        Assert.Equal(0m, result.EmployeeShare);
        Assert.Equal(0m, result.EmployerShare);
        Assert.Equal(8000m, result.Basis);
    }

    [Fact]
    public void HealthInsuranceUsesItsOwnBasisAndRates()
    {
        var rule = new PayrollHealthInsuranceRule
        {
            Id = Guid.NewGuid(), Code = "H1", EffectiveFrom = new DateOnly(2025, 1, 1),
            EmployeeRate = 0.01m, EmployerRate = 0.02m, IsApproved = true
        };
        var result = _engines.CalculateHealthInsurance(3000m, rule);

        Assert.Equal(30m, result.EmployeeShare);
        Assert.Equal(60m, result.EmployerShare);
        Assert.Equal(3000m, result.Basis);
    }

    [Fact]
    public void InvalidHealthBasisExpressionFallsBackInsteadOfCrashing()
    {
        var variables = new Dictionary<string, decimal> { ["GROSS"] = 5000m };

        Assert.Equal(5000m, _engines.EvaluateHealthBasis("UNKNOWN_VAR * 2", variables, 5000m));
        Assert.Equal(2500m, _engines.EvaluateHealthBasis("GROSS - 2500", variables, 5000m));
    }

    [Fact]
    public void NetToGrossIsMonotonicInTheTargetNet()
    {
        decimal NetFor(decimal gross) => gross - gross * 0.14m;

        var low = _engines.SolveNetToGross(5000m, 0m, NetFor);
        var high = _engines.SolveNetToGross(9000m, 0m, NetFor);

        Assert.True(low.Converged && high.Converged);
        Assert.True(high.Gross > low.Gross);
        Assert.InRange(low.AchievedNet, 4999.9m, 5000.1m);
    }

    [Fact]
    public void InsuranceBranchCandidatesFollowTheDocumentedConvention()
    {
        var candidates = PayrollInsurancePolicyMatcher.CodeCandidates("CAI");

        Assert.Equal(new[] { "CAI", "INS-CAI", "CAI-INS", "SOC-CAI" }, candidates);
        Assert.Empty(PayrollInsurancePolicyMatcher.CodeCandidates("  "));
    }

    [Fact]
    public void BranchPolicyWinsOverDefaultAndUnapprovedIsSkipped()
    {
        var policies = new List<PayrollInsurancePolicy>
        {
            new() { Code = "DEFAULT", IsApproved = true },
            new() { Code = "INS-CAI", IsApproved = false },
            new() { Code = "SOC-CAI", IsApproved = true }
        };

        var selected = PayrollInsurancePolicyMatcher.SelectByBranch(policies, "CAI");

        Assert.Equal("SOC-CAI", selected!.Code);
    }

    [Fact]
    public void WithoutBranchMatchGenericPolicyIsUsedAndEmptyPoolReturnsNull()
    {
        var policies = new List<PayrollInsurancePolicy>
        {
            new() { Code = "DEFAULT", IsApproved = true },
            new() { Code = "OTHER", IsApproved = true }
        };

        Assert.Equal("DEFAULT", PayrollInsurancePolicyMatcher.SelectByBranch(policies, "ALX")!.Code);
        Assert.Null(PayrollInsurancePolicyMatcher.SelectByBranch(Array.Empty<PayrollInsurancePolicy>(), "ALX"));
    }

    [Fact]
    public void WhenNoPolicyIsApprovedTheFirstAvailablePolicyIsUsedExplicitly()
    {
        var policies = new List<PayrollInsurancePolicy>
        {
            new() { Code = "DRAFT-1", IsApproved = false },
            new() { Code = "DRAFT-2", IsApproved = false }
        };

        Assert.Equal("DRAFT-1", PayrollInsurancePolicyMatcher.SelectByBranch(policies, null)!.Code);
    }
}
