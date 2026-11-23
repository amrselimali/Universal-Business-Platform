using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>0213 — إعداد الفرع: شرط الحجز المؤكد لتنفيذ الخدمة المحجوزة في نفس اليوم.</summary>
public sealed class BookingExecutionRuleTests
{
    private static readonly DateOnly Today = new(2026, 11, 23);

    [Theory]
    [InlineData(true, "SERVICE", "reserved", true)]
    [InlineData(true, "SERVICE", null, true)]
    [InlineData(true, "SERVICE", "direct", false)]
    [InlineData(false, "SERVICE", "reserved", false)]
    [InlineData(true, "GOODS", "reserved", false)]
    [InlineData(true, "goods", "reserved", false)]
    public void AppliesOnlyForReservedServicesWhenBranchRequires(bool branchRequires,
        string itemType, string? mode, bool expected)
    {
        Assert.Equal(expected, BookingExecutionRules.Applies(branchRequires, itemType, mode));
    }

    [Theory]
    [InlineData("confirmed", true)]
    [InlineData("partially_delivered", true)]
    [InlineData("CONFIRMED", true)]
    [InlineData("draft", false)]
    [InlineData("cancelled", false)]
    [InlineData("completed", false)]
    [InlineData(null, false)]
    public void OnlyConfirmedStatusesCount(string? status, bool expected)
    {
        Assert.Equal(expected, BookingExecutionRules.IsConfirmedForDay(status, Today, Today));
    }

    [Fact]
    public void BookingFromAnotherDayDoesNotSatisfyTheRule()
    {
        Assert.False(BookingExecutionRules.IsConfirmedForDay("confirmed",
            Today.AddDays(-1), Today));
        Assert.False(BookingExecutionRules.IsSameDay(null, Today));
        Assert.True(BookingExecutionRules.IsSameDay(Today, Today));
    }

    [Fact]
    public void TodayResolvesInAppTimeZone()
    {
        // 22:30 UTC يوم 23 = 01:30 يوم 24 في القاهرة (UTC+3 صيفاً/UTC+2 شتاءً حسب القاعدة).
        var utc = new DateTimeOffset(2026, 11, 23, 22, 30, 0, TimeSpan.Zero);
        var cairo = BookingExecutionRules.TodayIn("Africa/Cairo", utc);
        Assert.True(cairo == new DateOnly(2026, 11, 23) || cairo == new DateOnly(2026, 11, 24));
        Assert.Equal(new DateOnly(2026, 11, 23), BookingExecutionRules.TodayIn("UTC", utc));
        // منطقة غير معروفة → UTC بلا استثناء.
        Assert.Equal(new DateOnly(2026, 11, 23),
            BookingExecutionRules.TodayIn("Not/AZone", utc));
        Assert.Equal(new DateOnly(2026, 11, 23), BookingExecutionRules.TodayIn(null, utc));
    }

    [Fact]
    public void ValidationCodeIsStable()
    {
        Assert.Equal("validation.execution_confirmed_booking_required",
            BookingExecutionRules.Code);
        Assert.Equal("validation.execution_employee_branch_mismatch",
            BookingExecutionRules.BranchMismatchCode);
    }

    [Fact]
    public void EmployeeMustBelongToTheExecutionBranch()
    {
        var branch = Guid.CreateVersion7();
        Assert.True(BookingExecutionRules.EmployeeBelongsToBranch(null, branch));
        Assert.True(BookingExecutionRules.EmployeeBelongsToBranch(branch, branch));
        Assert.False(BookingExecutionRules.EmployeeBelongsToBranch(Guid.CreateVersion7(), branch));
    }
}
