namespace Ubp.Core.Models;

/// <summary>بند مقترح في قالب نشاط — يُنشأ فقط إن لم يوجد بند بنفس الكود (idempotent).</summary>
public sealed class PayrollTemplateItem
{
    public string Code { get; init; } = "";
    public string NameAr { get; init; } = "";
    public string NameEn { get; init; } = "";
    public string CategoryCode { get; init; } = "earning";
    public bool IsVariable { get; init; }
    public bool IsTaxable { get; init; }
    public bool IsInsurable { get; init; }
    public bool EmployerBorne { get; init; }
    public bool AllowNegative { get; init; }
    public string CalculationType { get; init; } = "manual";
}

/// <summary>قالب نشاط: بنود مقترحة + أيام العمل الافتراضية للتقويم.</summary>
public sealed class PayrollActivityTemplate
{
    public string Code { get; init; } = "";
    public string NameAr { get; init; } = "";
    public string DescriptionAr { get; init; } = "";
    public int WorkingDaysPerMonth { get; init; } = 22;
    public IReadOnlyList<PayrollTemplateItem> Items { get; init; } = Array.Empty<PayrollTemplateItem>();
}

/// <summary>
/// قوالب الأنشطة الجاهزة (عيادات / تصنيع / تجارة) — إعداد مبدئي قابل للتعديل، وليس قيماً قانونية.
/// كل بند يحمل خصائصه الضريبية/التأمينية صراحةً بدل أي افتراضات داخل المحرك.
/// </summary>
public static class PayrollActivityTemplates
{
    public const string Clinic = "CLINIC";
    public const string Manufacturing = "MANUFACTURING";
    public const string Retail = "RETAIL";

    private static PayrollTemplateItem Earning(string code, string nameAr, string nameEn,
        bool taxable = true, bool insurable = true, bool variable = false, bool employerBorne = false) =>
        new()
        {
            Code = code, NameAr = nameAr, NameEn = nameEn, CategoryCode = "earning",
            IsTaxable = taxable, IsInsurable = insurable, IsVariable = variable,
            EmployerBorne = employerBorne, CalculationType = "manual"
        };

    /// <summary>استقطاع: لا يخضع لضريبة/تأمين (يُخصم من الإجمالي فقط) ويسمح بالسالب للتصحيح.</summary>
    private static PayrollTemplateItem Deduction(string code, string nameAr, string nameEn) =>
        new()
        {
            Code = code, NameAr = nameAr, NameEn = nameEn, CategoryCode = "deduction",
            IsTaxable = false, IsInsurable = false, IsVariable = true, AllowNegative = true,
            CalculationType = "manual"
        };

    public static IReadOnlyList<PayrollActivityTemplate> All { get; } = new[]
    {
        new PayrollActivityTemplate
        {
            Code = Clinic, NameAr = "عيادة / مركز طبي", WorkingDaysPerMonth = 26,
            DescriptionAr = "أساسي + بدلات ثابتة + نوبتجيات وإضافي + استقطاع تأخير.",
            Items = new[]
            {
                Earning("BASIC_SALARY", "الراتب الأساسي", "Basic salary"),
                Earning("HOUSING_ALLOWANCE", "بدل سكن", "Housing allowance", insurable: false),
                Earning("TRANSPORT_ALLOWANCE", "بدل انتقال", "Transport allowance", insurable: false),
                Earning("ONCALL_ALLOWANCE", "بدل نوبتجية", "On-call allowance", variable: true),
                Earning("OVERTIME", "ساعات إضافية", "Overtime", variable: true),
                Deduction("LATE_DEDUCTION", "استقطاع تأخير", "Late deduction"),
                Earning("EMPLOYER_HEALTH_EXTRA", "تأمين صحي إضافي — تحمّل الشركة",
                    "Extra health insurance (employer)", taxable: false, insurable: false, employerBorne: true)
            }
        },
        new PayrollActivityTemplate
        {
            Code = Manufacturing, NameAr = "تصنيع / إنتاج", WorkingDaysPerMonth = 26,
            DescriptionAr = "أساسي + بدل ورديات + حافز إنتاج + إضافي + جزاءات جودة.",
            Items = new[]
            {
                Earning("BASIC_SALARY", "الراتب الأساسي", "Basic salary"),
                Earning("SHIFT_ALLOWANCE", "بدل ورديات", "Shift allowance", variable: true),
                Earning("PRODUCTION_BONUS", "حافز إنتاج", "Production bonus", variable: true),
                Earning("OVERTIME", "ساعات إضافية", "Overtime", variable: true),
                Deduction("QUALITY_PENALTY", "جزاء جودة", "Quality penalty"),
                Deduction("LATE_DEDUCTION", "استقطاع تأخير", "Late deduction")
            }
        },
        new PayrollActivityTemplate
        {
            Code = Retail, NameAr = "تجارة / منافذ بيع", WorkingDaysPerMonth = 26,
            DescriptionAr = "أساسي + عمولة بيع + إضافي + عجز كاش + تأخير.",
            Items = new[]
            {
                Earning("BASIC_SALARY", "الراتب الأساسي", "Basic salary"),
                Earning("SALES_COMMISSION", "عمولة بيع", "Sales commission", variable: true),
                Earning("OVERTIME", "ساعات إضافية", "Overtime", variable: true),
                Deduction("CASH_SHORTAGE_DEDUCTION", "عجز كاش", "Cash shortage"),
                Deduction("LATE_DEDUCTION", "استقطاع تأخير", "Late deduction")
            }
        }
    };

    public static PayrollActivityTemplate? Get(string code) =>
        All.FirstOrDefault(x => x.Code.Equals(code, StringComparison.OrdinalIgnoreCase));
}
