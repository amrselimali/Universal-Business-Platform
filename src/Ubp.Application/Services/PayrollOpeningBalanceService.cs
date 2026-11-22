using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// الأرصدة الافتتاحية للضريبة والتأمينات (بند 7.4، ملحق ب.3).
/// القفل: بعد أول حركة ضريبية في السنة لا يمكن التعديل أو الحذف، حتى لا يتغيّر أساس شهور محسوبة.
/// </summary>
public sealed class PayrollOpeningBalanceService
{
    private readonly IPayrollOpeningBalanceRepository _repository;
    private readonly IPayrollStatutoryRepository _statutory;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollOpeningBalanceService(IPayrollOpeningBalanceRepository repository,
        IPayrollStatutoryRepository statutory, PermissionService permissions, PayrollAuditWriter audit)
    {
        _repository = repository;
        _statutory = statutory;
        _permissions = permissions;
        _audit = audit;
    }

    public async Task<IReadOnlyList<PayrollOpeningBalance>> ListAsync(string? taxYearCode,
        ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.View, ct);
        var companyId = await _statutory.GetCompanyIdAsync(ct);
        var year = string.IsNullOrWhiteSpace(taxYearCode) ? null : taxYearCode.Trim();
        return await _repository.ListAsync(companyId, year, ct);
    }

    public async Task<PayrollOpeningBalance?> GetAsync(Guid employeeId, string taxYearCode,
        ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.View, ct);
        return await _repository.GetAsync(employeeId, taxYearCode.Trim(), ct);
    }

    /// <summary>هل السنة مقفولة أمام تعديل الأرصدة الافتتاحية؟ يُستخدم لتعطيل الواجهة.</summary>
    public async Task<bool> IsLockedAsync(string taxYearCode, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.View, ct);
        var transactions = await _statutory.CountTaxTransactionsAsync(taxYearCode.Trim(), ct);
        return PayrollOpeningBalanceRules.IsLocked(transactions);
    }

    public async Task<Guid> SaveAsync(PayrollOpeningBalance balance, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        balance.Validate();
        balance.Normalize();

        if (balance.CompanyId == Guid.Empty)
            balance.CompanyId = await _statutory.GetCompanyIdAsync(ct);
        if (balance.CompanyId == Guid.Empty)
            throw new ValidationAppException("validation.payroll_company_required");

        var transactions = await _statutory.CountTaxTransactionsAsync(balance.TaxYearCode, ct);
        PayrollOpeningBalanceRules.EnsureEditable(transactions);

        var existing = await _repository.GetAsync(balance.EmployeeId, balance.TaxYearCode, ct);
        if (balance.Id == Guid.Empty) balance.Id = Guid.NewGuid();
        balance.CreatedBy ??= actor.UserId;

        var id = await _repository.UpsertAsync(balance, ct);
        await _audit.WriteAsync(actor, "payroll_opening_balances", id.ToString(),
            existing is null ? "CREATE" : "UPDATE",
            existing is null ? null : Snapshot(existing), Snapshot(balance), ct);
        return id;
    }

    public async Task<bool> DeleteAsync(Guid employeeId, string taxYearCode, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        var year = taxYearCode.Trim();
        var transactions = await _statutory.CountTaxTransactionsAsync(year, ct);
        PayrollOpeningBalanceRules.EnsureEditable(transactions);

        var existing = await _repository.GetAsync(employeeId, year, ct);
        var deleted = await _repository.DeleteAsync(employeeId, year, ct);
        if (deleted)
            await _audit.WriteAsync(actor, "payroll_opening_balances", $"{employeeId}:{year}",
                "DELETE", existing is null ? null : Snapshot(existing), null, ct);
        return deleted;
    }

    private static object Snapshot(PayrollOpeningBalance balance) => new
    {
        employee_id = balance.EmployeeId,
        tax_year = balance.TaxYearCode,
        tax_base = balance.TaxBase,
        tax_withheld = balance.TaxWithheld,
        insurance_base = balance.InsuranceBase,
        insurance_employee = balance.InsuranceEmployee,
        insurance_employer = balance.InsuranceEmployer,
        health_base = balance.HealthBase,
        health_employee = balance.HealthEmployee,
        health_employer = balance.HealthEmployer
    };

    private async Task EnsureAsync(ActorContext actor, string action, CancellationToken ct)
    {
        if (await _permissions.HasAsync(actor, ScreenCodes.PayrollOpeningBalances, action, ct)) return;
        throw new ForbiddenException();
    }
}
