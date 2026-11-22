using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات الشهر الجزئي وتوزيع تكلفة الفروع ومراكز التكلفة (بند 3.2، 4، ملحق ب.2).</summary>
public sealed class PayrollAllocationTests
{
    [Fact]
    public void FullMonthHasNoProration()
    {
        var result = PayrollProration.Calculate(new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31),
            null, null);

        Assert.Equal(1m, result.Factor);
        Assert.DoesNotContain("PAYROLL_PARTIAL_MONTH", result.Notes);
    }

    [Fact]
    public void HiringMidMonthProratesByCalendarDays()
    {
        var result = PayrollProration.Calculate(new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31),
            new DateOnly(2026, 1, 15), null);

        Assert.Equal(17, result.ApplicableDays);
        Assert.Equal(31, result.PeriodDays);
        Assert.Equal(0.548387m, decimal.Round(result.Factor, 6));
        Assert.Contains("PAYROLL_PARTIAL_MONTH", result.Notes);
    }

    [Fact]
    public void TerminationMidMonthCapsApplicableDays()
    {
        var result = PayrollProration.Calculate(new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28),
            null, new DateOnly(2026, 2, 10));

        Assert.Equal(10, result.ApplicableDays);
    }

    [Fact]
    public void HiringAfterPeriodEndProducesZeroFactor()
    {
        var result = PayrollProration.Calculate(new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31),
            new DateOnly(2026, 2, 5), null);

        Assert.Equal(0m, result.Factor);
        Assert.Contains("PAYROLL_NO_APPLICABLE_DAYS", result.Notes);
    }

    [Fact]
    public void AllocationSplitsByWorkDaysAndKeepsTotalsExact()
    {
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        var days = new Dictionary<Guid, int> { [branchA] = 10, [branchB] = 20 };

        var lines = PayrollAllocationService.SplitByDays(days, 3000m, 300m);

        Assert.Equal(1m, lines.Sum(x => x.AllocationRatio));
        Assert.Equal(3000m, lines.Sum(x => x.GrossCost));
        Assert.Equal(300m, lines.Sum(x => x.EmployerContribution));
        Assert.Equal(3300m, lines.Sum(x => x.TotalCost));
        Assert.Equal(1000m, lines.Single(x => x.BranchId == branchA).GrossCost);
        Assert.Equal(2000m, lines.Single(x => x.BranchId == branchB).GrossCost);
    }

    [Fact]
    public void AllocationHandlesRoundingWithoutLosingMoney()
    {
        var days = new Dictionary<Guid, int>
        {
            [Guid.NewGuid()] = 1, [Guid.NewGuid()] = 1, [Guid.NewGuid()] = 1
        };

        var lines = PayrollAllocationService.SplitByDays(days, 100m, 0m);

        Assert.Equal(100m, lines.Sum(x => x.GrossCost));
        Assert.Equal(1m, lines.Sum(x => x.AllocationRatio));
    }

    [Fact]
    public void CostCenterSplitNormalizesPercentagesToBranchTotal()
    {
        var branchId = Guid.NewGuid();
        var centers = new[]
        {
            new PayrollCostCenterSplit { BranchId = branchId, CostCenterId = Guid.NewGuid(), AllocationRatio = 0.6m },
            new PayrollCostCenterSplit { BranchId = branchId, CostCenterId = Guid.NewGuid(), AllocationRatio = 0.3m }
        };

        var lines = PayrollAllocationService.SplitByRatio(centers, branchId, 900m);

        Assert.Equal(1m, lines.Sum(x => x.AllocationRatio));
        Assert.Equal(900m, lines.Sum(x => x.AllocatedAmount));
    }
}
