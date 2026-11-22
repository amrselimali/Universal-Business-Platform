using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// إدارة دورة المرتبات: الإنشاء وتغيير الحالات، مع فحص صلاحيات على الخادم
/// وفصل مهام (منشئ الدورة لا يعتمدها) وتسجيل تدقيق لكل تغيير حالة.
/// </summary>
public sealed class PayrollRunService
{
    private readonly IPayrollRunRepository _repository;
    private readonly PayrollRunWorkflow _workflow;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollRunService(IPayrollRunRepository repository, PayrollRunWorkflow workflow,
        PermissionService permissions, PayrollAuditWriter audit)
    {
        _repository = repository;
        _workflow = workflow;
        _permissions = permissions;
        _audit = audit;
    }

    public async Task<Guid> CreateAsync(PayrollRun run, Guid? userId, CancellationToken ct = default)
    {
        if (run.SalaryTo < run.SalaryFrom || run.VariablesTo < run.VariablesFrom)
            throw new ValidationAppException("validation.payroll_dates_invalid");
        if (!PayrollRunTypes.IsValid(run.RunType))
            throw new ValidationAppException("validation.payroll_run_type_invalid");
        run.RunType = PayrollRunTypes.Normalize(run.RunType);
        if (run.SourceRunId == run.Id)
            throw new ValidationAppException("validation.payroll_run_source_invalid");
        run.CreatedBy ??= userId;
        return await _repository.CreateAsync(run, userId, ct);
    }

    public Task<IReadOnlyList<PayrollRun>> ListAsync(CancellationToken ct = default) =>
        _repository.ListAsync(ct);

    public Task<PayrollRun?> GetAsync(Guid id, CancellationToken ct = default) =>
        _repository.GetAsync(id, ct);

    public Task<IReadOnlyList<PayrollResult>> ListResultsAsync(Guid payrollRunId, CancellationToken ct = default) =>
        _repository.ListResultsAsync(payrollRunId, ct);

    public Task<IReadOnlyList<PayrollPayment>> ListPaymentsAsync(Guid payrollRunId, CancellationToken ct = default) =>
        _repository.ListPaymentsAsync(payrollRunId, ct);

    public Task<IReadOnlyList<PayrollResultDetail>> ListResultDetailsAsync(Guid payrollResultId,
        CancellationToken ct = default) => _repository.ListResultDetailsAsync(payrollResultId, ct);

    public Task<IReadOnlyList<PayrollRunIssue>> ListIssuesAsync(Guid payrollRunId,
        CancellationToken ct = default) => _repository.ListIssuesAsync(payrollRunId, ct);

    public Task<PayrollRunTotals> GetTotalsAsync(Guid payrollRunId, CancellationToken ct = default) =>
        _repository.GetTotalsAsync(payrollRunId, ct);

    /// <summary>سجل تنفيذ الموظفين داخل الدورة (حالة/محاولات) — لا يحتوي مبالغ.</summary>
    public Task<IReadOnlyList<PayrollRunEmployeeState>> ListRunEmployeesAsync(Guid payrollRunId,
        CancellationToken ct = default) => _repository.ListRunEmployeesAsync(payrollRunId, ct);

    public Task<PayrollRunEmployeeStats> GetRunEmployeeStatsAsync(Guid payrollRunId,
        CancellationToken ct = default) => _repository.GetRunEmployeeStatsAsync(payrollRunId, ct);

    public async Task<PayrollRun> TransitionAsync(Guid id, int expectedVersion, string targetStatus,
        IReadOnlyCollection<PayrollRunIssue>? issues = null, ActorContext? actor = null,
        bool overrideBlockingIssues = false, string? overrideReason = null, CancellationToken ct = default)
    {
        var current = await _repository.GetAsync(id, ct)
            ?? throw new KeyNotFoundException($"Payroll run '{id}' was not found.");
        if (current.Version != expectedVersion)
            throw new ConflictException("payroll.run.version_conflict");

        if (actor is not null)
        {
            await EnsureActionAsync(actor, ActionFor(targetStatus), ct);
            if (targetStatus == PayrollRunStatuses.Approved && !overrideBlockingIssues &&
                current.CreatedBy == actor.UserId && !actor.IsSuperAdmin)
                throw new ForbiddenException();
            if (overrideBlockingIssues && !await _permissions.HasAsync(actor, ScreenCodes.PayrollRuns,
                    ActionCodes.Override, ct))
                throw new ForbiddenException();
        }

        var effectiveIssues = issues is { Count: > 0 }
            ? issues
            : await _repository.ListIssuesAsync(id, ct);
        var status = _workflow.Transition(current.Status, targetStatus, effectiveIssues,
            overrideBlockingIssues, overrideReason);
        if (!await _repository.UpdateStatusAsync(id, expectedVersion, status, ct))
            throw new ConflictException("payroll.run.version_conflict");

        if (actor is not null)
            await _audit.WriteAsync(actor, "payroll_runs", id.ToString(), status.ToUpperInvariant(),
                new { status = current.Status }, new { status }, ct);

        current.Status = status;
        current.Version++;
        return current;
    }

