using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed class PayrollRunService
{
    private readonly IPayrollRunRepository _repository;
    private readonly PayrollRunWorkflow _workflow;

    public PayrollRunService(IPayrollRunRepository repository, PayrollRunWorkflow workflow)
    {
        _repository = repository;
        _workflow = workflow;
    }

    public Task<Guid> CreateAsync(PayrollRun run, Guid? userId, CancellationToken ct = default) =>
        _repository.CreateAsync(run, userId, ct);

    public Task<IReadOnlyList<PayrollRun>> ListAsync(CancellationToken ct = default) =>
        _repository.ListAsync(ct);

    public Task<PayrollRun?> GetAsync(Guid id, CancellationToken ct = default) =>
        _repository.GetAsync(id, ct);

    public Task<IReadOnlyList<PayrollResult>> ListResultsAsync(Guid payrollRunId, CancellationToken ct = default) =>
        _repository.ListResultsAsync(payrollRunId, ct);

    public Task<IReadOnlyList<PayrollPayment>> ListPaymentsAsync(Guid payrollRunId, CancellationToken ct = default) =>
        _repository.ListPaymentsAsync(payrollRunId, ct);

    public Task<IReadOnlyList<PayrollResultDetail>> ListResultDetailsAsync(Guid payrollResultId, CancellationToken ct = default) =>
        _repository.ListResultDetailsAsync(payrollResultId, ct);

    public async Task<PayrollRun> TransitionAsync(Guid id, int expectedVersion, string targetStatus,
        IReadOnlyCollection<PayrollRunIssue> issues, bool overrideBlockingIssues = false,
        string? overrideReason = null, CancellationToken ct = default)
    {
        var current = await _repository.GetAsync(id, ct)
            ?? throw new KeyNotFoundException($"Payroll run '{id}' was not found.");
        if (current.Version != expectedVersion)
            throw new InvalidOperationException("The payroll run was changed by another user.");
        var status = _workflow.Transition(current.Status, targetStatus, issues,
            overrideBlockingIssues, overrideReason);
        if (!await _repository.UpdateStatusAsync(id, expectedVersion, status, ct))
            throw new InvalidOperationException("The payroll run was changed by another user.");
        current.Status = status;
        current.Version++;
        return current;
    }

    public Task SaveResultAsync(PayrollResult result, CancellationToken ct = default) =>
        _repository.UpsertResultAsync(result, ct);

    public Task<Guid> RecordPaymentAsync(PayrollPayment payment, CancellationToken ct = default) =>
        _repository.AddPaymentAsync(payment, ct);

    public async Task<int> PayRunAsync(Guid runId, string paymentMethodCode,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(paymentMethodCode))
            throw new ArgumentException("Payment method is required.", nameof(paymentMethodCode));
        var run = await _repository.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (run.Status != PayrollRunStatuses.Posted)
            throw new InvalidOperationException("Only posted payroll runs can be paid.");
        var results = await _repository.ListResultsAsync(runId, ct);
        var count = 0;
        foreach (var result in results.Where(x => x.NetAmount > 0))
        {
            await _repository.AddPaymentAsync(new PayrollPayment
            {
                Id = Guid.NewGuid(), PayrollRunId = runId, EmployeeId = result.EmployeeId,
                PaymentMethodCode = paymentMethodCode.Trim(), Amount = result.NetAmount,
                CurrencyCode = result.CurrencyCode, Status = "paid",
                IdempotencyKey = $"payroll:{runId:N}:{result.EmployeeId:N}"
            }, ct);
            count++;
        }
        if (!await _repository.UpdateStatusAsync(runId, run.Version, PayrollRunStatuses.Paid, ct))
            throw new InvalidOperationException("The payroll run was changed by another user.");
        return count;
    }
}
