using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public enum PayrollAdjustmentOutcome
{
    Skipped = 0,
    Calculated = 1,
    Failed = 2
}

public sealed partial class PayrollRunCalculationService
{
    /// <summary>
    /// مسار دورة التسوية (بند 12.3): لا راتب أساسي، لا حضور، لا أرصدة قانونية جديدة.
    /// الموظف يُحسب فقط إن كان لديه حركة تسوية فعلية داخل نافذة المتغيرات.
    /// </summary>
    private async Task<PayrollAdjustmentOutcome> CalculateAdjustmentRunEmployeeAsync(PayrollRun run,
        Employee employee, DateOnly cutoffDate, string calculationVersion, ActorContext? actor,
        Guid runId, CancellationToken ct)
    {
        if (!employee.IsActive)
        {
            await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1, PayrollRunEmployeeStatuses.Skipped,
                employee.BranchId, null, calculationVersion, "PAYROLL_EMPLOYEE_NOT_ACTIVE", ct);
            return PayrollAdjustmentOutcome.Skipped;
        }

        var adjustments = await _operations.ListAdjustmentsAsync(run.VariablesFrom, cutoffDate,
            employee.Id, ct);
        var result = PayrollAdjustmentEngine.Calculate(adjustments);
        if (!result.HasAmounts)
        {
            await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1, PayrollRunEmployeeStatuses.Skipped,
                employee.BranchId, null, calculationVersion, "PAYROLL_ADJUSTMENT_NO_LINES", ct);
            return PayrollAdjustmentOutcome.Skipped;
        }

        await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1, PayrollRunEmployeeStatuses.Calculating,
            employee.BranchId, null, calculationVersion, null, ct);
        try
        {
            await PersistAdjustmentResultAsync(run, employee, result, calculationVersion, ct);
            await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1, PayrollRunEmployeeStatuses.Calculated,
                employee.BranchId, null, calculationVersion, null, ct);
            if (actor is not null)
                await _audit.WriteAsync(actor, "payroll_run_results", $"{run.Id}:{employee.Id}",
                    "ADJUSTMENT_CALCULATE", null, new
                    {
                        employee_id = employee.Id, gross = result.GrossAmount,
                        deductions = result.DeductionsAmount, net = result.NetAmount,
                        lines = result.Lines.Count, version = calculationVersion
                    }, ct);
            return PayrollAdjustmentOutcome.Calculated;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1, PayrollRunEmployeeStatuses.Failed,
                employee.BranchId, null, calculationVersion, ErrorCodeOf(ex), ct);
            await AddIssueAsync(runId, PayrollIssueSeverities.Blocking,
                "PAYROLL_EMPLOYEE_CALCULATION_FAILED", $"Employee {employee.Code}: {ex.Message}", ct);
            return PayrollAdjustmentOutcome.Failed;
        }
    }

    /// <summary>يحفظ نتيجة التسوية: المبالغ في payroll_results، والسطور في payroll_result_details.</summary>
    private async Task PersistAdjustmentResultAsync(PayrollRun run, Employee employee,
        PayrollAdjustmentResult result, string calculationVersion, CancellationToken ct)
    {
        var currency = await ResolveCurrencyAsync(employee.Id, ct);
        await _runs.UpsertResultAsync(new PayrollResult
        {
            Id = Guid.NewGuid(), PayrollRunId = run.Id, EmployeeId = employee.Id,
            CurrencyCode = currency, GrossAmount = result.GrossAmount,
            DeductionsAmount = result.DeductionsAmount, NetAmount = result.NetAmount,
            CalculationVersion = calculationVersion
        }, ct);

        var details = result.Lines.Select(line => new PayrollResultDetail
        {
            Id = Guid.NewGuid(),
            ItemCode = line.PayrollItemId is { } itemId ? $"ADJUSTMENT:{itemId}" : "ADJUSTMENT",
            Amount = line.Amount,
            FormulaReference = $"adjustment:{line.AdjustmentId}"
        }).ToList();
        await _runs.SaveResultDetailsAsync(run.Id, employee.Id, details, ct);
    }

    /// <summary>عملة الدورة: أحدث عقد للموظف، وإلا يُرفع سبب صريح بدل عملة مفترضة.</summary>
    private async Task<string> ResolveCurrencyAsync(Guid employeeId, CancellationToken ct)
    {
        var contract = (await _foundation.ListContractsAsync(employeeId, ct))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(contract?.CurrencyCode)) return contract!.CurrencyCode!;
        throw new InvalidOperationException("PAYROLL_CURRENCY_MISSING");
    }
}
