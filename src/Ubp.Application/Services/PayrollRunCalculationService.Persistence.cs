using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed partial class PayrollRunCalculationService
{
    private async Task PersistResultAsync(PayrollRun run, Employee employee,
        PayrollCalculationBreakdown breakdown, string calculationVersion, CancellationToken ct)
    {
        await _runs.UpsertResultAsync(new PayrollResult
        {
            Id = Guid.NewGuid(), PayrollRunId = run.Id, EmployeeId = employee.Id,
            CurrencyCode = breakdown.CurrencyCode, GrossAmount = breakdown.GrossAmount,
            DeductionsAmount = breakdown.DeductionsAmount, NetAmount = breakdown.NetAmount,
            CalculationVersion = calculationVersion
        }, ct);

        var details = breakdown.Lines.Select(line => new PayrollResultDetail
        {
            Id = Guid.NewGuid(), ItemCode = line.Code, Amount = line.Amount,
            FormulaReference = line.FormulaCode ?? line.Explanation
        }).ToList();
        details.Add(new PayrollResultDetail
        {
            Id = Guid.NewGuid(), ItemCode = "EMPLOYER_COST", Amount = breakdown.EmployerCost,
            FormulaReference = "gross+employer_insurance+employer_health+borne"
        });
        if (breakdown.TaxCreditBalance > 0)
            details.Add(new PayrollResultDetail
            {
                Id = Guid.NewGuid(), ItemCode = "TAX_CREDIT_CARRIED", Amount = breakdown.TaxCreditBalance,
                FormulaReference = "carry-forward"
            });
        // الأوعية تُثبَّت في السطور ليمكن إخراج تقرير التأمين لكل دورة بلا الاعتماد على الأرصدة التراكمية.
        if (breakdown.InsurableBase > 0)
            details.Add(new PayrollResultDetail
            {
                Id = Guid.NewGuid(), ItemCode = "INSURABLE_BASE", Amount = breakdown.InsurableBase,
                FormulaReference = "insurance-basis"
            });
        if (breakdown.HealthInsuranceBasis > 0)
            details.Add(new PayrollResultDetail
            {
                Id = Guid.NewGuid(), ItemCode = "HEALTH_INSURANCE_BASE", Amount = breakdown.HealthInsuranceBasis,
                FormulaReference = "health-insurance-basis"
            });
        await _runs.SaveResultDetailsAsync(run.Id, employee.Id, details, ct);
    }

    /// <summary>
    /// يحفظ الرصيد التراكمي وحركات الضريبة، وحصص التأمين الاجتماعي والصحي.
    /// الترتيب يضمن Idempotency: الحركات القديمة لنفس الدورة تُحذف قبل الحساب (في CalculateEmployeeAsync)
    /// ثم تُعاد كتابتها هنا، فلا تتضاعف الأرصدة عند إعادة الحساب.
    /// </summary>
    private async Task PersistStatutoryAsync(PayrollRun run, Employee employee, Guid companyId,
        PayrollTaxPeriodKey period, string scopeType, Guid? taxBranchId,
        PayrollInsurancePolicy? insurancePolicy, PayrollHealthInsuranceRule? healthRule,
        bool healthApplicable, PayrollCalculationBreakdown breakdown, PayrollTaxBalance? previous, CancellationToken ct)
    {
        var balance = new PayrollTaxBalance
        {
            CompanyId = companyId,
            TaxPeriodId = period.TaxPeriodId,
            EmployeeId = employee.Id,
            ScopeType = scopeType,
            BranchId = taxBranchId,
            TaxableIncomeYtd = breakdown.TaxableIncomeYtd,
            TaxDueYtd = breakdown.TaxCumulativeDue,
            TaxWithheldYtd = breakdown.TaxPreviouslyWithheld + breakdown.TaxCurrent,
            CreditBalance = breakdown.TaxCreditBalance,
            LastRunId = run.Id,
            RowVersion = previous?.RowVersion ?? 0
        };
        await _statutory.SaveTaxBalanceAsync(balance, ct);
        await _statutory.ReplaceTaxTransactionsAsync(run.Id, employee.Id, period.TaxPeriodId,
            scopeType, taxBranchId, breakdown.TaxableIncome, breakdown.TaxCumulativeDue,
            breakdown.TaxCurrent, period.TaxYearCode, ct);

        var social = new InsuranceContributions(breakdown.InsurableBase,
            breakdown.EmployeeInsurance, breakdown.EmployerInsurance);
        var health = new InsuranceContributions(breakdown.HealthInsuranceBasis,
            breakdown.EmployeeHealthInsurance, breakdown.EmployerHealthInsurance);
        await _statutory.ReplaceInsuranceBalancesAsync(run.Id, companyId, employee.Id, employee.BranchId,
            scopeType, insurancePolicy, social, healthApplicable ? healthRule : null, health,
            period.From, ct);
    }

    private async Task AuditEmployeeAsync(ActorContext? actor, PayrollRun run, Employee employee,
        PayrollCalculationBreakdown breakdown, string calculationVersion, CancellationToken ct)
    {
        if (actor is null) return;
        await _audit.WriteAsync(actor, "payroll_run_results", $"{run.Id}:{employee.Id}", "CALCULATE",
            null, new
            {
                employee_id = employee.Id,
                gross = breakdown.GrossAmount,
                net = breakdown.NetAmount,
                tax = breakdown.TaxCurrent,
                insurance = breakdown.EmployeeInsurance,
                health = breakdown.EmployeeHealthInsurance,
                employer_cost = breakdown.EmployerCost,
                tax_policy = breakdown.TaxPolicyCode,
                insurance_policy = breakdown.InsurancePolicyCode,
                health_rule = breakdown.HealthRuleCode,
                version = calculationVersion
            }, ct);
    }

    /// <summary>مدخلات البنود: الأساس + الحضور + التسويات (مرتبطة بالبند إن وُجد) + قسط السلفة.</summary>
    private static Dictionary<string, decimal> BuildInputs(decimal gross, IReadOnlyList<PayrollItem> items,
        IReadOnlyList<PayrollAttendanceDaily> attendance, IReadOnlyList<PayrollAdjustment> adjustments,
        IReadOnlyList<EmployeeLoan> loans)
    {
        var inputs = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASE"] = gross,
            ["GROSS"] = gross,
            ["CONTRACT_GROSS"] = gross,
            ["WORKED_HOURS"] = attendance.Sum(x => x.WorkedHours),
            ["OVERTIME_HOURS"] = attendance.Sum(x => x.OvertimeHours),
            ["ABSENCE_HOURS"] = attendance.Sum(x => x.AbsenceHours),
            ["ADJUSTMENTS"] = adjustments.Where(x => x.Amount > 0).Sum(x => x.Amount),
            ["DEDUCTIONS"] = adjustments.Where(x => x.Amount < 0).Sum(x => -x.Amount),
            ["LOAN_DEDUCTION"] = loans
                .Where(x => x.Status is "approved" or "active")
                .Sum(x => x.Installments == 0
                    ? 0m
                    : Math.Min(x.OutstandingBalance, x.Principal / x.Installments))
        };

        foreach (var adjustment in adjustments.Where(x => x.PayrollItemId is not null))
        {
            var item = items.FirstOrDefault(x => x.Id == adjustment.PayrollItemId!.Value);
            if (item is null) continue;
            inputs[item.Code] = inputs.GetValueOrDefault(item.Code) + adjustment.Amount;
        }
        return inputs;
    }

    /// <summary>
    /// خضوع التأمين الصحي: لا يوجد عمود مستقل في ملف الموظف، لذلك يُستنتج من الحالة التأمينية:
    /// الموظف خاضع إلا إذا كانت حالته صريحة (NOT_INSURED/EXEMPT/NONE/NO).
    /// </summary>
    private static bool IsHealthSubject(PayrollEmployeeProfile? profile)
    {
        if (profile is null) return false;
        var code = profile.InsuranceStatusCode?.Trim().ToUpperInvariant();
        return code is not ("NOT_INSURED" or "EXEMPT" or "NONE" or "NO");
    }
}
