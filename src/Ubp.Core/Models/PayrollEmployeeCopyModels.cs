using Ubp.Core.Results;

namespace Ubp.Core.Models;

/// <summary>خيارات النسخ: لا يُنسخ أي شيء حسّاس أو شخصي إلا بطلب صريح وصلاحية منفصلة.</summary>
public sealed class PayrollEmployeeCopyOptions
{
    /// <summary>التصنيف الضريبي/التأميني والجنسية وحالة تصريح العمل.</summary>
    public bool CopyClassification { get; set; } = true;
    /// <summary>ساعات العمل الشهرية وإدارة الوقت.</summary>
    public bool CopyEmploymentSettings { get; set; } = true;
    /// <summary>الزوجات غير العاملات وعدد المعالين (بيانات شخصية — افتراضياً لا).</summary>
    public bool CopyFamilyData { get; set; }
    /// <summary>الرقم القومي/الجواز/الرقم التأميني (حسّاس — افتراضياً لا).</summary>
    public bool CopyPersonalIdentifiers { get; set; }
    /// <summary>إنشاء عقد جديد للموظف الهدف من آخر عقد معتمد للمصدر (غير معتمد).</summary>
    public bool CopyContract { get; set; } = true;
    /// <summary>توزيعات مراكز التكلفة (employee_cost_centers) بتاريخ سريان جديد.</summary>
    public bool CopyCostCenters { get; set; }
    /// <summary>إعدادات الصرف/البنك (employee_payment_settings) — بيانات حسّاسة تحتاج SENSITIVE_EDIT.</summary>
    public bool CopyPaymentSettings { get; set; }
    /// <summary>الأرصدة الافتتاحية للسنة الحالية (ضريبة/تأمينات) — تحتاج صلاحية شاشة الأرصدة.</summary>
    public bool CopyOpeningBalances { get; set; }
    /// <summary>آخر إسناد وردية للموظف المصدر — تحتاج صلاحية الحضور.</summary>
    public bool CopyShiftAssignment { get; set; }
    public decimal? SalaryOverride { get; set; }
    public DateOnly? ContractEffectiveFrom { get; set; }
}

/// <summary>نتيجة تطبيق النسخ: الخطة + عدد ما نُسخ فعلياً من الكتل الإضافية.</summary>
public sealed class PayrollEmployeeCopyResult
{
    public required PayrollEmployeeCopyPlan Plan { get; init; }
    public int CostCenters { get; init; }
    public int PaymentSettings { get; init; }
    public bool OpeningBalance { get; init; }
    public bool ShiftAssignment { get; init; }
    public Guid? ContractId { get; init; }
}

/// <summary>حقل في معاينة النسخ: يُعرض للمستخدم قبل التطبيق.</summary>
public sealed class PayrollEmployeeCopyField
{
    public string Name { get; init; } = "";
    public string? SourceValue { get; init; }
    public bool IsSensitive { get; init; }
    public bool WillCopy { get; init; }
}

/// <summary>
/// خطة نسخ إعدادات موظف: تُبنى بلا أي كتابة، وتُعرض للمراجعة، ثم تُطبَّق بصلاحية مستقلة.
/// الحالة والاعتماد ونهاية الخدمة وإيقاف الراتب لا تُنسخ أبداً — كلها قرارات خاصة بالموظف.
/// </summary>
public sealed class PayrollEmployeeCopyPlan
{
    public Guid SourceEmployeeId { get; init; }
    public Guid TargetEmployeeId { get; init; }
    public IReadOnlyList<PayrollEmployeeCopyField> Fields { get; init; } = Array.Empty<PayrollEmployeeCopyField>();
    public PayrollEmployeeContract? Contract { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();
    public PayrollEmployeeProfileInput? Profile { get; init; }

    public bool RequiresSensitivePermission => Fields.Any(x => x.IsSensitive && x.WillCopy);
    public bool WillCopyAnyField => Fields.Any(x => x.WillCopy);
    public bool HasWork => Profile is not null || Contract is not null;
}

/// <summary>
/// مخطط النسخ (دالة نقية): يبني البيانات الجديدة للموظف الهدف فقط، ولا يقرأ أو يكتب شيئاً.
/// </summary>
public static class PayrollEmployeeCopyPlanner
{
    public const string WarningSourceProfileMissing = "PAYROLL_COPY_SOURCE_PROFILE_MISSING";
    public const string WarningNoApprovedContract = "PAYROLL_COPY_NO_APPROVED_CONTRACT";
    public const string WarningStateNotCopied = "PAYROLL_COPY_STATE_NOT_COPIED";