    public Task SaveResultAsync(PayrollResult result, CancellationToken ct = default) =>
        _repository.UpsertResultAsync(result, ct);

    public Task<Guid> RecordPaymentAsync(PayrollPayment payment, CancellationToken ct = default) =>
        _repository.AddPaymentAsync(payment, ct);

    /// <summary>صرف الدورة بعد الترحيل، بصلاحية صرف مستقلة وIdempotency لكل موظف (لا تكرار للصرف الجزئي).</summary>
    public async Task<int> PayRunAsync(Guid runId, string paymentMethodCode, ActorContext? actor = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(paymentMethodCode))
            throw new ValidationAppException("validation.payment_method_required");
        var run = await _repository.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (actor is not null)
            await EnsureActionAsync(actor, ActionCodes.Pay, ct);
        if (run.Status is not (PayrollRunStatuses.Posted or PayrollRunStatuses.PartiallyPaid))
            throw new ValidationAppException("validation.payroll_run_not_posted");

        var results = await _repository.ListResultsAsync(runId, ct);
        var existing = await _repository.ListPaymentsAsync(runId, ct);
        var paidByEmployee = existing
            .GroupBy(x => x.EmployeeId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var count = 0;
        var paidTotal = existing.Sum(x => x.Amount);
        foreach (var result in results.Where(x => x.NetAmount > 0))
        {
            var remaining = result.NetAmount - paidByEmployee.GetValueOrDefault(result.EmployeeId);
            if (remaining <= 0) continue;

            await _repository.AddPaymentAsync(new PayrollPayment
            {
                Id = Guid.NewGuid(), PayrollRunId = runId, EmployeeId = result.EmployeeId,
                PaymentMethodCode = paymentMethodCode.Trim(), Amount = remaining,
                CurrencyCode = result.CurrencyCode, Status = "paid",
                IdempotencyKey = $"payroll:{runId:N}:{result.EmployeeId:N}"
            }, ct);
            paidTotal += remaining;
            count++;
        }

        var totals = await _repository.GetTotalsAsync(runId, ct);
        var target = paidTotal + 0.005m >= totals.NetAmount
            ? PayrollRunStatuses.Paid
            : PayrollRunStatuses.PartiallyPaid;
        var current = await _repository.GetAsync(runId, ct) ?? run;
        if (!await _repository.UpdateStatusAsync(runId, current.Version, target, ct))
            throw new ConflictException("payroll.run.version_conflict");

        if (actor is not null)
            await _audit.WriteAsync(actor, "payroll_runs", runId.ToString(), "PAY",
                new { status = run.Status }, new { status = target, amount = paidTotal, count }, ct);
        return count;
    }

    /// <summary>تجاوز ملاحظة مانعة بصلاحية مستقلة وسبب إلزامي (PAY-018) مع تسجيل تدقيق.</summary>
    public async Task<PayrollRun> OverrideIssueAsync(Guid runId, Guid issueId, string reason,
        ActorContext actor, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ValidationAppException("validation.override_reason_required");
        if (!await _permissions.HasAsync(actor, ScreenCodes.PayrollRuns, ActionCodes.Override, ct) &&
            !await _permissions.HasAsync(actor, ScreenCodes.PayrollReviewApproval, ActionCodes.Override, ct))
            throw new ForbiddenException();
        if (!await _repository.OverrideIssueAsync(issueId, reason.Trim(), actor.UserId, ct))
            throw new ValidationAppException("validation.issue_not_overrideable");
        await _audit.WriteAsync(actor, "payroll_run_issues", issueId.ToString(), "OVERRIDE",
            null, new { run_id = runId, reason }, ct);
        return await _repository.GetAsync(runId, ct)
               ?? throw new KeyNotFoundException("Payroll run was not found.");
    }

    /// <summary>إعادة فتح دورة مرحلة/مصروفة بصلاحية وسبب (PAY-042) — تعود للحساب لإنشاء تسوية موثقة.</summary>
    public async Task<PayrollRun> ReopenAsync(Guid runId, int expectedVersion, string reason,
        ActorContext actor, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ValidationAppException("validation.reopen_reason_required");
        if (!await _permissions.HasAsync(actor, ScreenCodes.PayrollRuns, ActionCodes.Reopen, ct))
            throw new ForbiddenException();
        var run = await _repository.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (run.Version != expectedVersion)
            throw new ConflictException("payroll.run.version_conflict");
        if (run.Status is not (PayrollRunStatuses.Posted or PayrollRunStatuses.Paid
            or PayrollRunStatuses.Closed or PayrollRunStatuses.Approved))
            throw new ValidationAppException("validation.run_not_reopenable");
        if (!await _repository.UpdateStatusAsync(runId, expectedVersion, PayrollRunStatuses.Calculated, ct))
            throw new ConflictException("payroll.run.version_conflict");
        await _audit.WriteAsync(actor, "payroll_runs", runId.ToString(), "REOPEN",
            new { status = run.Status },
            new { status = PayrollRunStatuses.Calculated, reason = reason.Trim() }, ct);
        run.Status = PayrollRunStatuses.Calculated;
        run.Version++;
        return run;
    }

