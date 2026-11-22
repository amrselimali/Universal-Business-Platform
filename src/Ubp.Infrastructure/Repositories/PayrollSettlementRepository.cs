using Dapper;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed class PayrollSettlementLineInput
{
    public string LineType { get; init; } = "EARNING";
    public string Description { get; init; } = "";
    public decimal Amount { get; init; }
    public string? CalculationBasis { get; init; }
}

public sealed class PayrollSettlementSave
{
    public Guid EmployeeId { get; init; }
    public DateOnly TerminationDate { get; init; }
    public DateOnly SettlementDate { get; init; }
    public string SettlementType { get; init; } = "END_OF_SERVICE";
    public decimal TotalEntitlements { get; init; }
    public decimal TotalDeductions { get; init; }
    public decimal NetSettlement { get; init; }
    public decimal LeavePayment { get; init; }
    public decimal GratuityAmount { get; init; }
    public decimal TaxAmount { get; init; }
    public decimal InsuranceAmount { get; init; }
    public string? Note { get; init; }
    public Guid? ApprovedBy { get; init; }
    public IReadOnlyList<PayrollSettlementLineInput> Lines { get; init; } =
        Array.Empty<PayrollSettlementLineInput>();
}

public sealed class PayrollSettlementSummary
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public DateOnly TerminationDate { get; set; }
    public decimal NetSettlement { get; set; }
    public string Status { get; set; } = "";
    public string SettlementType { get; set; } = "";
}

/// <summary>حفظ تسوية نهاية الخدمة في payroll_final_settlements + السطور التفصيلية.</summary>
public interface IPayrollSettlementRepository
{
    Task<Guid> SaveAsync(Guid companyId, PayrollSettlementSave model, string status,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollSettlementSummary>> ListAsync(Guid? employeeId,
        CancellationToken ct = default);
}

public sealed class PayrollSettlementRepository : IPayrollSettlementRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollSettlementRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<Guid> SaveAsync(Guid companyId, PayrollSettlementSave model, string status,
        CancellationToken ct = default)
    {
        if (model.EmployeeId == Guid.Empty)
            throw new ArgumentException("Settlement requires an employee.", nameof(model));
        if (model.TerminationDate == default)
            throw new ArgumentException("Settlement requires a termination date.", nameof(model));

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);
        var settlementId = Guid.NewGuid();

        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_final_settlements
                (id, company_id, employee_id, termination_date, settlement_date, status, settlement_type,
                 total_entitlements, total_deductions, net_settlement, gratuity_amount, leave_payment,
                 tax_settlement_amount, insurance_settlement_amount, approved_by, approved_at, approval_note)
            VALUES (@Id, @CompanyId, @EmployeeId, @TerminationDate, @SettlementDate, @Status, @SettlementType,
                    @TotalEntitlements, @TotalDeductions, @NetSettlement, @GratuityAmount, @LeavePayment,
                    @TaxAmount, @InsuranceAmount, @ApprovedBy,
                    CASE WHEN @Status = 'approved' THEN now() ELSE NULL END, @Note)
            """, new
        {
            Id = settlementId, CompanyId = companyId, model.EmployeeId, model.TerminationDate,
            model.SettlementDate, Status = status, model.SettlementType, model.TotalEntitlements,
            model.TotalDeductions, model.NetSettlement, model.GratuityAmount, model.LeavePayment,
            model.TaxAmount, model.InsuranceAmount, model.ApprovedBy, model.Note
        }, transaction, cancellationToken: ct));

        var sequence = 0;
        foreach (var line in model.Lines)
        {
            sequence++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_final_settlement_lines
                    (id, settlement_id, line_type, description, amount, calculation_basis, sequence_no)
                VALUES (@Id, @SettlementId, @LineType, @Description, @Amount, @CalculationBasis, @SequenceNo)
                """, new
            {
                Id = Guid.NewGuid(), SettlementId = settlementId, line.LineType,
                line.Description, line.Amount, line.CalculationBasis, SequenceNo = sequence
            }, transaction, cancellationToken: ct));
        }

        await transaction.CommitAsync(ct);
        return settlementId;
    }

    public async Task<IReadOnlyList<PayrollSettlementSummary>> ListAsync(Guid? employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollSettlementSummary>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, termination_date AS TerminationDate,
                   net_settlement AS NetSettlement, status AS Status, settlement_type AS SettlementType
            FROM payroll_final_settlements
            WHERE (@employeeId IS NULL OR employee_id = @employeeId)
            ORDER BY created_at DESC
            LIMIT 50
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }
}
