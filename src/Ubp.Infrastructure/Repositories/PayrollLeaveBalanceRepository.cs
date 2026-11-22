using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollLeaveBalanceRepository
{
    Task<IReadOnlyList<PayrollLeaveBalance>> ListAsync(Guid? employeeId, CancellationToken ct = default);
    Task<PayrollLeaveBalance?> GetAsync(Guid employeeId, string leaveTypeCode, DateOnly asOf,
        CancellationToken ct = default);
    Task<Guid> SetOpeningAsync(Guid employeeId, string leaveTypeCode, DateOnly balanceDate,
        decimal opening, bool carryOverAllowed, decimal? carryOverLimit, CancellationToken ct = default);
    /// <summary>
    /// استحقاق سنوي/دوري إضافي للرصيد، مع منع التكرار لنفس المرجع (إعادة التشغيل لا تُضاعف الرصيد).
    /// </summary>
    Task<Guid> AccrueAsync(Guid employeeId, string leaveTypeCode, DateOnly balanceDate, decimal days,
        bool carryOverAllowed, decimal? carryOverLimit, string reference, CancellationToken ct = default);
    Task<bool> ConsumeAsync(Guid employeeId, string leaveTypeCode, DateOnly date, decimal days,
        Guid? referenceId, string? notes, CancellationToken ct = default);
}

