using Dapper;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    /// <summary>
    /// الموظفون النشطون في فرع الشفت فقط (بدون موظفي الشركة الذين branch_id فارغ)
    /// الذين ليس لهم موعد ولا إجازة داخل الفرع تغطي يوم الإغلاق المطلوب.
    /// </summary>
    public async Task<IReadOnlyList<string>> ListEmployeesWithoutDayScheduleAsync(Guid branchId,
        DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken ct = default)
    {
        const string sql = """
            SELECT e.code || ' — ' || e.name_ar
            FROM employees e
            WHERE e.is_active
              AND e.branch_id = @branchId
              AND NOT EXISTS (
                    SELECT 1 FROM appointments a
                    WHERE a.employee_id = e.id
                      AND a.branch_id = @branchId
                      AND a.status <> 'cancelled'
                      AND a.starts_at < @toUtc AND a.ends_at > @fromUtc
              )
            ORDER BY e.name_ar
            """;
        await using var connection = await _factory.OpenAsync(ct);
        var names = await connection.QueryAsync<string>(new CommandDefinition(sql,
            new { branchId, fromUtc, toUtc }, cancellationToken: ct));
        return names.ToList();
    }
}