    public static PayrollEmployeeCopyPlan Plan(Guid sourceEmployeeId, Guid targetEmployeeId,
        PayrollEmployeeProfile? source, IReadOnlyList<PayrollEmployeeContract> contracts,
        PayrollEmployeeCopyOptions options, DateOnly today)
    {
        if (sourceEmployeeId == targetEmployeeId)
            throw new ValidationAppException("validation.payroll_copy_same_employee");

        var fields = new List<PayrollEmployeeCopyField>();
        var warnings = new List<string> { WarningStateNotCopied };

        if (source is null)
        {
            warnings.Add(WarningSourceProfileMissing);
            return new PayrollEmployeeCopyPlan
            {
                SourceEmployeeId = sourceEmployeeId, TargetEmployeeId = targetEmployeeId,
                Fields = fields, Warnings = warnings, Contract = BuildContract(null, options, today)
            };
        }

        void Add(string name, string? value, bool willCopy, bool sensitive = false) =>
            fields.Add(new PayrollEmployeeCopyField
            {
                Name = name, SourceValue = sensitive && !willCopy ? "***" : value,
                IsSensitive = sensitive, WillCopy = willCopy
            });

        Add("national_id", source.NationalId, options.CopyPersonalIdentifiers, sensitive: true);
        Add("passport_number", source.PassportNumber, options.CopyPersonalIdentifiers, sensitive: true);
        Add("insurance_number", source.InsuranceNumber, options.CopyPersonalIdentifiers, sensitive: true);
        Add("tax_treatment_code", source.TaxTreatmentCode, options.CopyClassification);
        Add("insurance_status_code", source.InsuranceStatusCode, options.CopyClassification);
        Add("nationality_code", source.NationalityCode, options.CopyClassification);
        Add("work_permit_status", source.WorkPermitStatus, options.CopyClassification);
        Add("working_hours_per_month", source.WorkingHoursPerMonth?.ToString(), options.CopyEmploymentSettings);
        Add("time_management_enabled", source.TimeManagementEnabled.ToString(), options.CopyEmploymentSettings);
        Add("non_working_wives", source.NonWorkingWives.ToString(), options.CopyFamilyData);
        Add("dependents", source.Dependents.ToString(), options.CopyFamilyData);

        var profile = new PayrollEmployeeProfileInput
        {
            Status = PayrollEmployeeStatuses.Incomplete,
            NationalId = options.CopyPersonalIdentifiers ? source.NationalId : null,
            PassportNumber = options.CopyPersonalIdentifiers ? source.PassportNumber : null,
            InsuranceNumber = options.CopyPersonalIdentifiers ? source.InsuranceNumber : null,
            TaxTreatmentCode = options.CopyClassification ? source.TaxTreatmentCode : null,
            InsuranceStatusCode = options.CopyClassification ? source.InsuranceStatusCode : null,
            NationalityCode = options.CopyClassification ? source.NationalityCode : null,
            WorkPermitStatus = options.CopyClassification ? source.WorkPermitStatus : null,
            WorkingHoursPerMonth = options.CopyEmploymentSettings ? source.WorkingHoursPerMonth : null,
            TimeManagementEnabled = options.CopyEmploymentSettings && source.TimeManagementEnabled,
            NonWorkingWives = options.CopyFamilyData ? source.NonWorkingWives : 0,
            Dependents = options.CopyFamilyData ? source.Dependents : 0,
            ServiceEndDate = null,
            SalarySuspended = false
        };

        var contract = BuildContract(contracts, options, today);
        if (contract is null && options.CopyContract) warnings.Add(WarningNoApprovedContract);

        return new PayrollEmployeeCopyPlan
        {
            SourceEmployeeId = sourceEmployeeId, TargetEmployeeId = targetEmployeeId,
            Fields = fields, Contract = contract, Warnings = warnings, Profile = profile
        };
    }

    /// <summary>عقد جديد غير معتمد من آخر عقد معتمد للمصدر، مع تعديل الراتب إن طُلب.</summary>
    public static PayrollEmployeeContract? BuildContract(IReadOnlyList<PayrollEmployeeContract>? contracts,
        PayrollEmployeeCopyOptions options, DateOnly today)
    {
        if (!options.CopyContract || contracts is null) return null;
        var latest = contracts
            .Where(x => x.IsApproved)
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault();
        if (latest is null) return null;

        var gross = options.SalaryOverride ?? latest.GrossSalary;
        var insurable = options.SalaryOverride is null
            ? latest.InsurableSalary
            : Math.Min(latest.InsurableSalary ?? gross, gross);

        return new PayrollEmployeeContract
        {
            Id = Guid.NewGuid(),
            EffectiveFrom = options.ContractEffectiveFrom ?? today,
            EffectiveTo = null,
            CurrencyCode = latest.CurrencyCode,
            GrossSalary = gross,
            InsurableSalary = insurable,
            IsApproved = false,
            Version = 1
        };
    }
}
