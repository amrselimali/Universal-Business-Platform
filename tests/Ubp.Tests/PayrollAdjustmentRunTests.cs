using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات دورة التسوية (بند 12.3): إضافات/استقطاعات فقط، بلا راتب أساسي ولا ضرائب.</summary>
public sealed class PayrollAdjustmentRunTests
{
    private static PayrollAdjustment Adj(decimal amount, bool taxable = false, bool insurable = false) => new()
    {
        Id = Guid.NewGuid(), EmployeeId = Guid.NewGuid(), Amount = amount,
        EffectiveDate = new DateOnly(2026, 1, 15), IsTaxable = taxable, IsInsurable = insurable
    };

    [Fact]
    public void PositiveAndNegativeAmountsAreSplitIntoGrossAndDeductions()
    {
        var result = PayrollAdjustmentEngine.Calculate(new[] { Adj(1200m), Adj(-300m), Adj(50.555m) });

        Assert.Equal(1250.56m, result.GrossAmount);
        Assert.Equal(300m, result.DeductionsAmount);
        Assert.Equal(950.56m, result.NetAmount);
        Assert.Equal(3, result.Lines.Count);
    }

    [Fact]
    public void ZeroAmountsAreIgnored()
    {
        var result = PayrollAdjustmentEngine.Calculate(new[] { Adj(0m), Adj(500m) });

        Assert.Single(result.Lines);
        Assert.Equal(500m, result.NetAmount);
    }

    [Fact]
    public void NoLinesMeansNoAmounts()
    {
        var result = PayrollAdjustmentEngine.Calculate(Array.Empty<PayrollAdjustment>());

        Assert.False(result.HasAmounts);

        var error = Assert.Throws<ValidationAppException>(() =>
            PayrollAdjustmentEngine.EnsureHasLines(result));

        Assert.Equal("validation.payroll_adjustment_run_empty", error.Code);
    }

    [Fact]
    public void DeductionOnlyRunHasNegativeNetAndIsNotPayable()
    {
        var result = PayrollAdjustmentEngine.Calculate(new[] { Adj(-750m) });

        Assert.Equal(0m, result.GrossAmount);
        Assert.Equal(750m, result.DeductionsAmount);
        Assert.Equal(-750m, result.NetAmount);
        Assert.False(result.IsPayable);
        Assert.True(result.HasAmounts);
    }

    [Fact]
    public void PositiveNetIsPayable()
    {
        var result = PayrollAdjustmentEngine.Calculate(new[] { Adj(2000m), Adj(-500m) });

        Assert.Equal(1500m, result.NetAmount);
        Assert.True(result.IsPayable);
    }

    [Fact]
    public void TaxableAndInsurableFlagsArePreserved()
    {
        var result = PayrollAdjustmentEngine.Calculate(new[] { Adj(100m, taxable: true, insurable: true) });

        var line = Assert.Single(result.Lines);
        Assert.True(line.IsTaxable);
        Assert.True(line.IsInsurable);
    }

    [Theory]
    [InlineData(PayrollRunTypes.Regular, false)]
    [InlineData("regular", false)]
    [InlineData(PayrollRunTypes.Adjustment, true)]
    [InlineData("adjustment", true)]
    [InlineData(null, false)]
    public void RunTypeDetectionIsCaseInsensitive(string? value, bool expectedAdjustment)
    {
        Assert.Equal(expectedAdjustment, PayrollRunTypes.IsAdjustment(value));
    }

    [Fact]
    public void RunTypeNormalizationDefaultsToRegular()
    {
        Assert.Equal(PayrollRunTypes.Regular, PayrollRunTypes.Normalize(null));
        Assert.Equal(PayrollRunTypes.Regular, PayrollRunTypes.Normalize("weird"));
        Assert.Equal(PayrollRunTypes.Adjustment, PayrollRunTypes.Normalize("adjustment"));
    }

    [Fact]
    public void NewRunDefaultsToRegularType()
    {
        var run = new PayrollRun();

        Assert.Equal(PayrollRunTypes.Regular, run.RunType);
        Assert.Null(run.SourceRunId);
        Assert.True(PayrollRunTypes.IsValid(run.RunType));
        Assert.False(PayrollRunTypes.IsValid("OTHER"));
    }
}
