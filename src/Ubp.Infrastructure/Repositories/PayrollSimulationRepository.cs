using Dapper;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed class PayrollSimulationSave
{
    public Guid EmployeeId { get; init; }
    public Guid? RunId { get; init; }
    public string SimulationType { get; init; } = "CURRENT";
    public decimal? OriginalNet { get; init; }
    public decimal SimulatedNet { get; init; }
    public Guid? ChangedBy { get; init; }
    public IReadOnlyList<PayrollSimulationOverrideInput> Overrides { get; init; } =
        Array.Empty<PayrollSimulationOverrideInput>();
    public IReadOnlyList<PayrollSimulationResultInput> Results { get; init; } =
        Array.Empty<PayrollSimulationResultInput>();
}

public sealed record PayrollSimulationOverrideInput(string Field, string? Original, string? New, string? Reason);
public sealed record PayrollSimulationResultInput(string Component, decimal Amount);

public sealed class PayrollSimulationSummary
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string SimulationType { get; set; } = "";
    public string Status { get; set; } = "";
    public decimal? OriginalNet { get; set; }
    public decimal? SimulatedNet { get; set; }
    public decimal? Difference { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// حفظ سيناريوهات المحاكاة كمرجع فقط (بند 14.2): تُكتب في payroll_simulation_runs/overrides/results
/// ولا تُنشئ تشغيلاً ولا تمسّ النتائج المعتمدة أو الأرصدة.
/// </summary>
public interface IPayrollSimulationRepository
{
    Task<Guid> SaveAsync(Guid companyId, PayrollSimulationSave model, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollSimulationSummary>> ListAsync(Guid? employeeId,
        CancellationToken ct = default);
}

public sealed class PayrollSimulationRepository : IPayrollSimulationRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollSimulationRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<Guid> SaveAsync(Guid companyId, PayrollSimulationSave model,
        CancellationToken ct = default)
    {
        if (model.EmployeeId == Guid.Empty)
            throw new ArgumentException("Simulation requires an employee.", nameof(model));

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);

        var simulationId = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_simulation_runs
                (id, company_id, employee_id, run_id, simulation_type, status,
                 original_net, simulated_net, difference, approved)
            VALUES (@Id, @CompanyId, @EmployeeId, @RunId, @SimulationType, 'saved',
                    @OriginalNet, @SimulatedNet,
                    @SimulatedNet - COALESCE(@OriginalNet, 0), false)
            ON CONFLICT (company_id, employee_id, simulation_type) DO UPDATE SET
                run_id = EXCLUDED.run_id, original_net = EXCLUDED.original_net,
                simulated_net = EXCLUDED.simulated_net, difference = EXCLUDED.difference,
                status = 'saved'
            RETURNING id
            """, new
        {
            Id = Guid.NewGuid(), CompanyId = companyId, model.EmployeeId, model.RunId,
            model.SimulationType, model.OriginalNet, model.SimulatedNet
        }, transaction, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_simulation_overrides WHERE simulation_run_id = @simulationId",
            new { simulationId }, transaction, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_simulation_results WHERE simulation_run_id = @simulationId",
            new { simulationId }, transaction, cancellationToken: ct));

        foreach (var item in model.Overrides)
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_simulation_overrides
                    (id, simulation_run_id, field_name, original_value, new_value, change_reason, changed_by)
                VALUES (@Id, @SimulationRunId, @Field, @Original, @New, @Reason, @ChangedBy)
                """, new
            {
                Id = Guid.NewGuid(), SimulationRunId = simulationId, item.Field,
                item.Original, item.New, item.Reason, model.ChangedBy
            }, transaction, cancellationToken: ct));

        foreach (var item in model.Results)
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_simulation_results
                    (id, simulation_run_id, component, amount)
                VALUES (@Id, @SimulationRunId, @Component, @Amount)
                """, new
            {
                Id = Guid.NewGuid(), SimulationRunId = simulationId, item.Component, item.Amount
            }, transaction, cancellationToken: ct));

        await transaction.CommitAsync(ct);
        return simulationId;
    }

    public async Task<IReadOnlyList<PayrollSimulationSummary>> ListAsync(Guid? employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollSimulationSummary>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, simulation_type AS SimulationType,
                   status AS Status, original_net AS OriginalNet, simulated_net AS SimulatedNet,
                   difference AS Difference, created_at AS CreatedAt
            FROM payroll_simulation_runs
            WHERE (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY created_at DESC
            LIMIT 50
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }
}
