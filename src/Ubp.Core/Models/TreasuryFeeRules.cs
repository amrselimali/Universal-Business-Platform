namespace Ubp.Core.Models;

/// <summary>
/// حساب عمولة التحصيل المحمَّلة على العميل من إجمالي المبلغ المدفوع — بنفس معادلة إيصالات
/// نقطة البيع: fee = amount × percent ÷ (100 + percent)، وصافي المسدد = amount − fee.
/// </summary>
public static class TreasuryFeeRules
{
    public static decimal CollectionFee(decimal grossAmount, decimal percent) =>
        percent <= 0
            ? 0m
            : Math.Round(grossAmount * percent / (100m + percent), 2,
                MidpointRounding.AwayFromZero);

    public static decimal Net(decimal grossAmount, decimal fee) =>
        Math.Round(grossAmount - fee, 2, MidpointRounding.AwayFromZero);
}
