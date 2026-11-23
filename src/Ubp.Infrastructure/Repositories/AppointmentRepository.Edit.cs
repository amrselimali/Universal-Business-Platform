using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class AppointmentRepository
{
    /// <summary>
    /// حجوزات مؤكدة للموظف تقع خارج وقت الدوام الجديد، وتتقاطع مع الدوام القديم أو الجديد
    /// (حتى لا تُمس حجوزات دوامات أخرى لنفس الموظف)، وبلا كميات منفَّذة بالفعل.
    /// </summary>
    private const string ImpactSql = """
        FROM bookings b
        JOIN customers c ON c.id = b.customer_id
        WHERE b.assigned_employee_id = @employeeId
          AND b.status = 'confirmed'
          AND b.starts_at IS NOT NULL AND b.ends_at IS NOT NULL
          AND (b.starts_at < @NewStarts OR b.ends_at > @NewEnds)
          AND ((b.starts_at < @OldEnds AND b.ends_at > @OldStarts)
               OR (b.starts_at < @NewEnds AND b.ends_at > @NewStarts))
          AND NOT EXISTS (SELECT 1 FROM booking_lines l
                          WHERE l.booking_id = b.id AND l.delivered_qty > 0)
        """;

    public async Task<IReadOnlyList<AppointmentImpactBooking>> ListConfirmedBookingsOutsideAsync(
        Guid id, DateTimeOffset newStarts, DateTimeOffset newEnds, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var current = await connection.QuerySingleOrDefaultAsync<(Guid EmployeeId,
            DateTimeOffset StartsAt, DateTimeOffset EndsAt)>(new CommandDefinition("""
            SELECT employee_id AS EmployeeId, starts_at AS StartsAt, ends_at AS EndsAt
            FROM appointments WHERE id = @id
            """, new { id }, cancellationToken: ct));
        if (current.EmployeeId == Guid.Empty) throw new NotFoundAppException();

        return (await connection.QueryAsync<AppointmentImpactBooking>(new CommandDefinition($"""
            SELECT b.id AS BookingId, b.doc_no AS BookingNo, c.name_ar AS CustomerName,
                   b.starts_at AS StartsAt, b.ends_at AS EndsAt
            {ImpactSql}
            ORDER BY b.starts_at
            """, new { employeeId = current.EmployeeId,
                NewStarts = DbTime.Utc(newStarts), NewEnds = DbTime.Utc(newEnds),
                OldStarts = current.StartsAt, OldEnds = current.EndsAt },
            cancellationToken: ct))).ToList();
    }

    public async Task<AppointmentUpdateResult> UpdateAsync(Guid id, int version,
        AppointmentInput input, bool revertOutsideBookings, Guid userId,
        CancellationToken ct = default)
    {
        if (input.EndsAt <= input.StartsAt)
            throw new ValidationAppException("validation.appointment_range");

        var newStarts = DbTime.Utc(input.StartsAt);
        var newEnds = DbTime.Utc(input.EndsAt);

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var current = await connection.QuerySingleOrDefaultAsync<(Guid EmployeeId,
            DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Status)>(new CommandDefinition("""
            SELECT employee_id AS EmployeeId, starts_at AS StartsAt, ends_at AS EndsAt, status
            FROM appointments WHERE id = @id FOR UPDATE
            """, new { id }, tx, cancellationToken: ct));
        if (current.EmployeeId == Guid.Empty) throw new NotFoundAppException();
        // الدوام الملغى لا يُعدَّل: يُعاد فتحه/إنشاؤه من جديد بدل تعديل سجل ملغى.
        if (current.Status == AppointmentStatuses.Cancelled)
            throw new ValidationAppException("validation.appointment_status");

        try
        {
            var updated = await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE appointments
                SET starts_at = @newStarts, ends_at = @newEnds, notes = @Notes,
                    is_leave = @IsLeave, updated_by = @userId
                WHERE id = @id AND version = @version
                """, new { newStarts, newEnds, input.Notes, input.IsLeave, userId, id, version },
                tx, cancellationToken: ct));
            if (updated == 0) throw new ConflictException();
        }
        catch (PostgresException ex) when (ex.SqlState == "23P01")
        {
            await tx.RollbackAsync(ct);
            throw new ValidationAppException("validation.appointment_overlap");
        }

        var reverted = 0;
        if (revertOutsideBookings)
        {
            var ids = (await connection.QueryAsync<Guid>(new CommandDefinition($"""
                SELECT b.id
                {ImpactSql}
                """, new { employeeId = current.EmployeeId, NewStarts = newStarts,
                    NewEnds = newEnds, OldStarts = current.StartsAt,
                    OldEnds = current.EndsAt }, tx, cancellationToken: ct))).ToList();
            reverted = await RevertBookingsAsync(connection, tx, ids, userId, ct);
        }

        await tx.CommitAsync(ct);
        return new AppointmentUpdateResult
        {
            Appointment = (await GetAsync(id, ct))!,
            RevertedBookings = reverted
        };
    }
}
