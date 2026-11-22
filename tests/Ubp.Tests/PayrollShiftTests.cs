using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات قواعد الوردية (بند 11.2): تأخير/غياب/إضافي والوردية الليلية.</summary>
public sealed class PayrollShiftTests
{
    [Fact]
    public void ShiftInsideOneDayComputesScheduledMinutesMinusBreak()
    {
        var shift = new AttendanceShift
        {
            StartTime = "09:00", EndTime = "17:00", BreakMinutes = 60
        };

        Assert.Equal(420, shift.ScheduledMinutes);
    }

    [Fact]
    public void NightShiftCrossingMidnightCountsAsOneShift()
    {
        var shift = new AttendanceShift
        {
            StartTime = "22:00", EndTime = "06:00", CrossesMidnight = true, BreakMinutes = 30
        };

        Assert.Equal(450, shift.ScheduledMinutes);
    }

    [Fact]
    public void ShortageUpToGraceIsNotAbsence()
    {
        var (absence, overtime) = PayrollShiftService.Compute(480, 470, 15, 0);

        Assert.Equal(0m, absence);
        Assert.Equal(0m, overtime);
    }

    [Fact]
    public void ShortageBeyondGraceBecomesAbsenceHours()
    {
        var (absence, overtime) = PayrollShiftService.Compute(480, 390, 10, 0);

        Assert.Equal(1.33m, absence);
        Assert.Equal(0m, overtime);
    }

    [Fact]
    public void ExtraTimeBeforeOvertimeThresholdIsIgnored()
    {
        var (absence, overtime) = PayrollShiftService.Compute(480, 500, 0, 30);

        Assert.Equal(0m, absence);
        Assert.Equal(0m, overtime);
    }

    [Fact]
    public void ExtraTimeBeyondThresholdBecomesOvertime()
    {
        var (absence, overtime) = PayrollShiftService.Compute(480, 600, 0, 30);

        Assert.Equal(0m, absence);
        Assert.Equal(1.5m, overtime);
    }

    [Fact]
    public void ShiftWithoutScheduleProducesNoAdjustments()
    {
        var (absence, overtime) = PayrollShiftService.Compute(0, 600, 0, 0);

        Assert.Equal(0m, absence);
        Assert.Equal(0m, overtime);
    }
}
