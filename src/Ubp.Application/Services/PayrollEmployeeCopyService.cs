using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// معالج نسخ إعدادات موظف (مراجعة ثم تطبيق):
/// 1) معاينة (Plan) بلا أي كتابة، 2) تطبيق بصلاحية استكمال البيانات،
/// 3) البيانات الحسّاسة تحتاج صلاحية SENSITIVE_EDIT منفصلة.
/// لا تُنسخ حالة الاعتماد ولا نهاية الخدمة ولا إيقاف الراتب.
/// </summary>
public sealed class PayrollEmployeeCopyService
{
    private readonly IPayrollFoundationRepository _foundation;
    private readonly IPayrollOpeningBalanceRepository _openingBalances;
    private readonly IPayrollStatutoryRepository _statutory;
    private readonly IPayrollShiftRepository _shifts;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollEmployeeCopyService(IPayrollFoundationRepository foundation,
        IPayrollOpeningBalanceRepository openingBalances, IPayrollStatutoryRepository statutory,
        IPayrollShiftRepository shifts, PermissionService permissions, PayrollAuditWriter audit)
    {
        _foundation = foundation;
        _openingBalances = openingBalances;
        _statutory = statutory;
        _shifts = shifts;
        _permissions = permissions;
        _audit = audit;
    }

