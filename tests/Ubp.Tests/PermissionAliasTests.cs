using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// توحيد أسماء الصلاحيات مع المواصفة (payroll.view … payroll.export): التغطية الكاملة والربط الفعلي
/// دون كسر الصلاحيات الحالية على مستوى الشاشة.
/// </summary>
public sealed class PermissionAliasTests
{
    private static PermissionEntry Grant(string screen, string action, short scope = 1) => new()
    {
        ScreenCode = screen, ActionCode = action, IsAllowed = true, Scope = scope
    };

    private static PermissionEntry Deny(string screen, string action) => new()
    {
        ScreenCode = screen, ActionCode = action, IsAllowed = false, Scope = 1
    };

    [Fact]
    public void EveryPayrollScreenActionHasASpecAlias()
    {
        var unmapped = AppRegistry.Screens
            .Where(screen => PermissionAliases.IsPayrollScreen(screen.Code))
            .SelectMany(screen => screen.Actions
                .Where(action => PermissionAliases.ForScreenAction(screen.Code, action.Code) is null)
                .Select(action => $"{screen.Code}/{action.Code}"))
            .ToList();

        Assert.Empty(unmapped);
    }

    [Fact]
    public void EveryAliasUsedIsDeclaredInTheCatalog()
    {
        var aliases = AppRegistry.Screens
            .Where(screen => PermissionAliases.IsPayrollScreen(screen.Code))
            .SelectMany(screen => screen.Actions
                .Select(action => PermissionAliases.ForScreenAction(screen.Code, action.Code)))
            .Where(alias => alias is not null)
            .Select(alias => alias!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        Assert.All(aliases, alias => Assert.Contains(alias, PermissionAliases.Catalog));
    }

    [Theory]
    [InlineData(ActionCodes.View, "payroll.view")]
    [InlineData(ActionCodes.ViewDetail, "payroll.view")]
    [InlineData(ActionCodes.Create, "payroll.create")]
    [InlineData(ActionCodes.Edit, "payroll.edit")]
    [InlineData(ActionCodes.Approve, "payroll.approve")]
    [InlineData(ActionCodes.Post, "payroll.post")]
    [InlineData(ActionCodes.Pay, "payroll.pay")]
    [InlineData(ActionCodes.Export, "payroll.export")]
    [InlineData(ActionCodes.Print, "payroll.export")]
    [InlineData(ActionCodes.Calculate, "payroll.calculate")]
    [InlineData(ActionCodes.Override, "payroll.override")]
    public void PayrollActionsMapToSpecNames(string action, string expected)
    {
        Assert.Equal(expected, PermissionAliases.ForScreenAction(ScreenCodes.PayrollRuns, action));
    }

    [Fact]
    public void ModuleGrantAllowsViewAndExportButNotPosting()
    {
        var grants = new[] { Grant("payroll", "view"), Grant("payroll", "export") };

        Assert.True(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollRuns, ActionCodes.View).Allowed);
        Assert.True(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollReports, ActionCodes.Print).Allowed);
        Assert.False(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollRuns, ActionCodes.Post).Allowed);
    }

    [Fact]
    public void DottedPermissionKeyIsAcceptedInBothStorages()
    {
        var dottedStar = new[] { Grant("payroll.export", "*") };
        var single = new[] { Grant("payroll.view", "") };

        Assert.True(PermissionEvaluator.Evaluate(dottedStar, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollReports, ActionCodes.Export).Allowed);
        Assert.True(PermissionEvaluator.Evaluate(single, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollDashboard, ActionCodes.View).Allowed);
    }

    [Fact]
    public void WildcardModuleGrantCoversAllMappedActions()
    {
        var grants = new[] { Grant("payroll", "*") };

        Assert.True(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollRuns, ActionCodes.Post).Allowed);
        Assert.True(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollEmployees, ActionCodes.SensitiveEdit).Allowed);
    }

    [Fact]
    public void ExplicitScreenGrantWinsOverAliasGrants()
    {
        var grants = new[] { Grant("payroll", "view"), Grant(ScreenCodes.PayrollAudit, ActionCodes.View, PermissionScope.All) };

        var effective = PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollAudit, ActionCodes.View);

        Assert.Equal(PermissionScope.All, effective.Scope);
        Assert.Equal("role", effective.Source);
    }

    [Fact]
    public void ExplicitScreenDenyOverrideBeatsAliasGrant()
    {
        var grants = new[] { Grant("payroll", "*") };
        var overrides = new[] { Deny(ScreenCodes.PayrollEmployees, ActionCodes.SensitiveEdit) };

        var effective = PermissionEvaluator.Evaluate(grants, overrides, false,
            ScreenCodes.PayrollEmployees, ActionCodes.SensitiveEdit);

        Assert.False(effective.Allowed);
        Assert.Equal("denied", effective.Source);
    }

    [Fact]
    public void AliasNeverLeaksToNonPayrollScreens()
    {
        Assert.True(PermissionAliases.IsPayrollScreen(ScreenCodes.PayrollRuns));
        Assert.False(PermissionAliases.IsPayrollScreen(ScreenCodes.Items));
        Assert.Null(PermissionAliases.ForScreenAction(ScreenCodes.Items, ActionCodes.View));

        var grants = new[] { Grant("payroll", "*") };
        Assert.False(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.Items, ActionCodes.View).Allowed);
    }

    [Fact]
    public void UnmappedPayrollActionIsNotGrantedByAlias()
    {
        // فعل بلا تسمية مواصفة (حفظ مسودة) يبقى محكوماً بالصلاحية الصريحة فقط.
        var grants = new[] { Grant("payroll", "view") };
        var effective = PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollRuns, ActionCodes.SaveDraft);

        Assert.False(effective.Allowed);
    }

    [Fact]
    public void ModuleScreenExposesEveryCatalogAliasForAdministration()
    {
        var section = Assert.Single(PermissionAliases.ModuleScreens);

        Assert.Equal(PermissionAliases.PayrollModule, section.Code);
        Assert.Equal(PermissionAliases.Catalog.Count, section.Actions.Count);
        foreach (var alias in PermissionAliases.Catalog)
        {
            var action = alias[(PermissionAliases.PayrollModule.Length + 1)..];
            var entry = Assert.Single(section.Actions.Where(a => a.Code == action));
            Assert.Equal($"permission.{alias}", entry.TitleKey);
        }
    }

    [Fact]
    public void ModuleSectionIsNotAScreenAndCannotShadowAnExistingScreenCode()
    {
        Assert.DoesNotContain(AppRegistry.Screens, s => s.Code.Equals("payroll", StringComparison.OrdinalIgnoreCase));
        Assert.Empty(PermissionAliases.ModuleScreens[0].Route);
    }

    /// <summary>
    /// فصل الصلاحيات: إنشاء/حذف الموظف ببياناته الأساسية (ملف HR) منفصل تماماً عن
    /// استكمال بيانات المرتبات، ولا توجد صلاحية حذف على شاشة مرتبات الموظفين.
    /// </summary>
    [Fact]
    public void EmployeeDeletionIsSeparateFromPayrollDataCompletion()
    {
        var hrScreen = Assert.Single(AppRegistry.Screens.Where(s => s.Code == ScreenCodes.Employees));
        var payrollScreen = Assert.Single(AppRegistry.Screens.Where(s => s.Code == ScreenCodes.PayrollEmployees));

        Assert.Contains(hrScreen.Actions, a => a.Code == ActionCodes.Delete);
        Assert.Contains(hrScreen.Actions, a => a.Code == ActionCodes.Create);

        Assert.DoesNotContain(payrollScreen.Actions, a => a.Code == ActionCodes.Delete);
        Assert.DoesNotContain(payrollScreen.Actions, a => a.Code == ActionCodes.Create);
        Assert.Contains(payrollScreen.Actions, a => a.Code == ActionCodes.Register);
        Assert.Contains(payrollScreen.Actions, a => a.Code == ActionCodes.CompleteData);
        Assert.Contains(payrollScreen.Actions, a => a.Code == ActionCodes.Approve);
        Assert.Contains(payrollScreen.Actions, a => a.Code == ActionCodes.SensitiveEdit);
    }

    [Fact]
    public void DeletingEmployeeDoesNotGrantPayrollRegistrationOrApproval()
    {
        var grants = new[] { Grant(ScreenCodes.Employees, ActionCodes.Delete) };

        Assert.False(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollEmployees, ActionCodes.CompleteData).Allowed);
        Assert.False(PermissionEvaluator.Evaluate(grants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.PayrollEmployees, ActionCodes.Approve).Allowed);

        var payrollGrants = new[] { Grant(ScreenCodes.PayrollEmployees, ActionCodes.CompleteData) };
        Assert.False(PermissionEvaluator.Evaluate(payrollGrants, Array.Empty<PermissionEntry>(), false,
            ScreenCodes.Employees, ActionCodes.Delete).Allowed);
    }
}
