using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// توزيع تكلفة المرتب على الفروع حسب أيام العمل الفعلية (بند 3.2 وملحق ب.2)،
/// ثم على مراكز التكلفة داخل كل فرع بنسب مجموعها 100% — مع تقريب حتمي بلا فقد أو خلق مبالغ.
/// </summary>
public sealed class PayrollAllocationService
{
    private readonly IPayrollAllocationRepository _repository;

    public PayrollAllocationService(IPayrollAllocationRepository repository) => _repository = repository;

    public Task<IReadOnlyList<PayrollBranchCostAllocation>> ListAsync(Guid runId, Guid employeeId,
        CancellationToken ct = default) => _repository.ListAsync(runId, employeeId, ct);

    public async Task SaveForEmployeeAsync(Guid runId, Guid companyId, Guid employeeId,
        Guid? defaultBranchId, DateOnly from, DateOnly to, IReadOnlyCollection<DateOnly> attendedDates,
        decimal grossCost, decimal employerContribution, CancellationToken ct = default)
    {
        var runEmployeeId = await _repository.GetRunEmployeeIdAsync(runId, employeeId, 1, ct);
        if (runEmployeeId is null) return;

        var assignments = await _repository.ListAssignmentsAsync(employeeId, from, to, ct);
        var dates = attendedDates.Count > 0 ? attendedDates : AllDates(from, to);
        var perBranchDays = CountDaysPerBranch(dates, assignments, defaultBranchId);
        var lines = SplitByDays(perBranchDays, grossCost, employerContribution).ToList();
        foreach (var line in lines) line.EmployeeId = employeeId;

        var centers = new List<PayrollCostCenterSplit>();
        foreach (var line in lines)
        {
            var branchCenters = await _repository.ListCostCentersAsync(employeeId, line.BranchId, to, ct);
            if (branchCenters.Count == 0) continue;
            centers.AddRange(SplitByRatio(branchCenters, line.BranchId, line.TotalCost));
        }

        await _repository.ReplaceAllocationsAsync(companyId, runEmployeeId.Value, lines, centers, ct);
    }

    /// <summary>تقسيم المبالغ على الفروع بالنسبة لأيام العمل — دالة نقية قابلة للاختبار.</summary>
    public static IReadOnlyList<PayrollBranchCostAllocation> SplitByDays(
        IReadOnlyDictionary<Guid, int> daysPerBranch, decimal grossCost, decimal employerContribution)
    {
        var totalDays = daysPerBranch.Values.Sum();
        var ordered = daysPerBranch.OrderBy(x => x.Key).ToList();
        if (ordered.Count == 0) return Array.Empty<PayrollBranchCostAllocation>();

        var ratios = new List<(Guid BranchId, int Days, decimal Ratio)>();
        var used = 0m;
        for (var i = 0; i < ordered.Count; i++)
        {
            var ratio = totalDays == 0
                ? (i == ordered.Count - 1 ? 1m - used : decimal.Round(1m / ordered.Count, 8))
                : (i == ordered.Count - 1
                    ? 1m - used
                    : decimal.Round((decimal)ordered[i].Value / totalDays, 8));
            used += ratio;
            ratios.Add((ordered[i].Key, ordered[i].Value, ratio));
        }

        var totalCost = grossCost + employerContribution;
        var grossParts = SplitAmount(grossCost, ratios.Select(r => r.Ratio).ToArray());
        var employerParts = SplitAmount(employerContribution, ratios.Select(r => r.Ratio).ToArray());
        var totalParts = SplitAmount(totalCost, ratios.Select(r => r.Ratio).ToArray());

        return ratios.Select((r, i) => new PayrollBranchCostAllocation
        {
            BranchId = r.BranchId,
            WorkDays = r.Days,
            AllocationBasis = "work_days",
            AllocationRatio = r.Ratio,
            GrossCost = grossParts[i],
            EmployerContribution = employerParts[i],
            TotalCost = totalParts[i]
        }).ToArray();
    }

    /// <summary>تقسيم مبلغ على نسب مع تقريب لأقرب قرش وتصفية الفرق في آخر جزء.</summary>
    public static decimal[] SplitAmount(decimal total, IReadOnlyList<decimal> ratios)
    {
        var parts = new decimal[ratios.Count];
        var assigned = 0m;
        for (var i = 0; i < ratios.Count; i++)
        {
            var value = i == ratios.Count - 1
                ? total - assigned
                : decimal.Round(total * ratios[i], 2, MidpointRounding.AwayFromZero);
            parts[i] = value;
            assigned += value;
        }
        return parts;
    }

    /// <summary>توزيع مبلغ الفرع على مراكز التكلفة بنسب مجموعها 100% بعد التطبيع.</summary>
    public static IReadOnlyList<PayrollCostCenterSplit> SplitByRatio(
        IReadOnlyList<PayrollCostCenterSplit> centers, Guid branchId, decimal branchTotal)
    {
        var sum = centers.Sum(c => c.AllocationRatio);
        if (sum <= 0) return Array.Empty<PayrollCostCenterSplit>();

        var normalized = centers
            .Select(c => (c.CostCenterId, Ratio: decimal.Round(c.AllocationRatio / sum, 8)))
            .ToList();
        var roundedSum = normalized.Sum(x => x.Ratio);
        normalized[^1] = (normalized[^1].CostCenterId, normalized[^1].Ratio + (1m - roundedSum));

        var amounts = SplitAmount(branchTotal, normalized.Select(x => x.Ratio).ToArray());
        return normalized.Select((x, i) => new PayrollCostCenterSplit
        {
            BranchId = branchId,
            CostCenterId = x.CostCenterId,
            AllocationRatio = x.Ratio,
            AllocatedAmount = amounts[i]
        }).ToArray();
    }

    /// <summary>عدّ أيام العمل المنسوبة لكل فرع: أول إسناد ساري في اليوم، وإلا الفرع الافتراضي.</summary>
    public static Dictionary<Guid, int> CountDaysPerBranch(IReadOnlyCollection<DateOnly> dates,
        IReadOnlyList<EmployeeBranchAssignment> assignments, Guid? defaultBranchId)
    {
        var counts = new Dictionary<Guid, int>();
        foreach (var date in dates.Distinct())
        {
            var assignment = assignments.FirstOrDefault(a =>
                a.EffectiveFrom <= date && (a.EffectiveTo is null || a.EffectiveTo >= date));
            var branchId = assignment?.BranchId ?? defaultBranchId;
            if (branchId is null) continue;
            counts[branchId.Value] = counts.GetValueOrDefault(branchId.Value) + 1;
        }
        return counts;
    }

    private static List<DateOnly> AllDates(DateOnly from, DateOnly to)
    {
        var list = new List<DateOnly>();
        for (var date = from; date <= to; date = date.AddDays(1)) list.Add(date);
        return list;
    }
}
