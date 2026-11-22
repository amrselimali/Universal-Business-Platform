using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed record PayrollRunCalculationSummary(Guid PayrollRunId, int EmployeeCount,
    int CalculatedCount, int SkippedCount, int FailedCount, int BlockingIssueCount, string Status);

/// <summary>
/// تشغيل حساب دورة مرتبات: تحديد النطاق (فروع/موظفون معتمدون)، ثم حساب كل موظف بمحركات
/// الضريبة والتأمينات والتأمين الصحي، وحفظ النتائج والأرصدة والحركات.
/// خطأ موظف واحد لا يُسقط الدورة: يُسجَّل كملاحظة مانعة ويستمر الباقون.
/// </summary>
public sealed partial class PayrollRunCalculationService
{
    private const int BatchSize = 50;

    private readonly IPayrollRunRepository _runs;
    private readonly IPayrollFoundationRepository _foundation;
    private readonly IPayrollConfigurationRepository _configuration;
    private readonly IPayrollOperationsRepository _operations;
    private readonly IPayrollStatutoryRepository _statutory;
    private readonly IPayrollOpeningBalanceRepository _openingBalances;
    private readonly IEmployeeRepository _employees;
    private readonly PayrollEmployeeCalculator _calculator;
    private readonly PayrollAllocationService _allocations;
    private readonly PayrollAuditWriter _audit;

    public PayrollRunCalculationService(IPayrollRunRepository runs,
        IPayrollFoundationRepository foundation,
        IPayrollConfigurationRepository configuration,
        IPayrollOperationsRepository operations,
        IPayrollStatutoryRepository statutory,
        IPayrollOpeningBalanceRepository openingBalances,
        IEmployeeRepository employees,
        PayrollEmployeeCalculator calculator,
        PayrollAllocationService allocations,
        PayrollAuditWriter audit)
    {
        _runs = runs;
        _foundation = foundation;
        _configuration = configuration;
        _operations = operations;
        _statutory = statutory;
        _openingBalances = openingBalances;
        _employees = employees;
        _calculator = calculator;
        _allocations = allocations;
        _audit = audit;
    }

