using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// ملف موظف المرتبات: تسجيل مبدئي → استكمال بيانات → اعتماد للدخول في دورة المرتبات.
/// كل خطوة بصلاحية منفصلة، والبيانات الحساسة بصلاحية مستقلة، والاعتماد يمنع نقص أي حقل مطلوب
/// (بما فيها منع «مخفي ومطلوب» الممنوع أصلاً في الإعدادات).
/// </summary>
public sealed class PayrollEmployeeProfileService
{
    /// <summary>حقول حساسة لا تُعدَّل إلا بصلاحية SENSITIVE_EDIT منفصلة.</summary>
    private static readonly string[] SensitiveFields =
        { "national_id", "passport_number", "insurance_number", "tax_treatment_code" };

    /// <summary>حقول يحتاجها محرك الضريبة/التأمينات — لا يُعتمد ملف بدونها.</summary>
    private static readonly string[] EngineRequiredFields =
        { "tax_treatment_code", "insurance_status_code" };

    private readonly IPayrollFoundationRepository _foundation;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollEmployeeProfileService(IPayrollFoundationRepository foundation,
        PermissionService permissions, PayrollAuditWriter audit)
    {
        _foundation = foundation;
        _permissions = permissions;
        _audit = audit;
    }

    public Task<IReadOnlyList<PayrollEmployeeProfileRow>> ListAsync(string? status, string? search,
        CancellationToken ct = default) => _foundation.ListProfilesAsync(status, search, ct);

    public Task<PayrollEmployeeProfileRow?> GetAsync(Guid employeeId, CancellationToken ct = default) =>
        _foundation.GetProfileRowAsync(employeeId, ct);

