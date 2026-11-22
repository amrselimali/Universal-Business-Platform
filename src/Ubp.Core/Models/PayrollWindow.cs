namespace Ubp.Core.Models;

/// <summary>
/// نافذة قراءة حركات المصادر: تُقصّ عند لحظة القطع (Data Cutoff) بند 2 و15.1.
/// دالة نقية حتى تُختبر بلا قاعدة بيانات، ولا تُنشئ نافذة مقلوبة أبداً.
/// </summary>
public static class PayrollWindow
{
    public static DateOnly ClampTo(DateOnly from, DateOnly to, DateTime? cutoff)
    {
        if (cutoff is not { } value) return to;
        var cutoffDate = DateOnly.FromDateTime(value);
        if (cutoffDate >= to) return to;
        return cutoffDate < from ? from : cutoffDate;
    }
}
