using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// إسناد الموظف المسؤول وتمديد صلاحية العرض (مفصولة عن كتابة الحجز للحفاظ على حدود الملف).
/// </summary>
public sealed partial class BookingRepository
{
    /// <summary>
    /// 0214: الموظف المسند يجب أن يكون من فرع الحجز (أو موظفاً على مستوى الشركة بلا فرع)
    /// حتى لا يُسجَّل تنفيذ حجز فرع بموظف فرع آخر.
    /// </summary>
    private static async Task EnsureEmployeeInBookingBranchAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid branchId, Guid? employeeId, CancellationToken ct)
    {
        if (employeeId is not { } id) return;
        var employeeBranch = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT branch_id FROM employees WHERE id = @id", new { id }, tx,
            cancellationToken: ct));
        if (!BookingExecutionRules.EmployeeBelongsToBranch(employeeBranch, branchId))
            throw new ValidationAppException(BookingExecutionRules.BranchMismatchCode);
    }

    public async Task<Booking> AssignEmployeeAsync(Guid id, Guid employeeId, string role,
        Guid userId, CancellationToken ct = default)
    {
        if (role is not ("owner" or "executor"))
            throw new ValidationAppException("validation.assignment_role");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var booking = await connection.QuerySingleOrDefaultAsync<(Guid BranchId, string Status)>(
            new CommandDefinition(
                "SELECT branch_id AS BranchId, status AS Status FROM bookings WHERE id = @id FOR UPDATE",
                new { id }, tx, cancellationToken: ct));
        if (booking.Status is null) throw new NotFoundAppException();
        if (booking.Status is BookingStatuses.Completed or BookingStatuses.Cancelled)
            throw new ValidationAppException("validation.booking_closed");

        await EnsureEmployeeInBookingBranchAsync(connection, tx, booking.BranchId, employeeId, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_assignments SET unassigned_at = now()
            WHERE booking_id = @id AND role = @role AND unassigned_at IS NULL
            """, new { id, role }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO booking_assignments (booking_id, employee_id, role, assigned_by)
            VALUES (@id, @employeeId, @role, @userId)
            """, new { id, employeeId, role, userId }, tx, cancellationToken: ct));

        if (role == "owner")
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE bookings SET assigned_employee_id = @employeeId, updated_by = @userId " +
                "WHERE id = @id", new { employeeId, userId, id }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (await GetAsync(id, ct))!;
    }

    /// <summary>
    /// إسناد الموظف المسؤول للحجز بلا دور ظاهر: يُغلق إسناد «المسؤول» السابق ويضيف إسناداً
    /// جديداً بالدور الافتراضي التاريخي <c>owner</c> (نفس معنى الموظف المسؤول)، ويثبّت
    /// <c>bookings.assigned_employee_id</c> في نفس المعاملة. لا يمس إسنادات الأدوار الأخرى
    /// (مثل executor) حفاظاً على التوافقية العكسية.
    /// </summary>
    public async Task<Booking> AssignResponsibleEmployeeAsync(Guid id, Guid employeeId,
        Guid userId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var booking = await connection.QuerySingleOrDefaultAsync<(Guid BranchId, string Status)>(
            new CommandDefinition(
                "SELECT branch_id AS BranchId, status AS Status FROM bookings WHERE id = @id FOR UPDATE",
                new { id }, tx, cancellationToken: ct));
        if (booking.Status is null) throw new NotFoundAppException();
        if (booking.Status is BookingStatuses.Completed or BookingStatuses.Cancelled)
            throw new ValidationAppException("validation.booking_closed");

        await EnsureDraftEmployeeAsync(connection, tx, employeeId, ct);
        await EnsureEmployeeInBookingBranchAsync(connection, tx, booking.BranchId, employeeId, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE booking_assignments SET unassigned_at = now()
            WHERE booking_id = @id AND role = 'owner' AND unassigned_at IS NULL
            """, new { id }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO booking_assignments (booking_id, employee_id, role, assigned_by)
            VALUES (@id, @employeeId, 'owner', @userId)
            """, new { id, employeeId, userId }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings SET assigned_employee_id = @employeeId, updated_by = @userId
            WHERE id = @id
            """, new { employeeId, userId, id }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (await GetAsync(id, ct))!;
    }

    public async Task<bool> ExtendAsync(Guid id, DateTimeOffset newExpiry, Guid userId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE bookings SET expires_at = @newExpiry, updated_by = @userId
            WHERE id = @id
              AND status IN ('draft', 'confirmed', 'partially_delivered', 'expired')
            """, new { id, newExpiry = DbTime.Utc(newExpiry), userId },
            cancellationToken: ct)) > 0;
    }
}
