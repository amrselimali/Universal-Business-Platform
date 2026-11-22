using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات الحاسبة الموحدة (Gross-to-Net) وسلوك الملاحظات والمانع في دورة المرتبات.</summary>
public sealed class PayrollCalculatorTests
{
    private static PayrollTaxPolicy Policy(params (decimal UpperLimit, decimal Rate)[] brackets) => new()
    {
        Id = Guid.NewGuid(), Code = "TEST", EffectiveFrom = new DateOnly(2020, 1, 1), IsApproved = true,
        Brackets = brackets.Select((b, i) => new PayrollTaxBracket
        {
            UpperLimit = b.UpperLimit, Rate = b.Rate, BracketOrder = i + 1
        }).ToArray()
    };

    private static PayrollEmployeeCalculator Calculator() => new(
        new PayrollCalculationOrchestrator(new PayrollExpressionEvaluator(), new PayrollFormulaService()),
        new PayrollCalculationEngines(), new PayrollExpressionEvaluator());

    [Fact]
    public void EmployeeCalculatorCombinesEarningsTaxInsuranceAndHealth()
    {
        var item = new PayrollItem
        {
            Id = Guid.NewGuid(), Code = "BASIC", NameAr = "أساسي", CategoryCode = "earning",
            IsTaxable = true, IsInsurable = true, AffectsNetSalary = true
        };
        var breakdown = Calculator().Calculate(new PayrollEmployeeCalculationInput
        {
            EmployeeId = Guid.NewGuid(), CurrencyCode = "EGP", AsOfDate = new DateOnly(2026, 1, 1),
            PeriodFrom = new DateOnly(2026, 1, 1), PeriodTo = new DateOnly(2026, 1, 31),
            ContractGross = 1000m, ContractInsurable = 1000m,
            Items = new[] { item },
            Versions = new[]
            {
                new PayrollItemVersion
                {
                    PayrollItemId = item.Id, EffectiveFrom = new DateOnly(2020, 1, 1),
                    CalculationType = "formula", FormulaCode = "BASIC_FORMULA"
                }
            },
            Formulas = new[] { new PayrollFormula { Code = "BASIC_FORMULA", Expression = "BASE" } },
            TaxPolicy = Policy((1000000m, 0.10m)),
            InsurancePolicy = new PayrollInsurancePolicy
            {
                Code = "INS", EmployeeRate = 0.10m, EmployerRate = 0.20m
            },
            HealthRule = new PayrollHealthInsuranceRule
            {
                Code = "HI", BasisExpression = "GROSS", EmployeeRate = 0.01m, EmployerRate = 0.02m
            },
            HealthInsuranceApplicable = true
        });

        Assert.Equal(1000m, breakdown.GrossAmount);
        Assert.Equal(100m, breakdown.EmployeeInsurance);
        Assert.Equal(200m, breakdown.EmployerInsurance);
        Assert.Equal(10m, breakdown.EmployeeHealthInsurance);
        Assert.Equal(20m, breakdown.EmployerHealthInsurance);
        Assert.Equal(100m, breakdown.TaxCurrent);
        Assert.Equal(790m, breakdown.NetAmount);
        Assert.Equal(1220m, breakdown.EmployerCost);
    }

    [Fact]
    public void SuspendedSalaryProducesZeroBreakdownWithNote()
    {
        var breakdown = Calculator().Calculate(new PayrollEmployeeCalculationInput
        {
            EmployeeId = Guid.NewGuid(), CurrencyCode = "EGP", AsOfDate = new DateOnly(2026, 1, 1),
            ContractGross = 5000m, SalarySuspended = true, TaxPolicy = Policy((1000m, 0.10m))
        });

        Assert.Equal(0m, breakdown.GrossAmount);
        Assert.Equal(0m, breakdown.NetAmount);
        Assert.Contains("PAYROLL_SALARY_SUSPENDED", breakdown.Notes);
    }

    [Fact]
    public void MissingTaxPolicyIsReportedNotSilentlyZero()
    {
        var breakdown = Calculator().Calculate(new PayrollEmployeeCalculationInput
        {
            EmployeeId = Guid.NewGuid(), CurrencyCode = "EGP", AsOfDate = new DateOnly(2026, 1, 1),
            ContractGross = 5000m
        });

        Assert.Equal(0m, breakdown.TaxCurrent);
        Assert.Contains("PAYROLL_TAX_POLICY_MISSING", breakdown.Notes);
    }

    [Fact]
    public void MissingInsurancePolicyIsReported()
    {
        var breakdown = Calculator().Calculate(new PayrollEmployeeCalculationInput
        {
            EmployeeId = Guid.NewGuid(), CurrencyCode = "EGP", AsOfDate = new DateOnly(2026, 1, 1),
            ContractGross = 5000m, ContractInsurable = 5000m
        });

        Assert.Equal(0m, breakdown.EmployeeInsurance);
        Assert.Contains("PAYROLL_INSURANCE_POLICY_MISSING", breakdown.Notes);
    }

    [Fact]
    public void CriticalIssueBlocksApproval()
    {
        var workflow = new PayrollRunWorkflow();
        var issues = new[]
        {
            new PayrollRunIssue { Severity = PayrollIssueSeverities.Critical, Code = "TAX_POLICY_MISSING" }
        };
        Assert.Throws<InvalidOperationException>(() => workflow.Transition(
            PayrollRunStatuses.UnderReview, PayrollRunStatuses.Approved, issues));
        Assert.True(PayrollRunWorkflow.IsBlocker(PayrollIssueSeverities.Critical));
        Assert.False(PayrollRunWorkflow.IsBlocker(PayrollIssueSeverities.Warning));
    }

    [Fact]
    public void NeedsCorrectionCanReturnToCalculation()
    {
        var workflow = new PayrollRunWorkflow();
        Assert.True(workflow.CanTransition(PayrollRunStatuses.Calculated, PayrollRunStatuses.NeedsCorrection));
        Assert.True(workflow.CanTransition(PayrollRunStatuses.NeedsCorrection, PayrollRunStatuses.Calculating));
    }

    [Fact]
    public void AuditActionMappingRespectsAllowedDatabaseValues()
    {
        Assert.Equal("INSERT", PayrollAuditWriter.MapAction("CALCULATE"));
        Assert.Equal("UPDATE", PayrollAuditWriter.MapAction("APPROVE"));
        Assert.Equal("UPDATE", PayrollAuditWriter.MapAction("PAY"));
        Assert.Equal("DELETE", PayrollAuditWriter.MapAction("DELETE"));
    }
}