    public async Task<PayrollEmployeeCopyPlan> PlanAsync(Guid sourceEmployeeId, Guid targetEmployeeId,
        PayrollEmployeeCopyOptions options, ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ScreenCodes.PayrollEmployees, ActionCodes.CompleteData, ct);
        return await BuildPlanAsync(sourceEmployeeId, targetEmployeeId, options, ct);
    }

    public async Task<PayrollEmployeeCopyResult> ApplyAsync(Guid sourceEmployeeId, Guid targetEmployeeId,
        PayrollEmployeeCopyOptions options, ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ScreenCodes.PayrollEmployees, ActionCodes.CompleteData, ct);
        var plan = await BuildPlanAsync(sourceEmployeeId, targetEmployeeId, options, ct);

        if (!plan.HasWork && !options.CopyCostCenters && !options.CopyPaymentSettings &&
            !options.CopyOpeningBalances && !options.CopyShiftAssignment)
            throw new ValidationAppException("validation.payroll_copy_nothing_to_copy");
        if (plan.RequiresSensitivePermission || options.CopyPaymentSettings)
            await EnsureAsync(actor, ScreenCodes.PayrollEmployees, ActionCodes.SensitiveEdit, ct);
        if (options.CopyOpeningBalances)
            await EnsureAsync(actor, ScreenCodes.PayrollOpeningBalances, ActionCodes.Edit, ct);
        if (options.CopyShiftAssignment)
            await EnsureAsync(actor, ScreenCodes.PayrollAttendance, ActionCodes.Edit, ct);

        await _foundation.EnsureProfileAsync(targetEmployeeId, ct);
        if (plan.Profile is not null)
            await _foundation.SaveProfileAsync(targetEmployeeId, plan.Profile, ct);

        Guid? contractId = null;
        if (plan.Contract is not null)
        {
            plan.Contract.EmployeeId = targetEmployeeId;
            contractId = await _foundation.AddContractAsync(plan.Contract, actor.UserId, ct);
        }

        var effectiveFrom = options.ContractEffectiveFrom ?? DateOnly.FromDateTime(DateTime.Today);
        var costCenters = options.CopyCostCenters
            ? await CopyCostCentersAsync(sourceEmployeeId, targetEmployeeId, effectiveFrom, ct)
            : 0;
        var paymentSettings = options.CopyPaymentSettings
            ? await CopyPaymentSettingsAsync(sourceEmployeeId, targetEmployeeId, effectiveFrom, ct)
            : 0;
        var openingBalance = options.CopyOpeningBalances &&
                             await CopyOpeningBalanceAsync(sourceEmployeeId, targetEmployeeId, ct);
        var shiftAssignment = options.CopyShiftAssignment &&
                              await CopyShiftAssignmentAsync(sourceEmployeeId, targetEmployeeId, ct);

        await _audit.WriteAsync(actor, "payroll_employee_profiles", targetEmployeeId.ToString(), "COPY",
            null, new
            {
                source_employee_id = sourceEmployeeId,
                copied_fields = plan.Fields.Where(x => x.WillCopy).Select(x => x.Name).ToArray(),
                sensitive_copied = plan.RequiresSensitivePermission || options.CopyPaymentSettings,
                contract_id = contractId, cost_centers = costCenters,
                payment_settings = paymentSettings, opening_balance = openingBalance,
                shift_assignment = shiftAssignment, prepared_status = plan.Profile?.Status
            }, ct);

        return new PayrollEmployeeCopyResult
        {
            Plan = plan, CostCenters = costCenters, PaymentSettings = paymentSettings,
            OpeningBalance = openingBalance, ShiftAssignment = shiftAssignment, ContractId = contractId
        };
    }

    private async Task<int> CopyCostCentersAsync(Guid source, Guid target, DateOnly effectiveFrom,
        CancellationToken ct)
    {
        var sourceItems = await _foundation.ListCostCenterAllocationsAsync(source, ct);
        if (sourceItems.Count == 0) return 0;
        var copies = sourceItems.Select(item => new PayrollCostCenterAllocation
        {
            Id = Guid.NewGuid(), EmployeeId = target, BranchId = item.BranchId,
            CostCenterId = item.CostCenterId, AllocationPercent = item.AllocationPercent,
            EffectiveFrom = effectiveFrom, EffectiveTo = null
        }).ToArray();
        return await _foundation.ReplaceCostCenterAllocationsAsync(target, copies, ct);
    }

    private async Task<int> CopyPaymentSettingsAsync(Guid source, Guid target, DateOnly effectiveFrom,
        CancellationToken ct)
    {
        var sourceItems = await _foundation.ListPaymentSettingsAsync(source, ct);
        if (sourceItems.Count == 0) return 0;
        var copies = sourceItems.Select(item => new PayrollPaymentSetting
        {
            Id = Guid.NewGuid(), EmployeeId = target, PaymentMethodCode = item.PaymentMethodCode,
            Amount = item.Amount, Percentage = item.Percentage,
            AccountReference = item.AccountReference, EffectiveFrom = effectiveFrom, EffectiveTo = null
        }).ToArray();
        return await _foundation.ReplacePaymentSettingsAsync(target, copies, ct);
    }

    private async Task<bool> CopyOpeningBalanceAsync(Guid source, Guid target, CancellationToken ct)
    {
        var year = DateTime.Today.Year.ToString("D4");
        var sourceBalance = await _openingBalances.GetAsync(source, year, ct);
        if (sourceBalance is null || !sourceBalance.HasAmounts) return false;

        // لا يُنسخ رصيد إلى سنة بدأ حسابها بالفعل — نفس القفل المفروض في شاشة الأرصدة.
        var transactions = await _statutory.CountTaxTransactionsAsync(year, ct);
        PayrollOpeningBalanceRules.EnsureEditable(transactions);

        await _openingBalances.UpsertAsync(new PayrollOpeningBalance
        {
            Id = Guid.NewGuid(), CompanyId = sourceBalance.CompanyId, EmployeeId = target,
            TaxYearCode = year, TaxBase = sourceBalance.TaxBase,
            TaxWithheld = sourceBalance.TaxWithheld, InsuranceBase = sourceBalance.InsuranceBase,
            InsuranceEmployee = sourceBalance.InsuranceEmployee,
            InsuranceEmployer = sourceBalance.InsuranceEmployer,
            HealthBase = sourceBalance.HealthBase, HealthEmployee = sourceBalance.HealthEmployee,
            HealthEmployer = sourceBalance.HealthEmployer, Notes = $"copied from {source:N}"
        }, ct);
        return true;
    }

    private async Task<bool> CopyShiftAssignmentAsync(Guid source, Guid target, CancellationToken ct)
    {
        var assignments = await _shifts.ListAssignmentsAsync(source, ct);
        var latest = assignments.OrderByDescending(x => x.EffectiveFrom).FirstOrDefault();
        if (latest is null) return false;
        await _shifts.AssignAsync(new AttendanceShiftAssignment
        {
            Id = Guid.NewGuid(), EmployeeId = target, ShiftId = latest.ShiftId,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.Today)
        }, ct);
        return true;
    }

    private async Task<PayrollEmployeeCopyPlan> BuildPlanAsync(Guid sourceEmployeeId,
        Guid targetEmployeeId, PayrollEmployeeCopyOptions options, CancellationToken ct)
    {
        var profile = await _foundation.GetProfileAsync(sourceEmployeeId, ct);
        var contracts = profile is null
            ? Array.Empty<PayrollEmployeeContract>()
            : await _foundation.ListContractsAsync(sourceEmployeeId, ct);
        return PayrollEmployeeCopyPlanner.Plan(sourceEmployeeId, targetEmployeeId, profile, contracts,
            options, DateOnly.FromDateTime(DateTime.Today));
    }

    private async Task EnsureAsync(ActorContext actor, string screenCode, string action,
        CancellationToken ct)
    {
        if (await _permissions.HasAsync(actor, screenCode, action, ct)) return;
        throw new ForbiddenException();
    }
}
