using Ubp.Core.Results;

namespace Ubp.Core.Models;

/// <summary>
/// رصيد افتتاحي لموظف في سنة ضريبية (بند 7.4 وملحق ب.3).
/// يُضاف مرة واحدة إلى الأساس التراكمي للسنة عند أول حساب، ثم يبقى ثابتاً خلال السنة.
/// </summary>
public sealed class PayrollOpeningBalance
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid EmployeeId { get; set; }
    public string TaxYearCode { get; set; } = "";
    public decimal TaxBase { get; set; }
    public decimal TaxWithheld { get; set; }
    public decimal InsuranceBase { get; set; }
    public decimal InsuranceEmployee { get; set; }
    public decimal InsuranceEmployer { get; set; }
    public decimal HealthBase { get; set; }
    public decimal HealthEmployee { get; set; }
    public decimal HealthEmployer { get; set; }
    public string? Notes { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>إجمالي استقطاعات الموظف الافتتاحية (تأمينات + صحي) — للعرض فقط.</summary>
    public decimal TotalEmployeeDeductions => InsuranceEmployee + HealthEmployee;

    /// <summary>إجمالي أعباء صاحب العمل الافتتاحية (تأمينات + صحي) — للعرض فقط.</summary>
    public decimal TotalEmployerContributions => InsuranceEmployer + HealthEmployer;

    /// <summary>هل يوجد أي مبلغ افتتاحي؟ صفر في كل الحقول يعني «لا رصيد».</summary>
    public bool HasAmounts =>
        TaxBase != 0 || TaxWithheld != 0 || InsuranceBase != 0 || InsuranceEmployee != 0 ||
        InsuranceEmployer != 0 || HealthBase != 0 || HealthEmployee != 0 || HealthEmployer != 0;

    /// <summary>تحقق قبل الحفظ: السنة والأرقام غير سالبة. يرفع استثناء تحقق برسالة ترجمة.</summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(TaxYearCode))
            throw new ValidationAppException("validation.payroll_tax_year_required");
        if (EmployeeId == Guid.Empty)
            throw new ValidationAppException("validation.payroll_employee_required");

        var amounts = new[]
        {
            TaxBase, TaxWithheld, InsuranceBase, InsuranceEmployee, InsuranceEmployer,
            HealthBase, HealthEmployee, HealthEmployer
        };
        if (amounts.Any(x => x < 0))
            throw new ValidationAppException("validation.payroll_opening_amount_negative");
        if (TaxWithheld > TaxBase && TaxBase > 0)
            throw new ValidationAppException("validation.payroll_opening_withheld_exceeds_base");
        if (InsuranceEmployee + InsuranceEmployer > 0 && InsuranceBase <= 0)
            throw new ValidationAppException("validation.payroll_opening_insurance_base_required");
        if (HealthEmployee + HealthEmployer > 0 && HealthBase <= 0)
            throw new ValidationAppException("validation.payroll_opening_health_base_required");
    }

    public PayrollOpeningBalance Normalize()
    {
        TaxYearCode = TaxYearCode.Trim();
        Notes = string.IsNullOrWhiteSpace(Notes) ? null : Notes.Trim();
        return this;
    }

    public static PayrollOpeningBalance Empty(Guid companyId, Guid employeeId, string taxYearCode) =>
        new() { Id = Guid.NewGuid(), CompanyId = companyId, EmployeeId = employeeId, TaxYearCode = taxYearCode };
}

/// <summary>
/// قواعد قفل الأرصدة الافتتاحية: لا تُعدَّل بعد بدء احتساب السنة (حركات ضريبية موجودة)،
/// لأن ذلك يغيّر الأساس التراكمي لشهور سابقة بشكل غير قابل للتتبع.
/// </summary>
public static class PayrollOpeningBalanceRules
{
    public static bool IsLocked(int taxTransactionCount) => taxTransactionCount > 0;

    public static void EnsureEditable(int taxTransactionCount)
    {
        if (IsLocked(taxTransactionCount))
            throw new ValidationAppException("validation.payroll_opening_balance_locked");
    }

    /// <summary>
    /// يضيف الرصيد الافتتاحي إلى الأساس التراكمي للسنة (مرة واحدة لكل حساب، ولا يُخزَّن في الحركات).
    /// </summary>
    public static (decimal Taxable, decimal Withheld) ApplyToYearToDate(decimal taxableYtd,
        decimal withheldYtd, PayrollOpeningBalance? opening) =>
        (taxableYtd + (opening?.TaxBase ?? 0m), withheldYtd + (opening?.TaxWithheld ?? 0m));
}