    public async Task<PayrollRunCalculationSummary> CalculateRunAsync(Guid runId,
        string calculationVersion, ActorContext? actor = null,
        IReadOnlyCollection<Guid>? branchIds = null, CancellationToken ct = default)
    {
        var run = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (run.Status is PayrollRunStatuses.Approved or PayrollRunStatuses.Posted
            or PayrollRunStatuses.Paid or PayrollRunStatuses.Closed)
            throw new InvalidOperationException("PAYROLL_RUN_LOCKED");

        var calculating = await TransitionAsync(run, PayrollRunStatuses.Calculating, ct);
        await _runs.ClearIssuesAsync(runId, ct);
        await _runs.ResetRunEmployeesAsync(runId, ct);

        var scope = actor is null ? (branchIds ?? Array.Empty<Guid>()) : BranchScope.Resolve(actor, branchIds);
        var allBranches = actor is null ? scope.Count == 0 : actor.IsSuperAdmin && scope.Count == 0;
        var employees = await _employees.ListActiveOptionsAsync(scope, allBranches, ct);

        var companyId = await _statutory.GetCompanyIdAsync(ct);
        var items = await _configuration.ListItemsAsync(false, ct);
        var versions = new List<PayrollItemVersion>();
        foreach (var item in items) versions.AddRange(await _configuration.ListItemVersionsAsync(item.Id, ct));
        var formulas = await _configuration.ListFormulasAsync(ct);
        var taxPolicy = await _statutory.GetTaxPolicyAsync(run.SalaryTo, ct);
        var exemptions = await _statutory.ListTaxExemptionsAsync(run.SalaryTo, ct);
        var healthRule = await _statutory.GetHealthInsuranceRuleAsync(run.SalaryTo, ct);
        var taxSettings = await _statutory.GetTaxSettingsAsync(companyId, run.SalaryTo.Year.ToString("D4"),
            run.SalaryTo, ct);
        var grossUpRules = (await _statutory.ListGrossUpRulesAsync(companyId, run.SalaryTo, ct))
            .GroupBy(x => x.PayrollItemId).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).First());
        // نافذة القراءة تُقصّ عند لحظة القطع ولا تُنشئ نافذة مقلوبة (PayrollWindow).
        var cutoffDate = PayrollWindow.ClampTo(run.VariablesFrom, run.VariablesTo, run.CutoffAt);

        var calculated = 0;
        var skipped = 0;
        var failed = 0;

        foreach (var batch in employees.Chunk(BatchSize))
        {
            foreach (var employee in batch)
            {
                if (PayrollRunTypes.IsAdjustment(run.RunType))
                {
                    var outcome = await CalculateAdjustmentRunEmployeeAsync(run, employee, cutoffDate,
                        calculationVersion, actor, runId, ct);
                    if (outcome == PayrollAdjustmentOutcome.Skipped) skipped++;
                    else if (outcome == PayrollAdjustmentOutcome.Calculated) calculated++;
                    else failed++;
                    continue;
                }

                var skipReason = await SkipReasonAsync(employee, run, ct);
                if (skipReason is not null)
                {
                    skipped++;
                    await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1,
                        PayrollRunEmployeeStatuses.Skipped, employee.BranchId, null,
                        calculationVersion, skipReason, ct);
                    if (skipReason != "PAYROLL_EMPLOYEE_NOT_ACTIVE")
                        await AddIssueAsync(runId, PayrollIssueSeverities.Warning, skipReason,
                            $"Employee {employee.Code} skipped: {skipReason}", ct);
                    continue;
                }

                await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1,
                    PayrollRunEmployeeStatuses.Calculating, employee.BranchId, null,
                    calculationVersion, null, ct);
                try
                {
                    await CalculateEmployeeAsync(run, employee, companyId, items, versions, formulas,
                        taxPolicy, exemptions, healthRule, taxSettings, grossUpRules, cutoffDate,
                        calculationVersion, actor, ct);
                    calculated++;
                    await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1,
                        PayrollRunEmployeeStatuses.Calculated, employee.BranchId, null,
                        calculationVersion, null, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    failed++;
                    await _runs.UpsertRunEmployeeAsync(runId, employee.Id, 1,
                        PayrollRunEmployeeStatuses.Failed, employee.BranchId, null,
                        calculationVersion, ErrorCodeOf(ex), ct);
                    await AddIssueAsync(runId, PayrollIssueSeverities.Blocking,
                        "PAYROLL_EMPLOYEE_CALCULATION_FAILED",
                        $"Employee {employee.Code}: {ex.Message}", ct);
                }
            }
        }

        var totals = await _runs.GetTotalsAsync(runId, ct);
        var target = totals.BlockingIssueCount > 0
            ? PayrollRunStatuses.NeedsCorrection
            : PayrollRunStatuses.Calculated;
        var current = await _runs.GetAsync(runId, ct) ?? calculating;
        var finalStatus = await TransitionAsync(current, target, ct);

        if (actor is not null)
            await _audit.WriteAsync(actor, "payroll_runs", runId.ToString(), "CALCULATE", null, new
            {
                run_id = runId, version = calculationVersion, calculated, skipped, failed,
                blocking = totals.BlockingIssueCount, totals.NetAmount
            }, ct);

        return new PayrollRunCalculationSummary(runId, employees.Count, calculated, skipped, failed,
            totals.BlockingIssueCount, finalStatus.Status);
    }

    /// <summary>كود خطأ مختصر لتسجيله في سجل تنفيذ الموظف بدون تفاصيل تقنية حساسة.</summary>
    private static string ErrorCodeOf(Exception ex) =>
        ex.Message.StartsWith("PAYROLL_", StringComparison.OrdinalIgnoreCase)
            ? ex.Message.Split(' ')[0]
            : ex.GetType().Name.ToUpperInvariant();
}
