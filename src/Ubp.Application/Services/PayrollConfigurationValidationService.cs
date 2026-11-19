using Ubp.Core.Models;

namespace Ubp.Application.Services;

public sealed class PayrollConfigurationValidationService
{
    public IReadOnlyList<string> ValidateFieldSettings(IReadOnlyCollection<PayrollEmployeeFieldSetting> settings)
    {
        var errors = new List<string>();
        foreach (var setting in settings)
        {
            if (string.IsNullOrWhiteSpace(setting.FieldCode))
                errors.Add("Employee field code is required.");
            if (!setting.IsVisible && setting.IsRequired)
                errors.Add($"Field '{setting.FieldCode}' cannot be hidden and required.");
            if (setting.EffectiveTo is not null && setting.EffectiveTo < setting.EffectiveFrom)
                errors.Add($"Field '{setting.FieldCode}' has an invalid effective range.");
        }
        errors.AddRange(FindOverlaps(settings, x => x.FieldCode, "Employee field"));
        return errors;
    }

    public IReadOnlyList<string> ValidateContracts(IReadOnlyCollection<PayrollEmployeeContract> contracts)
    {
        var errors = new List<string>();
        foreach (var contract in contracts)
        {
            if (string.IsNullOrWhiteSpace(contract.CurrencyCode))
                errors.Add($"Contract '{contract.Id}' requires a currency.");
            if (contract.GrossSalary < 0 || contract.InsurableSalary < 0)
                errors.Add($"Contract '{contract.Id}' contains a negative salary.");
            if (contract.EffectiveTo is not null && contract.EffectiveTo < contract.EffectiveFrom)
                errors.Add($"Contract '{contract.Id}' has an invalid effective range.");
        }
        errors.AddRange(FindOverlaps(contracts, x => x.EmployeeId, "Employee contract"));
        return errors;
    }

    public IReadOnlyList<string> ValidateCostCenterAllocations(
        IReadOnlyCollection<PayrollCostCenterAllocation> allocations)
    {
        var errors = new List<string>();
        foreach (var group in allocations.GroupBy(x => new { x.EmployeeId, x.EffectiveFrom }))
        {
            var total = group.Sum(x => x.AllocationPercent);
            if (total != 100m)
                errors.Add($"Cost-center allocation for employee '{group.Key.EmployeeId}' at {group.Key.EffectiveFrom} must equal 100%; actual {total}%." );
        }
        return errors;
    }

    public IReadOnlyList<string> ValidatePaymentSettings(
        IReadOnlyCollection<PayrollPaymentSetting> settings)
    {
        var errors = new List<string>();
        foreach (var group in settings.GroupBy(x => new { x.EmployeeId, x.EffectiveFrom }))
        {
            var hasAmounts = group.Any(x => x.Amount is not null);
            var hasPercentages = group.Any(x => x.Percentage is not null);
            if (hasAmounts && hasPercentages)
                errors.Add($"Payment settings for employee '{group.Key.EmployeeId}' cannot mix amounts and percentages.");
            if (hasPercentages && group.Sum(x => x.Percentage ?? 0) != 100m)
                errors.Add($"Payment percentages for employee '{group.Key.EmployeeId}' must equal 100%.");
            if (group.Any(x => x.Amount < 0 || x.Percentage is < 0 or > 100))
                errors.Add($"Payment settings for employee '{group.Key.EmployeeId}' contain an invalid value.");
        }
        return errors;
    }

    private static IReadOnlyList<string> FindOverlaps<T>(IEnumerable<T> values,
        Func<T, object> keySelector, string description) where T : class
    {
        var errors = new List<string>();
        var items = values.ToList();
        foreach (var group in items.GroupBy(keySelector))
        {
            for (var i = 0; i < group.Count(); i++)
            for (var j = i + 1; j < group.Count(); j++)
            {
                var left = group.ElementAt(i);
                var right = group.ElementAt(j);
                var leftFrom = (DateOnly)left.GetType().GetProperty("EffectiveFrom")!.GetValue(left)!;
                var leftTo = (DateOnly?)left.GetType().GetProperty("EffectiveTo")!.GetValue(left) ?? DateOnly.MaxValue;
                var rightFrom = (DateOnly)right.GetType().GetProperty("EffectiveFrom")!.GetValue(right)!;
                var rightTo = (DateOnly?)right.GetType().GetProperty("EffectiveTo")!.GetValue(right) ?? DateOnly.MaxValue;
                if (leftFrom <= rightTo && rightFrom <= leftTo)
                    errors.Add($"{description} entries for '{group.Key}' have overlapping effective ranges.");
            }
        }
        return errors;
    }
}
