using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات الأرصدة الافتتاحية (بند 7.4): التحقق، الإجماليات، وقفل السنة بعد أول حركة.</summary>
public sealed class PayrollOpeningBalanceTests
{
    private static PayrollOpeningBalance Valid() => new()
    {
        Id = Guid.NewGuid(), CompanyId = Guid.NewGuid(), EmployeeId = Guid.NewGuid(),
        TaxYearCode = "2026", TaxBase = 60000m, TaxWithheld = 4500m,
        InsuranceBase = 50000m, InsuranceEmployee = 5500m, InsuranceEmployer = 9000m,
        HealthBase = 20000m, HealthEmployee = 200m, HealthEmployer = 400m, Notes = " رصيد مرحّل "
    };

    [Fact]
    public void ValidBalancePassesValidation()
    {
        var balance = Valid();

        balance.Validate();

        Assert.True(balance.HasAmounts);
    }

    [Fact]
    public void NormalizeTrimsYearAndNotes()
    {
        var balance = Valid().Normalize();

        Assert.Equal("2026", balance.TaxYearCode);
        Assert.Equal("رصيد مرحّل", balance.Notes);
    }

    [Fact]
    public void TotalsSplitBetweenEmployeeAndEmployer()
    {
        var balance = Valid();

        Assert.Equal(5700m, balance.TotalEmployeeDeductions);
        Assert.Equal(9400m, balance.TotalEmployerContributions);
    }

    [Fact]
    public void ZeroBalanceHasNoAmounts()
    {
        var balance = PayrollOpeningBalance.Empty(Guid.NewGuid(), Guid.NewGuid(), "2026");

        Assert.False(balance.HasAmounts);
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(0, -5)]
    public void NegativeAmountsAreRejected(decimal taxBase, decimal taxWithheld)
    {
        var balance = PayrollOpeningBalance.Empty(Guid.NewGuid(), Guid.NewGuid(), "2026");
        balance.TaxBase = taxBase;
        balance.TaxWithheld = taxWithheld;

        var error = Assert.Throws<ValidationAppException>(() => balance.Validate());

        Assert.Contains("negative", error.Code);
    }

    [Fact]
    public void MissingYearIsRejected()
    {
        var balance = Valid();
        balance.TaxYearCode = "  ";

        var error = Assert.Throws<ValidationAppException>(() => balance.Validate());

        Assert.Equal("validation.payroll_tax_year_required", error.Code);
    }

    [Fact]
    public void WithheldAboveBaseIsRejected()
    {
        var balance = Valid();
        balance.TaxWithheld = balance.TaxBase + 1m;

        var error = Assert.Throws<ValidationAppException>(() => balance.Validate());

        Assert.Equal("validation.payroll_opening_withheld_exceeds_base", error.Code);
    }

    [Fact]
    public void InsuranceContributionRequiresBase()
    {
        var balance = Valid();
        balance.InsuranceBase = 0m;

        var error = Assert.Throws<ValidationAppException>(() => balance.Validate());

        Assert.Equal("validation.payroll_opening_insurance_base_required", error.Code);
    }

    [Fact]
    public void HealthContributionRequiresBase()
    {
        var balance = Valid();
        balance.HealthBase = 0m;

        var error = Assert.Throws<ValidationAppException>(() => balance.Validate());

        Assert.Equal("validation.payroll_opening_health_base_required", error.Code);
    }

    [Fact]
    public void YearLocksAfterFirstTaxTransaction()
    {
        Assert.False(PayrollOpeningBalanceRules.IsLocked(0));
        Assert.True(PayrollOpeningBalanceRules.IsLocked(1));

        var error = Assert.Throws<ValidationAppException>(() =>
            PayrollOpeningBalanceRules.EnsureEditable(3));

        Assert.Equal("validation.payroll_opening_balance_locked", error.Code);
    }

    [Fact]
    public void OpeningBalanceIsAddedToYearToDateOnce()
    {
        var (taxable, withheld) = PayrollOpeningBalanceRules.ApplyToYearToDate(120000m, 9000m, Valid());

        Assert.Equal(180000m, taxable);
        Assert.Equal(13500m, withheld);
    }

    [Fact]
    public void MissingOpeningBalanceKeepsYearToDateUnchanged()
    {
        var (taxable, withheld) = PayrollOpeningBalanceRules.ApplyToYearToDate(120000m, 9000m, null);

        Assert.Equal(120000m, taxable);
        Assert.Equal(9000m, withheld);
    }
}
