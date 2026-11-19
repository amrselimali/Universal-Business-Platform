using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>Calculates and persists one employee result for a payroll run.</summary>
public sealed class PayrollRunCalculationService
{
    private readonly IPayrollRunRepository _runs;
    private readonly IPayrollFoundationRepository _foundation;
    private readonly IPayrollConfigurationRepository _configuration;
    private readonly IPayrollOperationsRepository _operations;
    private readonly PayrollCalculationOrchestrator _orchestrator;
    private readonly IEmployeeRepository _employees;

    public PayrollRunCalculationService(IPayrollRunRepository runs,
        IPayrollFoundationRepository foundation,
        IPayrollConfigurationRepository configuration,
        IPayrollOperationsRepository operations,
        PayrollCalculationOrchestrator orchestrator,
        IEmployeeRepository employees)
    {
        _runs = runs;
        _foundation = foundation;
        _configuration = configuration;
        _operations = operations;
        _orchestrator = orchestrator;
        _employees = employees;
    }

public sealed record PayrollRunCalculationSummary(Guid PayrollRunId, int EmployeeCount, int CalculatedCount);

    public async Task<PayrollRunCalculationSummary> CalculateRunAsync(Guid runId,
        string calculationVersion, CancellationToken ct = default)
    {
        var run = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        var calculating = await TransitionAsync(run, PayrollRunStatuses.Calculating, ct);
        var employees = await _employees.ListAllActiveAsync(ct);
        var calculated = 0;
        try
        {
            foreach (var employee in employees)
            {
                await CalculateEmployeeAsync(runId, employee.Id, calculationVersion, ct);
                calculated++;
            }
            await TransitionAsync(calculating, PayrollRunStatuses.Calculated, ct);
            return new PayrollRunCalculationSummary(runId, employees.Count, calculated);
        }
        catch
        {
            var current = await _runs.GetAsync(runId, ct);
            if (current is not null && current.Status == PayrollRunStatuses.Calculating)
                await TransitionAsync(current, PayrollRunStatuses.Draft, ct);
            throw;
        }
    }

    private async Task<PayrollRun> TransitionAsync(PayrollRun run, string target, CancellationToken ct) =>
        await UpdateStatusAsync(run, target, ct);

    private Task<PayrollRun> UpdateStatusAsync(PayrollRun run, string target, CancellationToken ct) =>
        _runs.UpdateStatusAsync(run.Id, run.Version, target, ct).ContinueWith(t =>
        {
            if (!t.Result) throw new InvalidOperationException("The payroll run was changed by another user.");
            run.Status = target;
            run.Version++;
            return run;
        }, ct, TaskContinuationOptions.ExecuteSynchronously, TaskScheduler.Default);

    public async Task<PayrollCalculationResult> CalculateEmployeeAsync(Guid runId, Guid employeeId,
        string calculationVersion, CancellationToken ct = default)
    {
        var run = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        var contract = (await _foundation.ListContractsAsync(employeeId, ct))
            .Where(x => x.EffectiveFrom <= run.SalaryTo && (x.EffectiveTo is null || x.EffectiveTo >= run.SalaryFrom))
            .OrderByDescending(x => x.EffectiveFrom).FirstOrDefault()
            ?? throw new InvalidOperationException("The employee has no effective payroll contract.");

        var items = await _configuration.ListItemsAsync(false, ct);
        var versions = new List<PayrollItemVersion>();
        foreach (var item in items) versions.AddRange(await _configuration.ListItemVersionsAsync(item.Id, ct));
        var formulas = await _configuration.ListFormulasAsync(ct);
        var attendance = await _operations.ListAttendanceAsync(run.VariablesFrom, run.VariablesTo, employeeId, ct);
        var adjustments = await _operations.ListAdjustmentsAsync(run.VariablesFrom, run.VariablesTo, employeeId, ct);
        var loans = await _operations.ListLoansAsync(employeeId, ct);

        var inputs = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASE"] = contract.GrossSalary,
            ["GROSS"] = contract.GrossSalary,
            ["WORKED_HOURS"] = attendance.Sum(x => x.WorkedHours),
            ["OVERTIME_HOURS"] = attendance.Sum(x => x.OvertimeHours),
            ["ABSENCE_HOURS"] = attendance.Sum(x => x.AbsenceHours),
            ["ADJUSTMENTS"] = adjustments.Where(x => x.Amount > 0).Sum(x => x.Amount),
            ["LOAN_DEDUCTION"] = loans.Where(x => x.Status is "approved" or "active").Sum(x =>
                x.Installments == 0 ? 0 : Math.Min(x.OutstandingBalance, x.Principal / x.Installments))
        };
        foreach (var adjustment in adjustments.Where(x => x.PayrollItemId is not null))
        {
            var item = items.FirstOrDefault(x => x.Id == adjustment.PayrollItemId.Value);
            if (item is not null) inputs[item.Code] = inputs.GetValueOrDefault(item.Code) + adjustment.Amount;
        }

        var result = _orchestrator.Calculate(new PayrollCalculationRequest
        {
            EmployeeId = employeeId, CurrencyCode = contract.CurrencyCode, Items = items,
            Versions = versions, Formulas = formulas, Inputs = inputs,
            AsOfDate = run.SalaryTo, CalculationVersion = calculationVersion
        });
        await _runs.UpsertResultAsync(new PayrollResult
        {
            Id = Guid.NewGuid(), PayrollRunId = runId, EmployeeId = employeeId,
            CurrencyCode = result.CurrencyCode, GrossAmount = result.GrossAmount,
            DeductionsAmount = result.DeductionsAmount, NetAmount = result.NetAmount,
            CalculationVersion = calculationVersion
        }, ct);
        await _runs.SaveResultDetailsAsync(runId, employeeId, result.Lines.Select(x => new PayrollResultDetail
        {
            Id = Guid.NewGuid(), ItemCode = x.ItemCode, Amount = x.Amount, FormulaReference = x.FormulaCode
        }).ToArray(), ct);
        return result;
    }
}