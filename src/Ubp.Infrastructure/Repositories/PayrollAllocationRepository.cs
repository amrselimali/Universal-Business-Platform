using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollAllocationRepository
{
    Task<IReadOnlyList<EmployeeBranchAssignment>> ListAssignmentsAsync(Guid employeeId, DateOnly from,
        DateOnly to, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollCostCenterSplit>> ListCostCentersAsync(Guid employeeId, Guid branchId,
        DateOnly asOf, CancellationToken ct = default);
    Task<Guid?> GetRunEmployeeIdAsync(Guid runId, Guid employeeId, int segment = 1,
        CancellationToken ct = default);
    Task ReplaceAllocationsAsync(Guid companyId, Guid runEmployeeId,
        IReadOnlyList<PayrollBranchCostAllocation> branches, IReadOnlyList<PayrollCostCenterSplit> centers,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollBranchCostAllocation>> ListAsync(Guid runId, Guid employeeId,
        CancellationToken ct = default);
}

/// <summary>قراءة إسنادات الفروع ومراكز التكلفة وحفظ توزيع تكلفة المرتب على الفروع ومراكزها.</summary>
public sealed class PayrollAllocationRepository : IPayrollAllocationRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollAllocationRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<EmployeeBranchAssignment>> ListAssignmentsAsync(Guid employeeId,
        DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<EmployeeBranchAssignment>(new CommandDefinition("""
            SELECT a.id AS Id, a.employee_id AS EmployeeId, a.branch_id AS BranchId,
                   b.name_ar AS BranchName, a.effective_from AS EffectiveFrom, a.effective_to AS EffectiveTo
            FROM employee_assignments a
            JOIN branches b ON b.id = a.branch_id
            WHERE a.employee_id = @employeeId AND a.is_active
              AND a.effective_from <= @to AND (a.effective_to IS NULL OR a.effective_to >= @from)
            ORDER BY a.effective_from
            """, new { employeeId, from, to }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollCostCenterSplit>> ListCostCentersAsync(Guid employeeId,
        Guid branchId, DateOnly asOf, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollCostCenterSplit>(new CommandDefinition("""
            SELECT branch_id AS BranchId, cost_center_id AS CostCenterId,
                   allocation_percent / 100.0 AS AllocationRatio, 0 AS AllocatedAmount
            FROM employee_cost_centers
            WHERE employee_id = @employeeId AND branch_id = @branchId
              AND effective_from <= @asOf AND (effective_to IS NULL OR effective_to >= @asOf)
            ORDER BY cost_center_id
            """, new { employeeId, branchId, asOf }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid?> GetRunEmployeeIdAsync(Guid runId, Guid employeeId, int segment = 1,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM payroll_run_employees
            WHERE run_id = @runId AND employee_id = @employeeId AND run_segment = @segment
            """, new { runId, employeeId, segment }, cancellationToken: ct));
    }

    public async Task ReplaceAllocationsAsync(Guid companyId, Guid runEmployeeId,
        IReadOnlyList<PayrollBranchCostAllocation> branches, IReadOnlyList<PayrollCostCenterSplit> centers,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_branch_cost_allocations WHERE run_employee_id = @runEmployeeId",
            new { runEmployeeId }, transaction, cancellationToken: ct));

        var branchIds = new Dictionary<Guid, Guid>();
        foreach (var branch in branches)
        {
            var id = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
                INSERT INTO payroll_branch_cost_allocations
                    (id, company_id, run_employee_id, branch_id, work_days, allocation_basis,
                     allocation_ratio, gross_cost, employer_contribution, total_cost)
                VALUES (@Id, @CompanyId, @RunEmployeeId, @BranchId, @WorkDays, @AllocationBasis,
                        @AllocationRatio, @GrossCost, @EmployerContribution, @TotalCost)
                RETURNING id
                """, new
            {
                Id = Guid.NewGuid(), CompanyId = companyId, RunEmployeeId = runEmployeeId,
                branch.BranchId, branch.WorkDays, branch.AllocationBasis, branch.AllocationRatio,
                branch.GrossCost, branch.EmployerContribution, branch.TotalCost
            }, transaction, cancellationToken: ct));
            branchIds[branch.BranchId] = id;
        }

        foreach (var center in centers)
        {
            if (!branchIds.TryGetValue(center.BranchId, out var branchAllocationId)) continue;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_cost_center_allocations
                    (id, company_id, branch_cost_allocation_id, cost_center_id,
                     allocation_ratio, allocated_amount)
                VALUES (@Id, @CompanyId, @BranchAllocationId, @CostCenterId,
                        @AllocationRatio, @AllocatedAmount)
                """, new
            {
                Id = Guid.NewGuid(), CompanyId = companyId, BranchAllocationId = branchAllocationId,
                center.CostCenterId, center.AllocationRatio, center.AllocatedAmount
            }, transaction, cancellationToken: ct));
        }

        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<PayrollBranchCostAllocation>> ListAsync(Guid runId, Guid employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollBranchCostAllocation>(new CommandDefinition("""
            SELECT e.run_id AS RunId, e.employee_id AS EmployeeId, a.branch_id AS BranchId,
                   a.work_days AS WorkDays, a.allocation_basis AS AllocationBasis,
                   a.allocation_ratio AS AllocationRatio, a.gross_cost AS GrossCost,
                   a.employer_contribution AS EmployerContribution, a.total_cost AS TotalCost
            FROM payroll_branch_cost_allocations a
            JOIN payroll_run_employees e ON e.id = a.run_employee_id
            WHERE e.run_id = @runId AND e.employee_id = @employeeId
            ORDER BY a.branch_id
            """, new { runId, employeeId }, cancellationToken: ct));
        return rows.ToList();
    }
}
