using Ubp.Core.Models;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// نطاق فرع الموظف في قوائم الاختيار (0091/0093/0214): موظف «الشركة بالكامل» (بلا فرع)
/// يجب أن يظهر في قوائم فرع محدد — بشرط أن يكون نشطًا ومفعّلًا كمنفّذ خدمة.
/// </summary>
public sealed class EmployeeBranchScopeTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public EmployeeBranchScopeTests(TestDb db) => _db = db;

    private async Task<(Guid Branch, Guid CompanyEmployee, Guid BranchEmployee)> SetupAsync(
        string suffix, bool isExecutor = true, bool isActive = true)
    {
        var actor = await _db.AdminActorAsync();
        var branch = await _db.CreateBranchAsync("EB-B-" + suffix, "فرع موظفين " + suffix);
        var other = await _db.CreateBranchAsync("EB-B2-" + suffix, "فرع آخر " + suffix);

        var company = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(company, new EmployeeInput
        {
            Code = "EB-E1-" + suffix, NameAr = "موظف الشركة " + suffix,
            BranchId = null, IsServiceExecutor = isExecutor, IsActive = isActive
        }, actor.UserId);

        var local = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(local, new EmployeeInput
        {
            Code = "EB-E2-" + suffix, NameAr = "موظف الفرع " + suffix,
            BranchId = branch, IsServiceExecutor = isExecutor, IsActive = isActive
        }, actor.UserId);

        // موظف فرع آخر: لا يظهر في قوائم هذا الفرع.
        var foreign = Guid.CreateVersion7();
        await _db.EmployeeRepo.CreateAsync(foreign, new EmployeeInput
        {
            Code = "EB-E3-" + suffix, NameAr = "موظف فرع آخر " + suffix,
            BranchId = other, IsServiceExecutor = isExecutor, IsActive = isActive
        }, actor.UserId);

        return (branch, company, local);
    }

    [Fact]
    public async Task Company_wide_executor_appears_in_a_specific_branch_execution_list()
    {
        var actor = await _db.AdminActorAsync();
        var (branch, company, local) = await SetupAsync("1");

        var options = await _db.MasterData().EmployeeOptionsForBranchesAsync(actor, new[] { branch });

        Assert.Contains(options, e => e.Id == company);   // موظف الشركة (بلا فرع)
        Assert.Contains(options, e => e.Id == local);     // موظف الفرع
    }

    /// <summary>
    /// مستخدم مقيّد بفرع (غير مدير أعلى) يرى موظفي فرعه + موظفي الشركة (بلا فرع) معًا.
    /// </summary>
    [Fact]
    public async Task Branch_scoped_user_sees_both_branch_and_company_wide_executors()
    {
        var (branch, company, local) = await SetupAsync("5");
        var actor = new ActorContext
        {
            UserId = Guid.NewGuid(), Username = "cashier", IsAdmin = true,
            IsSuperAdmin = false, AllowedBranchIds = new[] { branch }, CurrentBranchId = branch
        };

        var options = await _db.MasterData().EmployeeOptionsForBranchesAsync(actor, new[] { branch });

        Assert.Contains(options, e => e.Id == company);
        Assert.Contains(options, e => e.Id == local);
    }

    [Fact]
    public async Task Company_wide_employee_without_executor_flag_is_not_in_execution_list()
    {
        var actor = await _db.AdminActorAsync();
        var (branch, company, _) = await SetupAsync("2", isExecutor: false);

        var options = await _db.MasterData().EmployeeOptionsForBranchesAsync(actor, new[] { branch });

        Assert.DoesNotContain(options, e => e.Id == company);
    }

    [Fact]
    public async Task Inactive_company_wide_employee_is_not_listed()
    {
        var actor = await _db.AdminActorAsync();
        var (branch, company, _) = await SetupAsync("3", isActive: false);

        var options = await _db.MasterData().EmployeeOptionsForBranchesAsync(actor, new[] { branch });

        Assert.DoesNotContain(options, e => e.Id == company);
    }

    [Fact]
    public async Task Company_wide_employee_is_allowed_to_execute_in_the_branch()
    {
        var actor = await _db.AdminActorAsync();
        var (branch, company, _) = await SetupAsync("4");

        var employee = await _db.EmployeeRepo.GetAsync(company);
        Assert.NotNull(employee);
        Assert.True(BookingExecutionRules.EmployeeBelongsToBranch(employee!.BranchId, branch));
    }
}