    /// <summary>تسجيل مبدئي: ينشئ ملفاً بحالة مبدئي بلا أي قيود إضافية على بيانات الموظف.</summary>
    public async Task RegisterAsync(Guid employeeId, ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Register, ct);
        await _foundation.EnsureProfileAsync(employeeId, ct);
        await _audit.WriteAsync(actor, "payroll_employee_profiles", employeeId.ToString(), "REGISTER",
            null, new { status = PayrollEmployeeStatuses.Draft }, ct);
    }

    /// <summary>استكمال/حفظ بيانات ملف المرتب مع فصل صلاحية البيانات الحساسة.</summary>
    public async Task<PayrollEmployeeProfileRow> SaveAsync(Guid employeeId,
        PayrollEmployeeProfileInput input, ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.CompleteData, ct);
        var current = await _foundation.GetProfileRowAsync(employeeId, ct)
            ?? throw new ValidationAppException("validation.payroll_employee_not_registered");
        if (await TouchesSensitiveAsync(current, input, ct))
            await EnsureAsync(actor, ActionCodes.SensitiveEdit, ct);
        if (input.Status is PayrollEmployeeStatuses.Approved or PayrollEmployeeStatuses.Suspended
            or PayrollEmployeeStatuses.Terminated)
            await EnsureAsync(actor, ActionCodes.Approve, ct);

        var nextStatus = input.Status == PayrollEmployeeStatuses.Draft
            ? PayrollEmployeeStatuses.Incomplete
            : input.Status;
        if (nextStatus == PayrollEmployeeStatuses.Approved)
            throw new ValidationAppException("validation.payroll_employee_use_approve");
        input.Status = nextStatus;

        await _foundation.EnsureProfileAsync(employeeId, ct);
        await _foundation.SaveProfileAsync(employeeId, input, ct);
        await _audit.WriteAsync(actor, "payroll_employee_profiles", employeeId.ToString(), "UPDATE",
            new { status = current.Status }, new { status = nextStatus }, ct);
        return await _foundation.GetProfileRowAsync(employeeId, ct)
               ?? throw new ValidationAppException("validation.payroll_employee_not_registered");
    }

    private async Task<bool> TouchesSensitiveAsync(PayrollEmployeeProfileRow current,
        PayrollEmployeeProfileInput input, CancellationToken ct)
    {
        await Task.CompletedTask;
        var pairs = new Dictionary<string, (string? Before, string? After)>(StringComparer.OrdinalIgnoreCase)
        {
            ["national_id"] = (current.NationalId, input.NationalId),
            ["passport_number"] = (current.PassportNumber, input.PassportNumber),
            ["insurance_number"] = (current.InsuranceNumber, input.InsuranceNumber),
            ["tax_treatment_code"] = (current.TaxTreatmentCode, input.TaxTreatmentCode)
        };
        return pairs.Any(p => !string.Equals(p.Value.Before, p.Value.After, StringComparison.Ordinal));
    }

    private async Task EnsureAsync(ActorContext actor, string action, CancellationToken ct)
    {
        if (!await _permissions.HasAsync(actor, ScreenCodes.PayrollEmployees, action, ct))
            throw new ForbiddenException();
    }

    /// <summary>اعتماد الملف لدخول دورة المرتبات — يمنع النقص في أي حقل مطلوب ساري.</summary>
    public async Task<PayrollEmployeeProfileRow> ApproveAsync(Guid employeeId, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Approve, ct);
        var row = await _foundation.GetProfileRowAsync(employeeId, ct)
            ?? throw new ValidationAppException("validation.payroll_employee_not_registered");
        if (row.Status == PayrollEmployeeStatuses.Terminated)
            throw new ValidationAppException("validation.payroll_employee_terminated");

        var settings = await _foundation.ListFieldSettingsAsync(null, ct);
        var missing = MissingRequiredFields(row, settings, DateOnly.FromDateTime(DateTime.UtcNow));
        if (missing.Count > 0)
            throw new ValidationAppException("validation.payroll_employee_missing_fields",
                new Dictionary<string, string> { ["fields"] = string.Join("، ", missing) });

        if (!await _foundation.UpdateProfileStatusAsync(employeeId, PayrollEmployeeStatuses.Approved, ct))
            throw new ValidationAppException("validation.payroll_employee_not_registered");

        await _audit.WriteAsync(actor, "payroll_employee_profiles", employeeId.ToString(), "APPROVE",
            new { status = row.Status }, new { status = PayrollEmployeeStatuses.Approved }, ct);
        return (await _foundation.GetProfileRowAsync(employeeId, ct))!;
    }

    /// <summary>تغيير الحالة (إيقاف مؤقت / إنهاء خدمة / إعادة لتحت الاستكمال) بصلاحية اعتماد.</summary>
    public async Task SetStatusAsync(Guid employeeId, string status, ActorContext actor,
        CancellationToken ct = default)
    {
        if (status is not (PayrollEmployeeStatuses.Suspended or PayrollEmployeeStatuses.Terminated
            or PayrollEmployeeStatuses.Incomplete))
            throw new ValidationAppException("validation.payroll_employee_status_invalid");
        await EnsureAsync(actor, ActionCodes.Approve, ct);
        if (!await _foundation.UpdateProfileStatusAsync(employeeId, status, ct))
            throw new ValidationAppException("validation.payroll_employee_not_registered");
        await _audit.WriteAsync(actor, "payroll_employee_profiles", employeeId.ToString(), "UPDATE",
            null, new { status }, ct);
    }

    public async Task<IReadOnlyList<PayrollEmployeeFieldSetting>> GetFieldSettingsAsync(
        Guid? companyId, ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.FieldsManage, ct);
        return await _foundation.ListFieldSettingsAsync(companyId, ct);
    }

    public async Task<Guid> SaveFieldSettingAsync(PayrollEmployeeFieldSetting setting, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.FieldsManage, ct);
        if (!setting.IsVisible && setting.IsRequired)
            throw new ValidationAppException("validation.employee_field_hidden_required");
        var id = await _foundation.UpsertFieldSettingAsync(setting, ct);
        await _audit.WriteAsync(actor, "payroll_employee_fields", id.ToString(), "UPDATE", null, new
        {
            setting.FieldCode, setting.IsVisible, setting.IsRequired,
            setting.EffectiveFrom, setting.EffectiveTo
        }, ct);
        return id;
    }

    /// <summary>
    /// الحقول الناقصة المانعة للاعتماد: الحقول المطلوبة السارية من الإعدادات + حقول المحركات
    /// (المعاملة الضريبية والحالة التأمينية). دالة نقية قابلة للاختبار.
    /// </summary>
    public static IReadOnlyList<string> MissingRequiredFields(PayrollEmployeeProfileRow row,
        IEnumerable<PayrollEmployeeFieldSetting> settings, DateOnly asOf)
    {
        var missing = new List<string>();
        var required = settings
            .Where(s => s.IsRequired && s.IsVisible)
            .Where(s => s.EffectiveFrom <= asOf && (s.EffectiveTo is null || s.EffectiveTo >= asOf))
            .Select(s => s.FieldCode)
            .Concat(EngineRequiredFields)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var field in required)
        {
            var value = field.ToLowerInvariant() switch
            {
                "national_id" => row.NationalId,
                "passport_number" => row.PassportNumber,
                "insurance_number" => row.InsuranceNumber,
                "tax_treatment_code" => row.TaxTreatmentCode,
                "insurance_status_code" => row.InsuranceStatusCode,
                "nationality_code" => row.NationalityCode,
                "work_permit_status" => row.WorkPermitStatus,
                "service_end_date" => row.ServiceEndDate?.ToString("yyyy-MM-dd"),
                "working_hours_per_month" => row.WorkingHoursPerMonth?.ToString(),
                _ => "set"
            };
            if (string.IsNullOrWhiteSpace(value)) missing.Add(field);
        }
        return missing;
    }
}
