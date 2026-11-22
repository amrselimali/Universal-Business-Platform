using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed partial class PayrollRunCalculationService
{
    private async Task<string?> SkipReasonAsync(Employee employee, PayrollRun run, CancellationToken ct)
    {
        if (!employee.IsActive) return "PAYROLL_EMPLOYEE_NOT_ACTIVE";
        var profile = await _foundation.GetProfileAsync(employee.Id, ct);
        if (profile is null) return "PAYROLL_EMPLOYEE_PROFILE_MISSING";
        if (profile.Status == PayrollEmployeeStatuses.Suspended) return "PAYROLL_EMPLOYEE_SUSPENDED";
        if (profile.Status == PayrollEmployeeStatuses.Terminated) return "PAYROLL_EMPLOYEE_TERMINATED";
        if (profile.ServiceEndDate is { } end && end < run.SalaryFrom) return "PAYROLL_EMPLOYEE_SERVICE_ENDED";
        if (profile.Status != PayrollEmployeeStatuses.Approved) return "PAYROLL_EMPLOYEE_NOT_APPROVED";
        return null;
    }

    private async Task<PayrollRun> TransitionAsync(PayrollRun run, string target, CancellationToken ct)
    {
        if (!await _runs.UpdateStatusAsync(run.Id, run.Version, target, ct))
            throw new InvalidOperationException("The payroll run was changed by another user.");
        run.Status = target;
        run.Version++;
        return run;
    }

    private Task AddIssueAsync(Guid runId, string severity, string code, string message, CancellationToken ct) =>
        _runs.AddIssueAsync(new PayrollRunIssue
        {
            Id = Guid.NewGuid(), PayrollRunId = runId, Severity = severity, Code = code, Message = message
        }, ct);

    /// <summary>يحسب موظفاً واحداً ويحفظ نتيجته وأرصدته وحركاته — بلا أي تأثير على بقية الموظفين.</summary>
    private async Task CalculateEmployeeAsync(PayrollRun run, Employee employee, Guid companyId,
        IReadOnlyList<PayrollItem> items, IReadOnlyList<PayrollItemVersion> versions,
        IReadOnlyList<PayrollFormula> formulas, PayrollTaxPolicy? taxPolicy,
        IReadOnlyList<PayrollTaxExemption> exemptions, PayrollHealthInsuranceRule? healthRule,
        PayrollTaxSettings? taxSettings, IReadOnlyDictionary<Guid, PayrollGrossUpItemRule> grossUpRules,
        DateOnly cutoffDate,
        string calculationVersion, ActorContext? actor, CancellationToken ct)
    {
        var contract = (await _foundation.ListContractsAsync(employee.Id, ct))
            .Where(x => x.EffectiveFrom <= run.SalaryTo &&
                        (x.EffectiveTo is null || x.EffectiveTo >= run.SalaryFrom))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault()
            ?? throw new InvalidOperationException("PAYROLL_CONTRACT_MISSING");
        if (!contract.IsApproved)
            throw new InvalidOperationException("PAYROLL_CONTRACT_NOT_APPROVED");

        var profile = await _foundation.GetProfileAsync(employee.Id, ct);
        var variablesTo = PayrollWindow.ClampTo(run.VariablesFrom, run.VariablesTo, run.CutoffAt);
        var attendance = await _operations.ListAttendanceAsync(run.VariablesFrom, variablesTo, employee.Id, ct);
        var adjustments = await _operations.ListAdjustmentsAsync(run.VariablesFrom, variablesTo, employee.Id, ct);
        var loans = await _operations.ListLoansAsync(employee.Id, ct);

        var scopeType = taxSettings is not null && PayrollTaxScopes.IsValid(taxSettings.ScopeType)
            ? taxSettings.ScopeType.ToUpperInvariant()
            : (employee.BranchId is null ? PayrollTaxScopes.Company : PayrollTaxScopes.Branch);
        var taxBranchId = scopeType == PayrollTaxScopes.Branch ? employee.BranchId : null;
        var period = PayrollStatutoryRepository.PeriodKey(companyId, run.SalaryTo);

        var previousBalance = await _statutory.GetTaxBalanceAsync(employee.Id, period.TaxPeriodId,
            scopeType, taxBranchId, ct);
        await _statutory.DeleteTaxTransactionsAsync(run.Id, employee.Id, ct);
        var ytd = await _statutory.GetTaxYearToDateAsync(employee.Id, period.TaxPeriodId,
            scopeType, taxBranchId, ct);
        // الرصيد الافتتاحي (بند 7.4): يُضاف مرة واحدة على أساس السنة، ولا يُخزَّن في حركات (لا تكرار).
        var opening = await _openingBalances.GetAsync(employee.Id, period.TaxYearCode, ct);
        var openingTotals = PayrollOpeningBalanceRules.ApplyToYearToDate(ytd.Taxable, ytd.Withheld, opening);

        var branchCode = employee.BranchId is { } branchId
            ? await _statutory.GetBranchCodeAsync(branchId, ct)
            : null;
        var insurancePolicy = await _statutory.GetInsurancePolicyAsync(branchCode, run.SalaryTo, ct);
        var healthApplicable = healthRule is not null && IsHealthSubject(profile);
        var hireDate = employee.HireDate is { } hire ? DateOnly.FromDateTime(hire) : (DateOnly?)null;
        var proration = PayrollProration.Calculate(run.SalaryFrom, run.SalaryTo, hireDate,
            profile?.ServiceEndDate);
        var proratedGross = decimal.Round(contract.GrossSalary * proration.Factor, 2);
        var proratedInsurable = contract.InsurableSalary is { } insurable
            ? decimal.Round(insurable * proration.Factor, 2)
            : (decimal?)null;

        var breakdown = _calculator.Calculate(new PayrollEmployeeCalculationInput
        {
            EmployeeId = employee.Id, EmployeeName = employee.NameAr, BranchId = employee.BranchId,
            CurrencyCode = contract.CurrencyCode, PeriodFrom = run.SalaryFrom, PeriodTo = run.SalaryTo,
            AsOfDate = run.SalaryTo, CalculationVersion = calculationVersion,
            ContractGross = proratedGross, ContractInsurable = proratedInsurable,
            SalarySuspended = profile?.SalarySuspended ?? false,
            TaxTreatmentCode = profile?.TaxTreatmentCode,
            InsuranceStatusCode = profile?.InsuranceStatusCode,
            NationalityCode = profile?.NationalityCode,
            NonWorkingWives = profile?.NonWorkingWives ?? 0, Dependents = profile?.Dependents ?? 0,
            HealthInsuranceApplicable = healthApplicable,
            Items = items, Versions = versions, Formulas = formulas,
            Inputs = BuildInputs(contract.GrossSalary, items, attendance, adjustments, loans),
            TaxPolicy = taxPolicy, TaxExemptions = exemptions,
            TaxableIncomeYtd = openingTotals.Taxable,
            TaxWithheldYtd = openingTotals.Withheld,
            TaxCreditBalance = previousBalance?.CreditBalance ?? 0m,
            InsurancePolicy = insurancePolicy, HealthRule = healthApplicable ? healthRule : null,
            GrossUpRules = grossUpRules
        });

        await PersistResultAsync(run, employee, breakdown, calculationVersion, ct);
        await PersistStatutoryAsync(run, employee, companyId, period, scopeType, taxBranchId,
            insurancePolicy, healthRule, healthApplicable, breakdown, previousBalance, ct);
        await _allocations.SaveForEmployeeAsync(run.Id, companyId, employee.Id, employee.BranchId,
            run.SalaryFrom, run.SalaryTo,
            attendance.Where(x => x.WorkedHours > 0).Select(x => x.WorkDate).Distinct().ToArray(),
            breakdown.GrossAmount,
            Math.Max(0, breakdown.EmployerCost - breakdown.GrossAmount), ct);
        if (proration.Factor < 1m)
            await AddIssueAsync(run.Id, PayrollIssueSeverities.Info, "PAYROLL_PARTIAL_MONTH",
                $"Employee {employee.Code}: prorated {proration.ApplicableDays}/{proration.PeriodDays} days ({proration.Factor:P2})", ct);
        await AuditEmployeeAsync(actor, run, employee, breakdown, calculationVersion, ct);
    }
}
