using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>استحقاق الإجازات وحد الترحيل: قواعد نقية تُطبَّق قبل أي كتابة.</summary>
public sealed class PayrollLeaveRulesTests
{
    [Theory]
    [InlineData(21, 12, 21)]
    [InlineData(21, 6, 10.5)]
    [InlineData(21, 0, 0)]
    [InlineData(30, 3, 7.5)]
    public void AccrualIsProportionalToServiceMonths(decimal entitlement, int months, decimal expected)
    {
        Assert.Equal(expected, PayrollLeaveRules.Accrue(entitlement, months));
    }

    [Fact]
    public void MonthsAreClampedToTheYear()
    {
        Assert.Equal(21m, PayrollLeaveRules.Accrue(21m, 24));
        Assert.Equal(0m, PayrollLeaveRules.Accrue(21m, -3));
    }

    [Fact]
    public void NegativeEntitlementIsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => PayrollLeaveRules.Accrue(-1m, 12));
    }

    [Fact]
    public void CarryForwardIsZeroWhenNotAllowed()
    {
        Assert.Equal(0m, PayrollLeaveRules.CarriedForward(10m, false, null));
        Assert.Equal(0m, PayrollLeaveRules.CarriedForward(10m, false, 100m));
    }

    [Fact]
    public void CarryForwardRespectsTheConfiguredLimit()
    {
        Assert.Equal(5m, PayrollLeaveRules.CarriedForward(10m, true, 5m));
        Assert.Equal(10m, PayrollLeaveRules.CarriedForward(10m, true, 50m));
        Assert.Equal(10m, PayrollLeaveRules.CarriedForward(10m, true, null));
        Assert.Equal(0m, PayrollLeaveRules.CarriedForward(-4m, true, 5m));
    }

    [Fact]
    public void NegativeCarryLimitIsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            PayrollLeaveRules.CarriedForward(10m, true, -1m));
    }

    [Fact]
    public void YearPlanCombinesAccrualAndCappedCarry()
    {
        var plan = PayrollLeaveRules.PlanYear(Guid.NewGuid(), " annual ", 2027, 21m, 6, 12m, true, 4m);

        Assert.Equal("annual", plan.LeaveTypeCode);
        Assert.Equal(10.5m, plan.Accrued);
        Assert.Equal(4m, plan.CarriedForward);
        Assert.Equal(14.5m, plan.OpeningBalance);
        Assert.True(plan.CarryLimitApplied);
    }

    [Fact]
    public void YearPlanWithoutCarryOnlyKeepsAccrual()
    {
        var plan = PayrollLeaveRules.PlanYear(Guid.NewGuid(), "annual", 2027, 21m, 12, 9m, false, null);

        Assert.Equal(21m, plan.Accrued);
        Assert.Equal(0m, plan.CarriedForward);
        Assert.False(plan.CarryLimitApplied);
        Assert.Equal(21m, plan.OpeningBalance);
    }

    [Theory]
    [InlineData("", 2027)]
    [InlineData("annual", 1800)]
    public void InvalidInputsAreRejectedWithValidationCodes(string leaveType, int year)
    {
        var error = Assert.Throws<ValidationAppException>(() =>
            PayrollLeaveRules.PlanYear(Guid.NewGuid(), leaveType, year, 21m, 12, 0m, true, null));

        Assert.Contains("validation.leave_", error.Code);
    }

    [Fact]
    public void AccrualReferenceIsStablePerYear()
    {
        Assert.Equal("ACCRUAL-2027", PayrollLeaveRules.AccrualReference(2027));
        Assert.Equal(PayrollLeaveRules.AccrualReference(2027), PayrollLeaveRules.AccrualReference(2027));
    }
}
