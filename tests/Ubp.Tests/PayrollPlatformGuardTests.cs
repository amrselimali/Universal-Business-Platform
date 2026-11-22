using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حراسة أساسيات المنصة المستخدمة في المرتبات: نطاق الفروع، نافذة القطع،
/// اشتقاق الفترة الضريبية، واختيار سياسة التأمينات حسب الفرع.
/// </summary>
public sealed class PayrollPlatformGuardTests
{
    private static ActorContext Actor(bool superAdmin = false, params Guid[] allowed) => new()
    {
        UserId = Guid.NewGuid(), Username = "tester", IsAdmin = false, IsSuperAdmin = superAdmin,
        AllowedBranchIds = allowed, AllBranchIds = allowed, CurrentBranchId = allowed.FirstOrDefault()
    };

    [Fact]
    public void SuperAdminSeesEverythingWithoutFilter()
    {
        var resolved = BranchScope.Resolve(Actor(superAdmin: true), null);

        Assert.Empty(resolved);
    }

    [Fact]
    public void RegularUserIsLimitedToAllowedBranches()
    {
        var own = Guid.NewGuid();
        var other = Guid.NewGuid();
        var actor = Actor(false, own);

        Assert.Equal(new[] { own }, BranchScope.Resolve(actor, null));
        Assert.Throws<ForbiddenException>(() => BranchScope.Resolve(actor, new[] { other }));
        Assert.Equal(new[] { own }, BranchScope.Resolve(actor, new[] { own }));
    }

    [Fact]
    public void RequestedSubsetOfAllowedBranchesIsHonoured()
    {
        var own = Guid.NewGuid();
        var second = Guid.NewGuid();
        var actor = new ActorContext
        {
            UserId = Guid.NewGuid(), Username = "tester",
            AllowedBranchIds = new[] { own, second }, AllBranchIds = new[] { own, second }
        };

        Assert.Equal(new[] { second }, BranchScope.Resolve(actor, new[] { second }));
        Assert.Equal(2, BranchScope.Resolve(actor, null).Count);
    }

    [Fact]
    public void BranchEnsureRejectsForeignBranch()
    {
        var actor = Actor(false, Guid.NewGuid());

        Assert.Throws<ForbiddenException>(() => BranchScope.EnsureAll(actor,
            new[] { Guid.NewGuid() }));
        BranchScope.Ensure(actor, Guid.Empty);
    }

    [Fact]
    public void CutoffWithoutValueKeepsTheOriginalWindow()
    {
        var from = new DateOnly(2026, 1, 1);
        var to = new DateOnly(2026, 1, 31);

        Assert.Equal(to, PayrollWindow.ClampTo(from, to, null));
    }

    [Fact]
    public void CutoffInsideWindowClampsTheEnd()
    {
        var from = new DateOnly(2026, 1, 1);
        var to = new DateOnly(2026, 1, 31);

        Assert.Equal(new DateOnly(2026, 1, 15),
            PayrollWindow.ClampTo(from, to, new DateTime(2026, 1, 15, 10, 0, 0)));
    }

    [Fact]
    public void CutoffAfterWindowOrBeforeItNeverInvertsTheWindow()
    {
        var from = new DateOnly(2026, 1, 10);
        var to = new DateOnly(2026, 1, 31);

        Assert.Equal(to, PayrollWindow.ClampTo(from, to, new DateTime(2026, 2, 5)));
        Assert.Equal(from, PayrollWindow.ClampTo(from, to, new DateTime(2026, 1, 1)));
    }

    [Fact]
    public void TaxPeriodIdIsDeterministicPerYearAndMonth()
    {
        var january = PayrollStatutoryRepository.TaxPeriodId(new DateOnly(2026, 1, 5));
        var sameMonth = PayrollStatutoryRepository.TaxPeriodId(new DateOnly(2026, 1, 28));
        var february = PayrollStatutoryRepository.TaxPeriodId(new DateOnly(2026, 2, 1));
        var nextYear = PayrollStatutoryRepository.TaxPeriodId(new DateOnly(2027, 1, 1));

        Assert.Equal(january, sameMonth);
        Assert.NotEqual(january, february);
        Assert.NotEqual(january, nextYear);
        Assert.NotEqual(Guid.Empty, january);
    }

    [Fact]
    public void PeriodKeyCarriesYearCodeAndMonthBounds()
    {
        var companyId = Guid.NewGuid();
        var key = PayrollStatutoryRepository.PeriodKey(companyId, new DateOnly(2026, 2, 17));

        Assert.Equal(companyId, key.CompanyId);
        Assert.Equal("2026", key.TaxYearCode);
        Assert.Equal("2026-02", key.PeriodCode);
        Assert.Equal(new DateOnly(2026, 2, 1), key.From);
        Assert.Equal(new DateOnly(2026, 2, 28), key.To);
    }
}
