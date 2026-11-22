using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollShiftRepository
{
    Task<IReadOnlyList<AttendanceShift>> ListAsync(CancellationToken ct = default);
    Task<Guid> UpsertAsync(AttendanceShift shift, CancellationToken ct = default);
    Task<IReadOnlyList<AttendanceShiftAssignment>> ListAssignmentsAsync(Guid? employeeId,
        CancellationToken ct = default);
    Task<Guid> AssignAsync(AttendanceShiftAssignment assignment, CancellationToken ct = default);
    Task<AttendanceShiftAssignment?> GetAssignmentAsync(Guid employeeId, DateOnly date,
        CancellationToken ct = default);
}

/// <summary>الورديات وإسنادها للموظفين بفترات سريان — على الجداول الجديدة 0208.</summary>
public sealed class PayrollShiftRepository : IPayrollShiftRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollShiftRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<AttendanceShift>> ListAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<AttendanceShift>(new CommandDefinition("""
            SELECT id AS Id, company_id AS CompanyId, branch_id AS BranchId, code AS Code,
                   name_ar AS NameAr, to_char(start_time, 'HH24:MI') AS StartTime,
                   to_char(end_time, 'HH24:MI') AS EndTime, crosses_midnight AS CrossesMidnight,
                   break_minutes AS BreakMinutes, grace_minutes AS GraceMinutes,
                   overtime_after_minutes AS OvertimeAfterMinutes, is_active AS IsActive,
                   version AS Version
            FROM attendance_shifts
            ORDER BY code
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> UpsertAsync(AttendanceShift shift, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(shift.Code) || string.IsNullOrWhiteSpace(shift.NameAr))
            throw new ArgumentException("Shift code and Arabic name are required.", nameof(shift));
        if (!TimeOnly.TryParse(shift.StartTime, out var start) || !TimeOnly.TryParse(shift.EndTime, out var end))
            throw new ArgumentException("Shift times must use HH:mm format.", nameof(shift));

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO attendance_shifts
                (id, company_id, branch_id, code, name_ar, start_time, end_time, crosses_midnight,
                 break_minutes, grace_minutes, overtime_after_minutes, is_active)
            VALUES (@Id, @CompanyId, @BranchId, @Code, @NameAr, @Start, @End, @CrossesMidnight,
                    @BreakMinutes, @GraceMinutes, @OvertimeAfterMinutes, @IsActive)
            ON CONFLICT (company_id, code) DO UPDATE SET
                name_ar = EXCLUDED.name_ar, start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time, crosses_midnight = EXCLUDED.crosses_midnight,
                break_minutes = EXCLUDED.break_minutes, grace_minutes = EXCLUDED.grace_minutes,
                overtime_after_minutes = EXCLUDED.overtime_after_minutes,
                is_active = EXCLUDED.is_active, version = attendance_shifts.version + 1
            RETURNING id
            """, new
        {
            Id = shift.Id == Guid.Empty ? Guid.NewGuid() : shift.Id, shift.CompanyId, shift.BranchId,
            shift.Code, shift.NameAr, Start = start, End = end, shift.CrossesMidnight,
            shift.BreakMinutes, shift.GraceMinutes, shift.OvertimeAfterMinutes, shift.IsActive
        }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<AttendanceShiftAssignment>> ListAssignmentsAsync(Guid? employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<AttendanceShiftAssignment>(new CommandDefinition("""
            SELECT a.id AS Id, a.employee_id AS EmployeeId, a.shift_id AS ShiftId,
                   s.code AS ShiftCode, a.effective_from AS EffectiveFrom, a.effective_to AS EffectiveTo
            FROM attendance_shift_assignments a
            JOIN attendance_shifts s ON s.id = a.shift_id
            WHERE a.is_active AND (@employeeId IS NULL OR a.employee_id = @employeeId)
            ORDER BY a.effective_from DESC
            LIMIT 500
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> AssignAsync(AttendanceShiftAssignment assignment, CancellationToken ct = default)
    {
        if (assignment.EffectiveTo is not null && assignment.EffectiveTo < assignment.EffectiveFrom)
            throw new ArgumentException("Shift assignment effective range is invalid.", nameof(assignment));

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO attendance_shift_assignments
                (id, employee_id, shift_id, effective_from, effective_to, is_active)
            VALUES (@Id, @EmployeeId, @ShiftId, @EffectiveFrom, @EffectiveTo, true)
            ON CONFLICT (employee_id, effective_from) DO UPDATE SET
                shift_id = EXCLUDED.shift_id, effective_to = EXCLUDED.effective_to, is_active = true
            RETURNING id
            """, new
        {
            Id = assignment.Id == Guid.Empty ? Guid.NewGuid() : assignment.Id,
            assignment.EmployeeId, assignment.ShiftId, assignment.EffectiveFrom, assignment.EffectiveTo
        }, cancellationToken: ct));
    }

    public async Task<AttendanceShiftAssignment?> GetAssignmentAsync(Guid employeeId, DateOnly date,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<AttendanceShiftAssignment>(new CommandDefinition("""
            SELECT a.id AS Id, a.employee_id AS EmployeeId, a.shift_id AS ShiftId,
                   s.code AS ShiftCode, a.effective_from AS EffectiveFrom, a.effective_to AS EffectiveTo
            FROM attendance_shift_assignments a
            JOIN attendance_shifts s ON s.id = a.shift_id
            WHERE a.employee_id = @employeeId AND a.is_active
              AND a.effective_from <= @date AND (a.effective_to IS NULL OR a.effective_to >= @date)
            ORDER BY a.effective_from DESC
            LIMIT 1
            """, new { employeeId, date }, cancellationToken: ct));
    }
}
