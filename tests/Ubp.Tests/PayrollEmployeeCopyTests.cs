using Ubp.Core.Models;
using Ubp.Core.Results;
using Xunit;

namespace Ubp.Tests;

/// <summary>اختبارات معالج نسخ الإعدادات وقوالب الأنشطة (دوال نقية، بلا قاعدة بيانات).</summary>
public sealed class PayrollEmployeeCopyTests
{
    private static readonly DateOnly Today = new(2026, 1, 20);

    private static PayrollEmployeeProfile SourceProfile() => new()
    {
        EmployeeId = Guid.NewGuid(), Status = PayrollEmployeeStatuses.Approved,
        NationalId = "29001010101234", PassportNumber = "P1234567", InsuranceNumber = "INS-778",
        TaxTreatmentCode = "SALARIED", InsuranceStatusCode = "INSURED", NationalityCode = "EG",
        WorkPermitStatus = "valid", WorkingHoursPerMonth = 208, TimeManagementEnabled = true,
        NonWorkingWives = 2, Dependents = 3, SalarySuspended = true,
        ServiceEndDate = new DateOnly(2026, 3, 31)
    };

    private static PayrollEmployeeContract Contract(bool approved = true) => new()
    {
        Id = Guid.NewGuid(), EmployeeId = Guid.NewGuid(), EffectiveFrom = new DateOnly(2025, 1, 1),
        CurrencyCode = "EGP", GrossSalary = 12000m, InsurableSalary = 10000m, IsApproved = approved
    };

    private static PayrollEmployeeCopyPlan Plan(PayrollEmployeeCopyOptions? options = null,
        IReadOnlyList<PayrollEmployeeContract>? contracts = null) =>
        PayrollEmployeeCopyPlanner.Plan(Guid.NewGuid(), Guid.NewGuid(), SourceProfile(),
            contracts ?? new[] { Contract() }, options ?? new PayrollEmployeeCopyOptions(), Today);

    [Fact]
    public void CopyingOntoSameEmployeeIsRejected()
    {
        var id = Guid.NewGuid();
        var error = Assert.Throws<ValidationAppException>(() => PayrollEmployeeCopyPlanner.Plan(
            id, id, SourceProfile(), Array.Empty<PayrollEmployeeContract>(),
            new PayrollEmployeeCopyOptions(), Today));

        Assert.Equal("validation.payroll_copy_same_employee", error.Code);
    }

    [Fact]
    public void SensitiveIdentifiersAreNotCopiedByDefault()
    {
        var plan = Plan();

        Assert.False(plan.RequiresSensitivePermission);
        Assert.Equal("***", plan.Fields.Single(x => x.Name == "national_id").SourceValue);
        Assert.Null(plan.Profile!.NationalId);
        Assert.Null(plan.Profile.InsuranceNumber);
    }

    [Fact]
    public void SensitiveIdentifiersCopyOnlyWhenRequestedAndThenRequirePermission()
    {
        var plan = Plan(new PayrollEmployeeCopyOptions { CopyPersonalIdentifiers = true });

        Assert.True(plan.RequiresSensitivePermission);
        Assert.Equal("29001010101234", plan.Profile!.NationalId);
    }

    [Fact]
    public void EmploymentStateIsNeverCopied()
    {
        var plan = Plan();

        Assert.Equal(PayrollEmployeeStatuses.Incomplete, plan.Profile!.Status);
        Assert.False(plan.Profile.SalarySuspended);
        Assert.Null(plan.Profile.ServiceEndDate);
        Assert.Contains(PayrollEmployeeCopyPlanner.WarningStateNotCopied, plan.Warnings);
    }

    [Fact]
    public void FamilyDataRequiresExplicitOptIn()
    {
        Assert.Equal(0, Plan().Profile!.Dependents);

        var withFamily = Plan(new PayrollEmployeeCopyOptions { CopyFamilyData = true });
        Assert.Equal(3, withFamily.Profile!.Dependents);
        Assert.Equal(2, withFamily.Profile.NonWorkingWives);
    }

    [Fact]
    public void ClassificationAndEmploymentSettingsAreCopiedByDefault()
    {
        var plan = Plan();

        Assert.Equal("SALARIED", plan.Profile!.TaxTreatmentCode);
        Assert.Equal("INSURED", plan.Profile.InsuranceStatusCode);
        Assert.Equal(208, plan.Profile.WorkingHoursPerMonth);
        Assert.True(plan.Profile.TimeManagementEnabled);
    }

    [Fact]
    public void ContractIsCopiedAsUnapprovedWithOptionalSalaryOverride()
    {
        var plan = Plan(new PayrollEmployeeCopyOptions { SalaryOverride = 9000m });

        Assert.NotNull(plan.Contract);
        Assert.False(plan.Contract!.IsApproved);
        Assert.Equal(9000m, plan.Contract.GrossSalary);
        Assert.Equal(9000m, plan.Contract.InsurableSalary);
        Assert.Equal(Today, plan.Contract.EffectiveFrom);
        Assert.Equal("EGP", plan.Contract.CurrencyCode);
    }

    [Fact]
    public void WithoutApprovedContractANewContractIsNotCreated()
    {
        var plan = Plan(contracts: new[] { Contract(approved: false) });

        Assert.Null(plan.Contract);
        Assert.Contains(PayrollEmployeeCopyPlanner.WarningNoApprovedContract, plan.Warnings);
    }

    [Fact]
    public void MissingSourceProfileProducesAWarningAndNoFields()
    {
        var plan = PayrollEmployeeCopyPlanner.Plan(Guid.NewGuid(), Guid.NewGuid(), null,
            Array.Empty<PayrollEmployeeContract>(), new PayrollEmployeeCopyOptions(), Today);

        Assert.Empty(plan.Fields);
        Assert.Null(plan.Profile);
        Assert.Contains(PayrollEmployeeCopyPlanner.WarningSourceProfileMissing, plan.Warnings);
    }

    [Fact]
    public void ActivityTemplatesAreCompleteAndConsistent()
    {
        var templates = PayrollActivityTemplates.All;

        Assert.Equal(3, templates.Count);
        Assert.All(templates, template =>
        {
            Assert.NotEmpty(template.Items);
            Assert.All(template.Items, item =>
            {
                Assert.False(string.IsNullOrWhiteSpace(item.Code));
                Assert.False(string.IsNullOrWhiteSpace(item.NameAr));
                Assert.Contains(item.CategoryCode, new[] { "earning", "deduction" });
                if (item.CategoryCode == "deduction") Assert.False(item.IsTaxable);
            });
            Assert.Equal(template.Items.Select(x => x.Code).Distinct().Count(), template.Items.Count);
        });
    }

    [Fact]
    public void TemplateLookupIsCaseInsensitiveAndUnknownReturnsNull()
    {
        Assert.NotNull(PayrollActivityTemplates.Get("clinic"));
        Assert.NotNull(PayrollActivityTemplates.Get(PayrollActivityTemplates.Manufacturing));
        Assert.Null(PayrollActivityTemplates.Get("SPACE_STATION"));
    }
}
