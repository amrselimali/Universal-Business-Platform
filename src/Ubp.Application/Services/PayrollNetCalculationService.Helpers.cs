using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed partial class PayrollNetCalculationService
{
    private async Task<PayrollCalculationBreakdown?> LoadOriginalAsync(Guid runId, Guid employeeId,
        CancellationToken ct, List<string> notes)
    {
        var result = (await _runs.ListResultsAsync(runId, ct)).FirstOrDefault(x => x.EmployeeId == employeeId);
        if (result is null)
        {
            notes.Add("ORIGINAL_RESULT_NOT_FOUND");
            return null;
        }
        var details = await _runs.ListResultDetailsAsync(result.Id, ct);
        return new PayrollCalculationBreakdown
        {
            EmployeeId = employeeId,
            CurrencyCode = result.CurrencyCode,
            GrossAmount = result.GrossAmount,
            DeductionsAmount = result.DeductionsAmount,
            NetAmount = result.NetAmount,
            Lines = details.Select(d => new PayrollCalculationLine
            {
                Code = d.ItemCode, NameAr = d.ItemCode, Amount = d.Amount,
                FormulaCode = d.FormulaReference, Kind = PayrollLineKinds.Informational
            }).ToArray()
        };
    }

    private static IReadOnlyList<PayrollSimulationDifference> BuildDifferences(
        PayrollCalculationBreakdown original, PayrollCalculationBreakdown simulated)
    {
        var originalByCode = original.Lines
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount), StringComparer.OrdinalIgnoreCase);
        var simulatedByCode = simulated.Lines
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount), StringComparer.OrdinalIgnoreCase);

        var rows = new List<PayrollSimulationDifference>();
        void Add(string code, decimal before, decimal after) =>
            rows.Add(new PayrollSimulationDifference { Code = code, Original = before, Simulated = after });

        Add("GROSS", original.GrossAmount, simulated.GrossAmount);
        Add("DEDUCTIONS", original.DeductionsAmount, simulated.DeductionsAmount);
        Add("NET", original.NetAmount, simulated.NetAmount);

        foreach (var code in originalByCode.Keys.Concat(simulatedByCode.Keys).Distinct(StringComparer.OrdinalIgnoreCase)
                     .Where(c => c is not ("EMPLOYER_COST" or "TAX_CREDIT_CARRIED")))
        {
            Add(code, originalByCode.GetValueOrDefault(code), simulatedByCode.GetValueOrDefault(code));
        }
        return rows.OrderBy(x => x.Code).ToArray();
    }

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

    private static bool IsHealthSubject(PayrollEmployeeProfile? profile)
    {
        if (profile is null) return false;
        var code = profile.InsuranceStatusCode?.Trim().ToUpperInvariant();
        return code is not ("NOT_INSURED" or "EXEMPT" or "NONE" or "NO");
    }
}