    /// <summary>صرف جزئي لموظف واحد مع Idempotency (PAY-039): لا يتكرر الطلب نفسه ولا يتجاوز المتبقي.</summary>
    public async Task<decimal> PayEmployeeAsync(Guid runId, Guid employeeId, string paymentMethodCode,
        decimal amount, ActorContext? actor = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(paymentMethodCode))
            throw new ValidationAppException("validation.payment_method_required");
        var run = await _repository.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (actor is not null) await EnsureActionAsync(actor, ActionCodes.Pay, ct);
        if (run.Status is not (PayrollRunStatuses.Posted or PayrollRunStatuses.PartiallyPaid))
            throw new ValidationAppException("validation.payroll_run_not_posted");

        var result = await _repository.GetResultAsync(runId, employeeId, ct)
            ?? throw new ValidationAppException("validation.payroll_result_not_found");
        var payments = await _repository.ListPaymentsAsync(runId, ct);
        var alreadyPaid = payments.Where(x => x.EmployeeId == employeeId).Sum(x => x.Amount);
        var remaining = result.NetAmount - alreadyPaid;
        if (remaining <= 0) throw new ValidationAppException("validation.payroll_already_paid");

        var toPay = amount <= 0 ? remaining : Math.Min(amount, remaining);
        if (toPay <= 0) throw new ValidationAppException("validation.payment_amount_invalid");

        await _repository.AddPaymentAsync(new PayrollPayment
        {
            Id = Guid.NewGuid(), PayrollRunId = runId, EmployeeId = employeeId,
            PaymentMethodCode = paymentMethodCode.Trim(), Amount = toPay,
            CurrencyCode = result.CurrencyCode, Status = "paid",
            IdempotencyKey = $"payroll:{runId:N}:{employeeId:N}:{paymentMethodCode.Trim()}:{toPay:0.##}"
        }, ct);

        var totals = await _repository.GetTotalsAsync(runId, ct);
        var paidTotal = payments.Sum(x => x.Amount) + toPay;
        var target = paidTotal + 0.005m >= totals.NetAmount
            ? PayrollRunStatuses.Paid
            : PayrollRunStatuses.PartiallyPaid;
        var current = await _repository.GetAsync(runId, ct) ?? run;
        await _repository.UpdateStatusAsync(runId, current.Version, target, ct);

        if (actor is not null)
            await _audit.WriteAsync(actor, "payroll_payments", employeeId.ToString(), "PAY",
                null, new { run_id = runId, employee_id = employeeId, amount = toPay, method = paymentMethodCode, status = target }, ct);
        return toPay;
    }

    /// <summary>إغلاق الفترة بعد الصرف: يمنع التعديل المباشر ويحوّل أي تغيير لاحق إلى تسوية (بند 15.5).</summary>
    public async Task<PayrollRun> CloseAsync(Guid runId, int expectedVersion, ActorContext actor,
        CancellationToken ct = default)
    {
        await EnsureActionAsync(actor, ActionCodes.Close, ct);
        var run = await _repository.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (run.Version != expectedVersion)
            throw new ConflictException("payroll.run.version_conflict");
        if (run.Status is not (PayrollRunStatuses.Paid or PayrollRunStatuses.PartiallyPaid))
            throw new ValidationAppException("validation.run_not_closable");
        if (!await _repository.UpdateStatusAsync(runId, expectedVersion, PayrollRunStatuses.Closed, ct))
            throw new ConflictException("payroll.run.version_conflict");
        await _audit.WriteAsync(actor, "payroll_runs", runId.ToString(), "CLOSE",
            new { status = run.Status }, new { status = PayrollRunStatuses.Closed }, ct);
        run.Status = PayrollRunStatuses.Closed;
        run.Version++;
        return run;
    }

    private async Task EnsureActionAsync(ActorContext actor, string action, CancellationToken ct)
    {
        if (await _permissions.HasAsync(actor, ScreenCodes.PayrollRuns, action, ct)) return;
        if (action == ActionCodes.Approve &&
            await _permissions.HasAsync(actor, ScreenCodes.PayrollReviewApproval, ActionCodes.Approve, ct))
            return;
        throw new ForbiddenException();
    }

    private static string ActionFor(string targetStatus) => targetStatus switch
    {
        PayrollRunStatuses.Calculating => ActionCodes.Calculate,
        PayrollRunStatuses.UnderReview => ActionCodes.Edit,
        PayrollRunStatuses.Approved => ActionCodes.Approve,
        PayrollRunStatuses.Posted => ActionCodes.Post,
        PayrollRunStatuses.Paid or PayrollRunStatuses.PartiallyPaid => ActionCodes.Pay,
        PayrollRunStatuses.Cancelled or PayrollRunStatuses.Closed => ActionCodes.Close,
        _ => ActionCodes.Edit
    };
}
