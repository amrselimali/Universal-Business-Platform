namespace Ubp.Core.Models;

/// <summary>
/// اختيار سياسة التأمينات حسب الفرع باصطلاح الكود (لا يوجد عمود فرع في جدول السياسات):
/// كود الفرع، INS-{code}، {code}-INS، SOC-{code}، ثم سياسة عامة (DEFAULT/GLOBAL)، ثم أول سياسة معتمدة.
/// دالة نقية قابلة للاختبار ومستخدمة من المستودع نفسه.
/// </summary>
public static class PayrollInsurancePolicyMatcher
{
    public static IReadOnlyList<string> CodeCandidates(string? branchCode)
    {
        if (string.IsNullOrWhiteSpace(branchCode)) return Array.Empty<string>();
        var code = branchCode.Trim();
        return new[] { code, $"INS-{code}", $"{code}-INS", $"SOC-{code}" };
    }

    public static PayrollInsurancePolicy? SelectByBranch(IReadOnlyList<PayrollInsurancePolicy> policies,
        string? branchCode)
    {
        if (policies.Count == 0) return null;
        var approved = policies.Where(x => x.IsApproved).ToList();
        var pool = approved.Count > 0 ? approved : policies;

        var candidates = CodeCandidates(branchCode);
        if (candidates.Count > 0)
        {
            var match = pool.FirstOrDefault(policy =>
                candidates.Any(code => string.Equals(policy.Code, code, StringComparison.OrdinalIgnoreCase)));
            if (match is not null) return match;
        }

        return pool.FirstOrDefault(policy =>
                   policy.Code.Equals("DEFAULT", StringComparison.OrdinalIgnoreCase) ||
                   policy.Code.Equals("GLOBAL", StringComparison.OrdinalIgnoreCase) ||
                   policy.Code.Equals("INS", StringComparison.OrdinalIgnoreCase) ||
                   policy.Code.Equals("SOCIAL", StringComparison.OrdinalIgnoreCase))
               ?? pool[0];
    }
}
