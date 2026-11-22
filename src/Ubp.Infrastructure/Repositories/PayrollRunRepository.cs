using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollRunRepository
{
    Task<Guid> CreateAsync(PayrollRun run, Guid? userId, CancellationToken ct = default);
    Task<PayrollRun?> GetAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollRun>> ListAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PayrollResult>> ListResultsAsync(Guid payrollRunId, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollPayment>> ListPaymentsAsync(Guid payrollRunId, CancellationToken ct = default);
    Task<PayrollJournalLink?> GetJournalLinkAsync(Guid payrollRunId, Guid employeeId, CancellationToken ct = default);
    Task SaveJournalLinkAsync(Guid payrollRunId, Guid employeeId, Guid journalEntryId, string postingType, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollResultDetail>> ListResultDetailsAsync(Guid payrollResultId, CancellationToken ct = default);
    Task SaveResultDetailsAsync(Guid payrollRunId, Guid employeeId, IReadOnlyCollection<PayrollResultDetail> details, CancellationToken ct = default);
    Task<bool> UpdateStatusAsync(Guid id, int expectedVersion, string status, CancellationToken ct = default);
    Task UpsertResultAsync(PayrollResult result, CancellationToken ct = default);
    Task<Guid> AddPaymentAsync(PayrollPayment payment, CancellationToken ct = default);

    Task<IReadOnlyList<PayrollRunIssue>> ListIssuesAsync(Guid payrollRunId, CancellationToken ct = default);
    Task AddIssueAsync(PayrollRunIssue issue, CancellationToken ct = default);
    Task ClearIssuesAsync(Guid payrollRunId, CancellationToken ct = default);
    /// <summary>تجاوز ملاحظة بصلاحية وسبب (يُسجَّل مع من تجاوزها).</summary>
    Task<bool> OverrideIssueAsync(Guid issueId, string reason, Guid userId, CancellationToken ct = default);
    Task<PayrollResult?> GetResultAsync(Guid payrollRunId, Guid employeeId, CancellationToken ct = default);
    Task<PayrollRunTotals> GetTotalsAsync(Guid payrollRunId, CancellationToken ct = default);

    /// <summary>سجل تنفيذ الموظف داخل الدورة (بدون مبالغ): حالة/محاولات/كود خطأ/إصدار محرك.</summary>
    Task UpsertRunEmployeeAsync(Guid payrollRunId, Guid employeeId, int runSegment, string status,
        Guid? branchId, decimal? workDays, string? engineVersion, string? errorCode,
        CancellationToken ct = default);
    Task ResetRunEmployeesAsync(Guid payrollRunId, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollRunEmployeeState>> ListRunEmployeesAsync(Guid payrollRunId,
        CancellationToken ct = default);
    Task<PayrollRunEmployeeStats> GetRunEmployeeStatsAsync(Guid payrollRunId,
        CancellationToken ct = default);
}

public sealed class PayrollRunTotals
{
    public int EmployeeCount { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal DeductionsAmount { get; set; }
    public decimal NetAmount { get; set; }
    public int IssueCount { get; set; }
    public int BlockingIssueCount { get; set; }
}

public sealed class PayrollRunRepository : IPayrollRunRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollRunRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<Guid> CreateAsync(PayrollRun run, Guid? userId, CancellationToken ct = default)
    {
        ValidateDates(run);
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_runs
                (id, status, run_type, source_run_id, salary_from, salary_to, variables_from, variables_to, expected_payment_date, cutoff_at, created_by)
            VALUES (@Id, @Status, @RunType, @SourceRunId, @SalaryFrom, @SalaryTo, @VariablesFrom, @VariablesTo, @ExpectedPaymentDate, @CutoffAt, @userId)
            RETURNING id
            """, new { run.Id, run.Status, run.SalaryFrom, run.SalaryTo, run.VariablesFrom,
                run.VariablesTo, run.ExpectedPaymentDate, run.CutoffAt, userId, run.RunType, run.SourceRunId }, cancellationToken: ct));
    }

    public async Task<PayrollRun?> GetAsync(Guid id, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollRun>(new CommandDefinition("""
            SELECT id AS Id, status AS Status, run_type AS RunType, source_run_id AS SourceRunId, salary_from AS SalaryFrom, salary_to AS SalaryTo,
                variables_from AS VariablesFrom, variables_to AS VariablesTo,
                expected_payment_date AS ExpectedPaymentDate, cutoff_at AS CutoffAt, created_by AS CreatedBy, version AS Version
            FROM payroll_runs WHERE id = @id
            """, new { id }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollRun>> ListAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollRun>(new CommandDefinition("""
            SELECT id AS Id, status AS Status, run_type AS RunType, source_run_id AS SourceRunId, salary_from AS SalaryFrom, salary_to AS SalaryTo,
                variables_from AS VariablesFrom, variables_to AS VariablesTo,
                expected_payment_date AS ExpectedPaymentDate, cutoff_at AS CutoffAt, created_by AS CreatedBy, version AS Version
            FROM payroll_runs
            ORDER BY salary_to DESC, created_at DESC
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<PayrollJournalLink?> GetJournalLinkAsync(Guid payrollRunId, Guid employeeId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollJournalLink>(new CommandDefinition("""
            SELECT id AS Id, payroll_run_id AS PayrollRunId, journal_entry_id AS JournalEntryId,
                posting_type AS PostingType, status AS Status
            FROM payroll_journal_links WHERE payroll_run_id = @payrollRunId AND posting_type = @postingType
              AND status = 'posted'
            """, new { payrollRunId, employeeId, postingType = $"accrual:{employeeId:N}" }, cancellationToken: ct));
    }

    public async Task SaveJournalLinkAsync(Guid payrollRunId, Guid employeeId, Guid journalEntryId,
        string postingType, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_journal_links (id, payroll_run_id, journal_entry_id, posting_type, status)
            VALUES (@Id, @PayrollRunId, @JournalEntryId, @PostingType, 'posted')
            ON CONFLICT (payroll_run_id, posting_type) DO UPDATE SET journal_entry_id = EXCLUDED.journal_entry_id, status = 'posted'
            """, new { Id = Guid.NewGuid(), PayrollRunId = payrollRunId, JournalEntryId = journalEntryId,
                PostingType = $"{postingType}:{employeeId:N}" }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollPayment>> ListPaymentsAsync(Guid payrollRunId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollPayment>(new CommandDefinition("""
            SELECT id AS Id, payroll_run_id AS PayrollRunId, employee_id AS EmployeeId,
                payment_method_code AS PaymentMethodCode, amount AS Amount,
                currency_code AS CurrencyCode, status AS Status,
                external_reference AS ExternalReference, idempotency_key AS IdempotencyKey
            FROM payroll_payments WHERE payroll_run_id = @payrollRunId ORDER BY employee_id
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollResultDetail>> ListResultDetailsAsync(Guid payrollResultId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollResultDetail>(new CommandDefinition("""
            SELECT id AS Id, payroll_result_id AS PayrollResultId, item_code AS ItemCode,
                amount AS Amount, formula_reference AS FormulaReference
            FROM payroll_result_details WHERE payroll_result_id = @payrollResultId ORDER BY item_code
            """, new { payrollResultId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task SaveResultDetailsAsync(Guid payrollRunId, Guid employeeId,
        IReadOnlyCollection<PayrollResultDetail> details, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var resultId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT id FROM payroll_results WHERE payroll_run_id = @payrollRunId AND employee_id = @employeeId",
            new { payrollRunId, employeeId }, cancellationToken: ct));
        if (resultId is null) throw new InvalidOperationException("Payroll result was not found.");
        using var transaction = await connection.BeginTransactionAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_result_details WHERE payroll_result_id = @resultId",
            new { resultId }, transaction, cancellationToken: ct));
        foreach (var detail in details)
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_result_details (id, payroll_result_id, item_code, amount, formula_reference)
                VALUES (@Id, @PayrollResultId, @ItemCode, @Amount, @FormulaReference)
                """, new { detail.Id, PayrollResultId = resultId.Value, detail.ItemCode,
                    detail.Amount, detail.FormulaReference }, transaction, cancellationToken: ct));
        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<PayrollResult>> ListResultsAsync(Guid payrollRunId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollResult>(new CommandDefinition("""
            SELECT id AS Id, payroll_run_id AS PayrollRunId, employee_id AS EmployeeId,
                currency_code AS CurrencyCode, gross_amount AS GrossAmount,
                deductions_amount AS DeductionsAmount, net_amount AS NetAmount,
                calculation_version AS CalculationVersion
            FROM payroll_results
            WHERE payroll_run_id = @payrollRunId
            ORDER BY employee_id
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<bool> UpdateStatusAsync(Guid id, int expectedVersion, string status,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE payroll_runs SET status = @status, version = version + 1
            WHERE id = @id AND version = @expectedVersion
            """, new { id, expectedVersion, status }, cancellationToken: ct)) == 1;
    }

    public async Task UpsertResultAsync(PayrollResult result, CancellationToken ct = default)
    {
        if (result.GrossAmount < 0 || result.DeductionsAmount < 0)
            throw new ArgumentOutOfRangeException(nameof(result), "Payroll amounts cannot be negative.");
        // الصافي قد يكون سالباً: دورة تسوية استقطاعات فقط = استرداد من الموظف (net = gross - deductions).
        if (string.IsNullOrWhiteSpace(result.CurrencyCode) || string.IsNullOrWhiteSpace(result.CalculationVersion))
            throw new ArgumentException("Currency and calculation version are required.", nameof(result));

        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_results
                (id, payroll_run_id, employee_id, currency_code, gross_amount, deductions_amount, net_amount, calculation_version)
            VALUES (@Id, @PayrollRunId, @EmployeeId, @CurrencyCode, @GrossAmount, @DeductionsAmount, @NetAmount, @CalculationVersion)
            ON CONFLICT (payroll_run_id, employee_id) DO UPDATE SET
                currency_code = EXCLUDED.currency_code, gross_amount = EXCLUDED.gross_amount,
                deductions_amount = EXCLUDED.deductions_amount, net_amount = EXCLUDED.net_amount,
                calculation_version = EXCLUDED.calculation_version
            """, result, cancellationToken: ct));
    }

    public async Task<Guid> AddPaymentAsync(PayrollPayment payment, CancellationToken ct = default)
    {
        if (payment.Amount <= 0 || string.IsNullOrWhiteSpace(payment.IdempotencyKey))
            throw new ArgumentException("A positive payment amount and idempotency key are required.", nameof(payment));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_payments
                (id, payroll_run_id, employee_id, payment_method_code, amount, currency_code,
                 status, external_reference, idempotency_key)
            VALUES (@Id, @PayrollRunId, @EmployeeId, @PaymentMethodCode, @Amount, @CurrencyCode,
                @Status, @ExternalReference, @IdempotencyKey)
            ON CONFLICT (idempotency_key) DO UPDATE SET id = payroll_payments.id
            RETURNING id
            """, payment, cancellationToken: ct));
    }

    private static void ValidateDates(PayrollRun run)
    {
        if (run.SalaryTo < run.SalaryFrom || run.VariablesTo < run.VariablesFrom)
            throw new ArgumentException("Payroll run date ranges are invalid.", nameof(run));
    }

    public async Task<IReadOnlyList<PayrollRunIssue>> ListIssuesAsync(Guid payrollRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollRunIssue>(new CommandDefinition("""
            SELECT id AS Id, payroll_run_id AS PayrollRunId, severity AS Severity, code AS Code,
                   message AS Message, is_overridden AS IsOverridden, override_reason AS OverrideReason
            FROM payroll_run_issues
            WHERE payroll_run_id = @payrollRunId
            ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'blocking' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                     code
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task AddIssueAsync(PayrollRunIssue issue, CancellationToken ct = default)
    {
        if (issue.Id == Guid.Empty) issue.Id = Guid.NewGuid();
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_run_issues
                (id, payroll_run_id, severity, code, message, is_overridden, override_reason)
            VALUES (@Id, @PayrollRunId, @Severity, @Code, @Message, @IsOverridden, @OverrideReason)
            """, new
        {
            issue.Id, issue.PayrollRunId, issue.Severity, issue.Code,
            issue.Message, issue.IsOverridden, issue.OverrideReason
        }, cancellationToken: ct));
    }

    public async Task ClearIssuesAsync(Guid payrollRunId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_run_issues WHERE payroll_run_id = @payrollRunId AND is_overridden = false",
            new { payrollRunId }, cancellationToken: ct));
    }

    public async Task<bool> OverrideIssueAsync(Guid issueId, string reason, Guid userId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("An override reason is required.", nameof(reason));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE payroll_run_issues
            SET is_overridden = true, override_reason = @reason, overridden_by = @userId
            WHERE id = @issueId AND is_overridden = false
            """, new { issueId, reason, userId }, cancellationToken: ct)) == 1;
    }

    public async Task<PayrollResult?> GetResultAsync(Guid payrollRunId, Guid employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollResult>(new CommandDefinition("""
            SELECT id AS Id, payroll_run_id AS PayrollRunId, employee_id AS EmployeeId,
                   currency_code AS CurrencyCode, gross_amount AS GrossAmount,
                   deductions_amount AS DeductionsAmount, net_amount AS NetAmount,
                   calculation_version AS CalculationVersion
            FROM payroll_results WHERE payroll_run_id = @payrollRunId AND employee_id = @employeeId
            """, new { payrollRunId, employeeId }, cancellationToken: ct));
    }

    public async Task<PayrollRunTotals> GetTotalsAsync(Guid payrollRunId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleAsync<PayrollRunTotals>(new CommandDefinition("""
            SELECT
                (SELECT count(*) FROM payroll_results WHERE payroll_run_id = @payrollRunId) AS EmployeeCount,
                COALESCE((SELECT sum(gross_amount) FROM payroll_results WHERE payroll_run_id = @payrollRunId), 0) AS GrossAmount,
                COALESCE((SELECT sum(deductions_amount) FROM payroll_results WHERE payroll_run_id = @payrollRunId), 0) AS DeductionsAmount,
                COALESCE((SELECT sum(net_amount) FROM payroll_results WHERE payroll_run_id = @payrollRunId), 0) AS NetAmount,
                (SELECT count(*) FROM payroll_run_issues WHERE payroll_run_id = @payrollRunId) AS IssueCount,
                (SELECT count(*) FROM payroll_run_issues
                  WHERE payroll_run_id = @payrollRunId AND is_overridden = false
                    AND severity IN ('critical','blocking')) AS BlockingIssueCount
            """, new { payrollRunId }, cancellationToken: ct));
    }

    public async Task UpsertRunEmployeeAsync(Guid payrollRunId, Guid employeeId, int runSegment,
        string status, Guid? branchId, decimal? workDays, string? engineVersion, string? errorCode,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_run_employees
                (id, run_id, employee_id, run_segment, branch_id, calculation_status,
                 attempts, error_code, engine_version, work_days, calculated_at)
            VALUES (@Id, @RunId, @EmployeeId, @RunSegment, @BranchId, @Status,
                    1, @ErrorCode, @EngineVersion, @WorkDays,
                    CASE WHEN @Status = 'calculated' THEN now() ELSE NULL END)
            ON CONFLICT (run_id, employee_id, run_segment) DO UPDATE SET
                calculation_status = EXCLUDED.calculation_status,
                attempts = payroll_run_employees.attempts + 1,
                error_code = EXCLUDED.error_code,
                engine_version = EXCLUDED.engine_version,
                branch_id = EXCLUDED.branch_id,
                work_days = COALESCE(EXCLUDED.work_days, payroll_run_employees.work_days),
                calculated_at = CASE WHEN EXCLUDED.calculation_status = 'calculated'
                                     THEN now() ELSE payroll_run_employees.calculated_at END,
                updated_at = now()
            """, new
        {
            Id = Guid.NewGuid(), RunId = payrollRunId, EmployeeId = employeeId,
            RunSegment = runSegment <= 0 ? 1 : runSegment, Status = status,
            BranchId = branchId, WorkDays = workDays, EngineVersion = engineVersion,
            ErrorCode = errorCode
        }, cancellationToken: ct));
    }

    public async Task ResetRunEmployeesAsync(Guid payrollRunId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE payroll_run_employees
            SET calculation_status = 'pending', error_code = NULL, updated_at = now()
            WHERE run_id = @payrollRunId AND calculation_status <> 'pending'
            """, new { payrollRunId }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollRunEmployeeState>> ListRunEmployeesAsync(Guid payrollRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollRunEmployeeState>(new CommandDefinition("""
            SELECT id AS Id, run_id AS RunId, employee_id AS EmployeeId, run_segment AS RunSegment,
                   branch_id AS BranchId, calculation_status AS CalculationStatus,
                   attempts AS Attempts, error_code AS ErrorCode, engine_version AS EngineVersion,
                   work_days AS WorkDays, calculated_at AS CalculatedAt
            FROM payroll_run_employees
            WHERE run_id = @payrollRunId
            ORDER BY employee_id
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<PayrollRunEmployeeStats> GetRunEmployeeStatsAsync(Guid payrollRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleAsync<PayrollRunEmployeeStats>(new CommandDefinition("""
            SELECT count(*) AS Total,
                   count(*) FILTER (WHERE calculation_status = 'pending') AS Pending,
                   count(*) FILTER (WHERE calculation_status = 'calculating') AS Calculating,
                   count(*) FILTER (WHERE calculation_status = 'calculated') AS Calculated,
                   count(*) FILTER (WHERE calculation_status = 'failed') AS Failed,
                   count(*) FILTER (WHERE calculation_status = 'skipped') AS Skipped
            FROM payroll_run_employees WHERE run_id = @payrollRunId
            """, new { payrollRunId }, cancellationToken: ct));
    }
}
