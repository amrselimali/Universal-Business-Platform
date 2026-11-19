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
                (id, status, salary_from, salary_to, variables_from, variables_to, expected_payment_date, created_by)
            VALUES (@Id, @Status, @SalaryFrom, @SalaryTo, @VariablesFrom, @VariablesTo, @ExpectedPaymentDate, @userId)
            RETURNING id
            """, new { run.Id, run.Status, run.SalaryFrom, run.SalaryTo, run.VariablesFrom,
                run.VariablesTo, run.ExpectedPaymentDate, userId }, cancellationToken: ct));
    }

    public async Task<PayrollRun?> GetAsync(Guid id, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollRun>(new CommandDefinition("""
            SELECT id AS Id, status AS Status, salary_from AS SalaryFrom, salary_to AS SalaryTo,
                variables_from AS VariablesFrom, variables_to AS VariablesTo,
                expected_payment_date AS ExpectedPaymentDate, version AS Version
            FROM payroll_runs WHERE id = @id
            """, new { id }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollRun>> ListAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollRun>(new CommandDefinition("""
            SELECT id AS Id, status AS Status, salary_from AS SalaryFrom, salary_to AS SalaryTo,
                variables_from AS VariablesFrom, variables_to AS VariablesTo,
                expected_payment_date AS ExpectedPaymentDate, version AS Version
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
        if (result.GrossAmount < 0 || result.DeductionsAmount < 0 || result.NetAmount < 0)
            throw new ArgumentOutOfRangeException(nameof(result), "Payroll amounts cannot be negative.");
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
}
