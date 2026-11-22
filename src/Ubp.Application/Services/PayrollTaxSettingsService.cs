using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// إعداد نطاق التراكم الضريبي لكل سنة (COMPANY/BRANCH) بصلاحية مستقلة.
/// يُمنع تغيير النطاق بعد وجود حركات ضريبية في السنة (بند 7.4 وملحق ب.3).
/// </summary>
public sealed class PayrollTaxSettingsService
{
    private readonly IPayrollStatutoryRepository _statutory;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollTaxSettingsService(IPayrollStatutoryRepository statutory, PermissionService permissions,
        PayrollAuditWriter audit)
    {
        _statutory = statutory;
        _permissions = permissions;
        _audit = audit;
    }

    public Task<PayrollTaxSettings?> GetAsync(Guid companyId, string taxYearCode, DateOnly asOf,
        CancellationToken ct = default) => _statutory.GetTaxSettingsAsync(companyId, taxYearCode, asOf, ct);

    public async Task<Guid> SaveAsync(PayrollTaxSettings settings, ActorContext actor,
        CancellationToken ct = default)
    {
        if (!await _permissions.HasAsync(actor, ScreenCodes.PayrollTaxConfiguration, ActionCodes.Edit, ct))
            throw new ForbiddenException();
        if (!PayrollTaxScopes.IsValid(settings.ScopeType))
            throw new ValidationAppException("validation.payroll_employee_status_invalid");

        var existing = await _statutory.GetTaxSettingsAsync(settings.CompanyId, settings.TaxYearCode,
            settings.EffectiveFrom, ct);
        var transactions = await _statutory.CountTaxTransactionsAsync(settings.TaxYearCode, ct);
        if (transactions > 0 && existing is not null &&
            !string.Equals(existing.ScopeType, settings.ScopeType, StringComparison.OrdinalIgnoreCase))
            throw new ValidationAppException("validation.tax_scope_locked");

        var id = await _statutory.SaveTaxSettingsAsync(settings, ct);
        await _audit.WriteAsync(actor, "payroll_tax_settings", id.ToString(), "UPDATE",
            existing is null ? null : new { scope = existing.ScopeType },
            new { scope = settings.ScopeType, carry = settings.BranchCarryPolicy }, ct);
        return id;
    }
}
