using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حماية من تكرار قيمة التحويل «واردًا» في المسترد: الكمية السالبة تظل ظاهرة
/// في «المستهلك» للعرض فقط، لكن حساب المسترد يستخدم الكمية المستهلكة الموجبة.
/// </summary>
public sealed class BookingSettlementMathTests
{
    [Fact]
    public void Transferred_in_negative_consumed_does_not_increase_the_refund()
    {
        // عميل استلم 2 (مستهلك -2)، دفع 100، سعر خارجي 50.
        Assert.Equal(100, BookingSettlementMath.Refund(100, 50, -2));
        // بلا دفع: لا مسترد.
        Assert.Equal(0, BookingSettlementMath.Refund(0, 50, -2));
    }

    [Fact]
    public void Refundable_consumed_excludes_incoming_transfer_but_keeps_execution()
    {
        // تحويل وارد 2 بلا تنفيذ: لا استهلاك ولا خصم من المسترد.
        Assert.Equal(0, BookingSettlementMath.RefundableConsumed(0, -2, 0));
        Assert.Equal(100, BookingSettlementMath.Refund(100, 50,
            BookingSettlementMath.RefundableConsumed(0, -2, 0)));
        // تحويل وارد 2 ثم تنفيذ 1: الاستهلاك الفعلي 1 فقط.
        Assert.Equal(1, BookingSettlementMath.RefundableConsumed(1, -2, 0));
        Assert.Equal(50, BookingSettlementMath.Refund(100, 50,
            BookingSettlementMath.RefundableConsumed(1, -2, 0)));
        // تحويل صادر 2 + تنفيذ 1 = 3 مستهلك فعليًا.
        Assert.Equal(3, BookingSettlementMath.RefundableConsumed(1, 2, 0));
    }

    [Fact]
    public void Normal_consumption_still_deducts_the_external_value()
    {
        // 200 مدفوع - 2 × 50 مستهلك = 100، كما في اختبار التسوية القائم.
        Assert.Equal(100, BookingSettlementMath.Refund(200, 50, 2));
        Assert.Equal(0, BookingSettlementMath.Refund(100, 50, 2));
    }

    [Fact]
    public void Rounding_matches_settlement_rounding()
    {
        Assert.Equal(33.33m, BookingSettlementMath.Refund(100, 10.001m, 6.666m));
    }
}
