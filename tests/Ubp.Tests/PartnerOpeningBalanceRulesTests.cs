using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// شرط شاشة إضافة العميل: أرصدة افتتاحية أو قرار «لا يوجد رصيد افتتاحي»، وليس الاثنان.
/// </summary>
public sealed class PartnerOpeningBalanceRulesTests
{
    [Fact]
    public void No_opening_balance_requires_an_explicit_decision()
    {
        Assert.Equal("validation.opening_balance_required",
            PartnerOpeningBalanceRules.Validate(false, 0));
        Assert.Null(PartnerOpeningBalanceRules.Validate(true, 0));
    }

    [Fact]
    public void Opening_balances_and_the_no_balance_switch_are_mutually_exclusive()
    {
        Assert.Equal("validation.opening_balance_exclusive",
            PartnerOpeningBalanceRules.Validate(true, 1));
        Assert.Null(PartnerOpeningBalanceRules.Validate(false, 1));
    }

    [Fact]
    public void Legacy_calls_without_a_decision_keep_working()
    {
        Assert.Null(PartnerOpeningBalanceRules.Validate(null, 0));
        Assert.Null(PartnerOpeningBalanceRules.Validate(null, 2));
    }
}