/// <summary>أرصدة الإجازات وحركاتها: رصيد افتتاحي، خصم عند الاعتماد، وترحيل بين السنوات.</summary>
public sealed class PayrollLeaveBalanceRepository : IPayrollLeaveBalanceRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollLeaveBalanceRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<PayrollLeaveBalance>> ListAsync(Guid? employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollLeaveBalance>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, leave_type_code AS LeaveTypeCode,
                   balance_date AS BalanceDate, opening_balance AS OpeningBalance,
                   used_balance AS UsedBalance, remaining_balance AS RemainingBalance,
                   carry_over_allowed AS CarryOverAllowed, carry_over_limit AS CarryOverLimit,
                   version AS Version
            FROM leave_balances
            WHERE (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY balance_date DESC, leave_type_code
            LIMIT 500
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<PayrollLeaveBalance?> GetAsync(Guid employeeId, string leaveTypeCode, DateOnly asOf,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollLeaveBalance>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, leave_type_code AS LeaveTypeCode,
                   balance_date AS BalanceDate, opening_balance AS OpeningBalance,
                   used_balance AS UsedBalance, remaining_balance AS RemainingBalance,
                   carry_over_allowed AS CarryOverAllowed, carry_over_limit AS CarryOverLimit,
                   version AS Version
            FROM leave_balances
            WHERE employee_id = @employeeId AND leave_type_code = @leaveTypeCode
              AND balance_date <= @asOf
            ORDER BY balance_date DESC
            LIMIT 1
            """, new { employeeId, leaveTypeCode, asOf }, cancellationToken: ct));
    }

    public async Task<Guid> SetOpeningAsync(Guid employeeId, string leaveTypeCode, DateOnly balanceDate,
        decimal opening, bool carryOverAllowed, decimal? carryOverLimit, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(leaveTypeCode))
            throw new ArgumentException("Leave type is required.", nameof(leaveTypeCode));
        if (opening < 0) throw new ArgumentOutOfRangeException(nameof(opening));

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO leave_balances
                (id, employee_id, leave_type_code, balance_date, opening_balance,
                 used_balance, remaining_balance, carry_over_allowed, carry_over_limit)
            VALUES (@Id, @EmployeeId, @LeaveTypeCode, @BalanceDate, @Opening,
                    0, @Opening, @CarryOverAllowed, @CarryOverLimit)
            ON CONFLICT (employee_id, leave_type_code, balance_date) DO UPDATE SET
                opening_balance = EXCLUDED.opening_balance,
                remaining_balance = EXCLUDED.opening_balance - leave_balances.used_balance,
                carry_over_allowed = EXCLUDED.carry_over_allowed,
                carry_over_limit = EXCLUDED.carry_over_limit,
                version = leave_balances.version + 1,
                updated_at = now()
            RETURNING id
            """, new
        {
            Id = Guid.NewGuid(), EmployeeId = employeeId, LeaveTypeCode = leaveTypeCode.Trim(),
            BalanceDate = balanceDate, Opening = opening, CarryOverAllowed = carryOverAllowed,
            CarryOverLimit = carryOverLimit
        }, cancellationToken: ct));
    }

    /// <summary>
    /// استحقاق إضافي: يُضاف للرصيد الافتتاحي والمتبقي، ويُسجّل حركة ACCRUAL.
    /// المرجع (ACCRUAL-YYYY) يجعل العملية idempotent عند إعادة التشغيل.
    /// </summary>
    public async Task<Guid> AccrueAsync(Guid employeeId, string leaveTypeCode, DateOnly balanceDate,
        decimal days, bool carryOverAllowed, decimal? carryOverLimit, string reference,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(leaveTypeCode))
            throw new ArgumentException("Leave type is required.", nameof(leaveTypeCode));
        if (days < 0) throw new ArgumentOutOfRangeException(nameof(days));
        if (string.IsNullOrWhiteSpace(reference))
            throw new ArgumentException("An accrual reference is required.", nameof(reference));

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);

        var balanceId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM leave_balances
            WHERE employee_id = @employeeId AND leave_type_code = @leaveTypeCode
              AND balance_date = @balanceDate
            """, new { employeeId, leaveTypeCode = leaveTypeCode.Trim(), balanceDate },
            transaction, cancellationToken: ct));

        if (balanceId is null)
        {
            balanceId = Guid.NewGuid();
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO leave_balances
                    (id, employee_id, leave_type_code, balance_date, opening_balance,
                     used_balance, remaining_balance, carry_over_allowed, carry_over_limit)
                VALUES (@Id, @EmployeeId, @LeaveTypeCode, @BalanceDate, @Days,
                        0, @Days, @CarryOverAllowed, @CarryOverLimit)
                """, new
            {
                Id = balanceId.Value, EmployeeId = employeeId, LeaveTypeCode = leaveTypeCode.Trim(),
                BalanceDate = balanceDate, Days = days, CarryOverAllowed = carryOverAllowed,
                CarryOverLimit = carryOverLimit
            }, transaction, cancellationToken: ct));
        }
        else
        {
            var alreadyApplied = await connection.ExecuteScalarAsync<bool>(new CommandDefinition("""
                SELECT EXISTS (
                    SELECT 1 FROM leave_transaction_history
                    WHERE balance_id = @balanceId
                      AND transaction_type = 'ACCRUAL'
                      AND notes = @reference)
                """, new { balanceId = balanceId.Value, reference }, transaction, cancellationToken: ct));

            if (alreadyApplied)
            {
                await transaction.CommitAsync(ct);
                return balanceId.Value;
            }

            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE leave_balances
                SET opening_balance = opening_balance + @Days,
                    remaining_balance = remaining_balance + @Days,
                    carry_over_allowed = @CarryOverAllowed,
                    carry_over_limit = @CarryOverLimit,
                    version = version + 1,
                    updated_at = now()
                WHERE id = @Id
                """, new
            {
                Id = balanceId.Value, Days = days, CarryOverAllowed = carryOverAllowed,
                CarryOverLimit = carryOverLimit
            }, transaction, cancellationToken: ct));
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO leave_transaction_history
                (id, balance_id, transaction_date, transaction_type, quantity,
                 reference_type, reference_id, notes)
            VALUES (@Id, @BalanceId, @TransactionDate, 'ACCRUAL', @Days, 'ACCRUAL', NULL, @Reference)
            """, new
        {
            Id = Guid.NewGuid(), BalanceId = balanceId.Value, TransactionDate = balanceDate,
            Days = days, Reference = reference
        }, transaction, cancellationToken: ct));

        await transaction.CommitAsync(ct);
        return balanceId.Value;
    }

    public async Task<bool> ConsumeAsync(Guid employeeId, string leaveTypeCode, DateOnly date, decimal days,
        Guid? referenceId, string? notes, CancellationToken ct = default)
    {
        if (days <= 0) return false;
        var balance = await GetAsync(employeeId, leaveTypeCode, date, ct);
        if (balance is null || balance.RemainingBalance < days) return false;

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);
        var updated = await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE leave_balances
            SET used_balance = used_balance + @days,
                remaining_balance = remaining_balance - @days,
                version = version + 1, updated_at = now()
            WHERE id = @Id AND remaining_balance >= @days
            """, new { Id = balance.Id, days }, transaction, cancellationToken: ct));
        if (updated != 1)
        {
            await transaction.RollbackAsync(ct);
            return false;
        }

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO leave_transaction_history
                (id, balance_id, transaction_date, transaction_type, quantity,
                 reference_type, reference_id, notes)
            VALUES (@Id, @BalanceId, @TransactionDate, 'USED', @Quantity, 'LEAVE', @ReferenceId, @Notes)
            """, new
        {
            Id = Guid.NewGuid(), BalanceId = balance.Id, TransactionDate = date,
            Quantity = days, ReferenceId = referenceId, Notes = notes
        }, transaction, cancellationToken: ct));

        await transaction.CommitAsync(ct);
        return true;
    }
}
