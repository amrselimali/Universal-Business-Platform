using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// الإجازات: الأرصدة الافتتاحية، الخصم عند الاعتماد، والحركات. لا تُعتمد إجازة إلا إذا كان
/// الرصيد كافياً (وسياسة السماح بالسالب تُدار كإعداد مستقبلي).
/// </summary>
public sealed class PayrollLeaveService
{
    private readonly IPayrollLeaveBalanceRepository _balances;
    private readonly IPayrollOperationsRepository _operations;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollLeaveService(IPayrollLeaveBalanceRepository balances,
        IPayrollOperationsRepository operations, PermissionService permissions, PayrollAuditWriter audit)
    {
        _balances = balances;
        _operations = operations;
        _permissions = permissions;
        _audit = audit;
    }

    public Task<IReadOnlyList<PayrollLeaveBalance>> ListBalancesAsync(Guid? employeeId,
        CancellationToken ct = default) => _balances.ListAsync(employeeId, ct);

    public async Task<Guid> SetOpeningAsync(Guid employeeId, string leaveTypeCode, DateOnly balanceDate,
        decimal opening, bool carryOverAllowed, decimal? carryOverLimit, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        var id = await _balances.SetOpeningAsync(employeeId, leaveTypeCode, balanceDate, opening,
            carryOverAllowed, carryOverLimit, ct);
        await _audit.WriteAsync(actor, "leave_balances", id.ToString(), "UPDATE", null,
            new { employee_id = employeeId, leave_type = leaveTypeCode, opening, carryOverAllowed }, ct);
        return id;
    }

    /// <summary>اعتماد طلب إجازة: يخصم الرصيد ويحفظ الحركة ثم يحوّل الحالة إلى معتمد.</summary>
    public async Task<bool> ApproveAsync(Guid leaveId, ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Approve, ct);
        var leave = await _operations.GetLeaveAsync(leaveId, ct)
            ?? throw new ValidationAppException("validation.leave_request_not_found");
        if (leave.Status == "approved") return false;

        var consumed = await _balances.ConsumeAsync(leave.EmployeeId, leave.LeaveTypeCode,
            leave.FromDate, leave.Days, leave.Id, "leave approval", ct);
        if (!consumed)
            throw new ValidationAppException("validation.leave_balance_insufficient");

        await _operations.ApproveLeaveAsync(leaveId, actor.UserId, ct);
        await _audit.WriteAsync(actor, "leave_requests", leaveId.ToString(), "APPROVE",
            new { status = leave.Status }, new { status = "approved", days = leave.Days }, ct);
        return true;
    }

    /// <summary>
    /// استحقاق سنة كاملة لموظف: استحقاق الأشهر + ترحيل المتبقي بحد أقصى، ثم حفظ idempotent.
    /// المرجع ACCRUAL-YYYY يمنع تكرار الرصيد عند إعادة التشغيل.
    /// </summary>
    public async Task<PayrollLeaveAccrualPlan> AccrueYearAsync(Guid employeeId, string leaveTypeCode,
        int year, decimal annualEntitlement, int months, bool carryOverAllowed, decimal? carryOverLimit,
        ActorContext actor, CancellationToken ct = default)
    {
        await EnsureAsync(actor, ActionCodes.Edit, ct);
        var previous = await _balances.GetAsync(employeeId, leaveTypeCode?.Trim() ?? "",
            new DateOnly(year - 1, 12, 31), ct);
        var plan = PayrollLeaveRules.PlanYear(employeeId, leaveTypeCode ?? "", year, annualEntitlement,
            months, previous?.RemainingBalance ?? 0m, carryOverAllowed, carryOverLimit);
        if (plan.OpeningBalance <= 0)
            throw new ValidationAppException("validation.leave_accrual_empty");

        var balanceId = await _balances.AccrueAsync(employeeId, plan.LeaveTypeCode,
            new DateOnly(year, 1, 1), plan.OpeningBalance, carryOverAllowed, carryOverLimit,
            PayrollLeaveRules.AccrualReference(year), ct);

        await _audit.WriteAsync(actor, "leave_balances", balanceId.ToString(), "ACCRUE", null, new
        {
            employee_id = employeeId, leave_type = plan.LeaveTypeCode, year = plan.Year,
            accrued = plan.Accrued, carried_forward = plan.CarriedForward,
            previous_remaining = plan.PreviousRemaining, opening_balance = plan.OpeningBalance,
            carry_allowed = plan.CarryOverAllowed, carry_limit_applied = plan.CarryLimitApplied,
            carry_limit = carryOverLimit, months = plan.Months,
            reference = PayrollLeaveRules.AccrualReference(year)
        }, ct);
        return plan;
    }

    private async Task EnsureAsync(ActorContext actor, string action, CancellationToken ct)
    {
        if (!await _permissions.HasAsync(actor, ScreenCodes.PayrollLeaves, action, ct))
            throw new ForbiddenException();
    }
}
