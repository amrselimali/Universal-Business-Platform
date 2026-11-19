using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

public sealed class PayrollEngineTests
{
    [Fact]
    public void FormulaValidationDetectsCircularDependencies()
    {
        var result = new PayrollFormulaService().Validate(new[]
        {
            new PayrollFormula { Code = "A", Expression = "B + 1" },
            new PayrollFormula { Code = "B", Expression = "A + 1" }
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, x => x.Contains("Circular", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void GrossUpBisectionFindsConfiguredNet()
    {
        var engines = new PayrollCalculationEngines();
        var gross = engines.CalculateGrossUp(900m, 0m, value => value * 0.1m);
        Assert.InRange(gross, 999.99m, 1000.01m);
    }

    [Fact]
    public void WorkflowRejectsPostingWithBlockingIssue()
    {
        var workflow = new PayrollRunWorkflow();
        var issues = new[] { new PayrollRunIssue { Severity = "blocking", Code = "MISSING_ACCOUNT" } };
        Assert.Throws<InvalidOperationException>(() => workflow.Transition(
            PayrollRunStatuses.Approved, PayrollRunStatuses.Posted, issues));
    }

    [Fact]
    public void ConfigurationValidationRequiresCompleteCostCenterSplit()
    {
        var employeeId = Guid.NewGuid();
        var service = new PayrollConfigurationValidationService();
        var errors = service.ValidateCostCenterAllocations(new[]
        {
            new PayrollCostCenterAllocation { EmployeeId = employeeId, EffectiveFrom = new DateOnly(2026, 1, 1), AllocationPercent = 60 },
            new PayrollCostCenterAllocation { EmployeeId = employeeId, EffectiveFrom = new DateOnly(2026, 1, 1), AllocationPercent = 30 }
        });

        Assert.Single(errors);
        Assert.Contains("100%", errors[0]);
    }

    [Fact]
    public void ExpressionEvaluatorUsesPrecedenceAndVariables()
    {
        var value = new PayrollExpressionEvaluator().Evaluate("BASE + BONUS * RATE", new Dictionary<string, decimal>
        {
            ["BASE"] = 1000, ["BONUS"] = 200, ["RATE"] = 0.1m
        });

        Assert.Equal(1020m, value);
    }

    [Fact]
    public void ExpressionEvaluatorRejectsDivisionByZero()
    {
        Assert.Throws<DivideByZeroException>(() => new PayrollExpressionEvaluator()
            .Evaluate("BASE / ZERO", new Dictionary<string, decimal> { ["BASE"] = 10, ["ZERO"] = 0 }));
    }

    [Fact]
    public void CalculationOrchestratorCalculatesFormulaLinesAndNet()
    {
        var item = new PayrollItem
        {
            Id = Guid.NewGuid(), Code = "BONUS", NameAr = "مكافأة", CategoryCode = "earning"
        };
        var deduction = new PayrollItem
        {
            Id = Guid.NewGuid(), Code = "DEDUCTION", NameAr = "خصم", CategoryCode = "deduction"
        };
        var result = new PayrollCalculationOrchestrator(new PayrollExpressionEvaluator(), new PayrollFormulaService())
            .Calculate(new PayrollCalculationRequest
            {
                EmployeeId = Guid.NewGuid(), CurrencyCode = "EGP", AsOfDate = new DateOnly(2026, 1, 1),
                CalculationVersion = "test",
                Items = new[] { item, deduction },
                Versions = new[]
                {
                    new PayrollItemVersion { PayrollItemId = item.Id, EffectiveFrom = new DateOnly(2026, 1, 1), CalculationType = "formula", FormulaCode = "BONUS_FORMULA" },
                    new PayrollItemVersion { PayrollItemId = deduction.Id, EffectiveFrom = new DateOnly(2026, 1, 1), CalculationType = "manual" }
                },
                Formulas = new[] { new PayrollFormula { Code = "BONUS_FORMULA", Expression = "BASE * RATE" } },
                Inputs = new Dictionary<string, decimal> { ["BASE"] = 1000, ["RATE"] = 0.1m, ["DEDUCTION"] = 25 }
            });

        Assert.Equal(100m, result.GrossAmount);
        Assert.Equal(25m, result.DeductionsAmount);
        Assert.Equal(75m, result.NetAmount);
    }

    [Fact]
    public void PolicyResolverPrefersEmployeeScope()
    {
        var employeeId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var resolver = new PayrollPolicyResolver();
        var result = resolver.Resolve("BONUS", new DateOnly(2026, 1, 1),
            new PayrollPolicyResolutionContext { CompanyId = companyId, EmployeeId = employeeId },
            new[]
            {
                new PayrollPolicy { Code = "BONUS", ScopeType = "company", ScopeId = companyId, IsApproved = true, EffectiveFrom = new DateOnly(2025, 1, 1) },
                new PayrollPolicy { Code = "BONUS", ScopeType = "employee", ScopeId = employeeId, IsApproved = true, EffectiveFrom = new DateOnly(2025, 1, 1) }
            });

        Assert.NotNull(result);
        Assert.Equal("employee", result!.ScopeType);
    }
}
