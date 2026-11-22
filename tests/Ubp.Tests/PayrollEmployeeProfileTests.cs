using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات قواعد اعتماد ملف موظف المرتبات (بند 3.1 و3.3).</summary>
public sealed class PayrollEmployeeProfileTests
{
    private static PayrollEmployeeProfileRow Row() => new()
    {
        EmployeeId = Guid.NewGuid(), Code = "EMP-1", NameAr = "موظف",
        Phone = "01000000000", Status = PayrollEmployeeStatuses.Incomplete
    };

    private static PayrollEmployeeFieldSetting Setting(string code, bool visible, bool required,
        DateOnly? from = null, DateOnly? to = null) => new()
    {
        Id = Guid.NewGuid(), FieldCode = code, IsVisible = visible, IsRequired = required,
        EffectiveFrom = from ?? new DateOnly(2020, 1, 1), EffectiveTo = to
    };

    [Fact]
    public void ApprovalRequiresEngineFieldsEvenWithoutConfiguredSettings()
    {
        var missing = PayrollEmployeeProfileService.MissingRequiredFields(Row(),
            Array.Empty<PayrollEmployeeFieldSetting>(), new DateOnly(2026, 1, 1));

        Assert.Contains("tax_treatment_code", missing);
        Assert.Contains("insurance_status_code", missing);
    }

    [Fact]
    public void FilledEngineFieldsRemoveThemFromMissingList()
    {
        var row = Row();
        row.TaxTreatmentCode = "STANDARD";
        row.InsuranceStatusCode = "INSURED";

        var missing = PayrollEmployeeProfileService.MissingRequiredFields(row,
            Array.Empty<PayrollEmployeeFieldSetting>(), new DateOnly(2026, 1, 1));

        Assert.Empty(missing);
    }

    [Fact]
    public void ConfiguredRequiredFieldBlocksApprovalWhenEmpty()
    {
        var settings = new[] { Setting("national_id", visible: true, required: true) };
        var missing = PayrollEmployeeProfileService.MissingRequiredFields(Row(), settings,
            new DateOnly(2026, 1, 1));

        Assert.Contains("national_id", missing);
    }

    [Fact]
    public void HiddenRequiredSettingIsIgnoredBecauseHiddenAndRequiredIsForbidden()
    {
        var settings = new[] { Setting("passport_number", visible: false, required: true) };
        var missing = PayrollEmployeeProfileService.MissingRequiredFields(Row(), settings,
            new DateOnly(2026, 1, 1));

        Assert.DoesNotContain("passport_number", missing);
    }

    [Fact]
    public void FutureSettingIsNotAppliedYet()
    {
        var settings = new[]
        {
            Setting("national_id", visible: true, required: true, from: new DateOnly(2030, 1, 1))
        };
        var missing = PayrollEmployeeProfileService.MissingRequiredFields(Row(), settings,
            new DateOnly(2026, 1, 1));

        Assert.DoesNotContain("national_id", missing);
    }

    [Fact]
    public void ExpiredSettingStopsApplying()
    {
        var settings = new[]
        {
            Setting("insurance_number", visible: true, required: true,
                from: new DateOnly(2020, 1, 1), to: new DateOnly(2021, 12, 31))
        };
        var missing = PayrollEmployeeProfileService.MissingRequiredFields(Row(), settings,
            new DateOnly(2026, 1, 1));

        Assert.DoesNotContain("insurance_number", missing);
    }
}
