using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollOperationsRepository
{
    Task<IReadOnlyList<PayrollAttendanceDaily>> ListAttendanceAsync(DateOnly from, DateOnly to, Guid? employeeId = null, CancellationToken ct = default);
    Task UpsertAttendanceAsync(PayrollAttendanceDaily attendance, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollLeaveRequest>> ListLeavesAsync(DateOnly from, DateOnly to, Guid? employeeId = null, CancellationToken ct = default);
    Task<Guid> CreateLeaveAsync(PayrollLeaveRequest leave, CancellationToken ct = default);
    Task<PayrollLeaveRequest?> GetLeaveAsync(Guid leaveId, CancellationToken ct = default);
    /// <summary>اعتماد طلب إجازة (يحوّل الحالة إلى approved) — صاحب صلاحية اعتماد الإجازات.</summary>
    Task<bool> ApproveLeaveAsync(Guid leaveId, Guid userId, CancellationToken ct = default);
    /// <summary>اعتماد يوميات الحضور في نطاق تاريخي (لا تُعدَّل بعد الاعتماد بصمت).</summary>
    Task<int> ApproveAttendanceAsync(DateOnly from, DateOnly to, Guid? employeeId, Guid userId,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollAdjustment>> ListAdjustmentsAsync(DateOnly from, DateOnly to, Guid? employeeId = null, CancellationToken ct = default);
    Task<Guid> CreateAdjustmentAsync(PayrollAdjustment adjustment, CancellationToken ct = default);
    Task<IReadOnlyList<EmployeeLoan>> ListLoansAsync(Guid? employeeId = null, CancellationToken ct = default);
    Task<Guid> CreateLoanAsync(EmployeeLoan loan, CancellationToken ct = default);
}

public sealed class PayrollOperationsRepository : IPayrollOperationsRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollOperationsRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<PayrollAttendanceDaily>> ListAttendanceAsync(DateOnly from, DateOnly to,
        Guid? employeeId = null, CancellationToken ct = default)
    {
        ValidateRange(from, to);
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollAttendanceDaily>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, work_date AS WorkDate,
                worked_hours AS WorkedHours, overtime_hours AS OvertimeHours,
                absence_hours AS AbsenceHours, status AS Status, version AS Version
            FROM attendance_daily
            WHERE work_date BETWEEN @from AND @to AND (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY work_date, employee_id
            """, new { from, to, employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task UpsertAttendanceAsync(PayrollAttendanceDaily attendance, CancellationToken ct = default)
    {
        if (attendance.WorkedHours < 0 || attendance.OvertimeHours < 0 || attendance.AbsenceHours < 0)
            throw new ArgumentOutOfRangeException(nameof(attendance), "Attendance hours cannot be negative.");
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO attendance_daily
                (id, employee_id, work_date, worked_hours, overtime_hours, absence_hours, status)
            VALUES (@Id, @EmployeeId, @WorkDate, @WorkedHours, @OvertimeHours, @AbsenceHours, @Status)
            ON CONFLICT (employee_id, work_date) DO UPDATE SET
                worked_hours = EXCLUDED.worked_hours, overtime_hours = EXCLUDED.overtime_hours,
                absence_hours = EXCLUDED.absence_hours, status = EXCLUDED.status,
                version = attendance_daily.version + 1
            """, attendance, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollLeaveRequest>> ListLeavesAsync(DateOnly from, DateOnly to,
        Guid? employeeId = null, CancellationToken ct = default)
    {
        ValidateRange(from, to);
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollLeaveRequest>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, leave_type_code AS LeaveTypeCode,
                from_date AS FromDate, to_date AS ToDate, days AS Days, status AS Status
            FROM leave_requests
            WHERE to_date >= @from AND from_date <= @to
              AND (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY from_date, employee_id
            """, new { from, to, employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateLeaveAsync(PayrollLeaveRequest leave, CancellationToken ct = default)
    {
        if (leave.ToDate < leave.FromDate || leave.Days < 0 || string.IsNullOrWhiteSpace(leave.LeaveTypeCode))
            throw new ArgumentException("Leave type and a valid non-negative date range are required.", nameof(leave));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO leave_requests
                (id, employee_id, leave_type_code, from_date, to_date, days, status)
            VALUES (@Id, @EmployeeId, @LeaveTypeCode, @FromDate, @ToDate, @Days, @Status)
            RETURNING id
            """, leave, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollAdjustment>> ListAdjustmentsAsync(DateOnly from, DateOnly to,
        Guid? employeeId = null, CancellationToken ct = default)
    {
        ValidateRange(from, to);
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollAdjustment>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, payroll_item_id AS PayrollItemId,
                amount AS Amount, effective_date AS EffectiveDate, is_taxable AS IsTaxable,
                is_insurable AS IsInsurable, status AS Status
            FROM payroll_adjustments
            WHERE effective_date BETWEEN @from AND @to
              AND (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY effective_date, employee_id
            """, new { from, to, employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateAdjustmentAsync(PayrollAdjustment adjustment, CancellationToken ct = default)
    {
        if (adjustment.Amount == 0) throw new ArgumentOutOfRangeException(nameof(adjustment.Amount));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_adjustments
                (id, employee_id, payroll_item_id, amount, effective_date, is_taxable, is_insurable, status)
            VALUES (@Id, @EmployeeId, @PayrollItemId, @Amount, @EffectiveDate,
                @IsTaxable, @IsInsurable, @Status)
            RETURNING id
            """, adjustment, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<EmployeeLoan>> ListLoansAsync(Guid? employeeId = null, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<EmployeeLoan>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, principal AS Principal,
                outstanding_balance AS OutstandingBalance, installments AS Installments, status AS Status
            FROM employee_loans
            WHERE (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY created_at DESC
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateLoanAsync(EmployeeLoan loan, CancellationToken ct = default)
    {
        if (loan.Principal <= 0 || loan.Installments <= 0)
            throw new ArgumentOutOfRangeException(nameof(loan), "Principal and installments must be positive.");
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO employee_loans
                (id, employee_id, principal, outstanding_balance, installments, status)
            VALUES (@Id, @EmployeeId, @Principal, @Principal, @Installments, @Status)
            RETURNING id
            """, loan, cancellationToken: ct));
    }

    public async Task<PayrollLeaveRequest?> GetLeaveAsync(Guid leaveId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollLeaveRequest>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, leave_type_code AS LeaveTypeCode,
                   from_date AS FromDate, to_date AS ToDate, days AS Days, status AS Status
            FROM leave_requests WHERE id = @leaveId
            """, new { leaveId }, cancellationToken: ct));
    }

    public async Task<bool> ApproveLeaveAsync(Guid leaveId, Guid userId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE leave_requests SET status = 'approved'
            WHERE id = @leaveId AND status <> 'approved'
            """, new { leaveId }, cancellationToken: ct)) == 1;
    }

    public async Task<int> ApproveAttendanceAsync(DateOnly from, DateOnly to, Guid? employeeId,
        Guid userId, CancellationToken ct = default)
    {
        ValidateRange(from, to);
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE attendance_daily
            SET status = 'approved', version = version + 1
            WHERE work_date BETWEEN @from AND @to
              AND status <> 'approved'
              AND (@employeeId IS NULL OR employee_id = @employeeId)
            """, new { from, to, employeeId }, cancellationToken: ct));
    }

    private static void ValidateRange(DateOnly from, DateOnly to)
    {
        if (to < from) throw new ArgumentException("The date range is invalid.");
    }
}
