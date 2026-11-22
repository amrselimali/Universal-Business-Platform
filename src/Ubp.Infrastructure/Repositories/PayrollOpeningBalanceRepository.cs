using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollOpeningBalanceRepository
{
    Task<IReadOnlyList<PayrollOpeningBalance>> ListAsync(Guid? companyId, string? taxYearCode,
        CancellationToken ct = default);
    Task<PayrollOpeningBalance?> GetAsync(Guid employeeId, string taxYearCode, CancellationToken ct = default);
    Task<Guid> UpsertAsync(PayrollOpeningBalance balance, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid employeeId, string taxYearCode, CancellationToken ct = default);
}

/// <summary>
/// الأرصدة الافتتاحية (ضريبة/تأمينات) — تُضاف للأساس التراكمي ولا تُكرَّر:
/// صف واحد لكل (موظف، سنة ضريبية) بفضل القيد الفريد، والحفظ تحديث لا إضافة.
/// </summary>
public sealed class PayrollOpeningBalanceRepository : IPayrollOpeningBalanceRepository
{
    private const string SelectColumns = """
        id AS Id, company_id AS CompanyId, employee_id AS EmployeeId,
        tax_year_code AS TaxYearCode, tax_base AS TaxBase, tax_withheld AS TaxWithheld,
        insurance_base AS InsuranceBase, insurance_employee AS InsuranceEmployee,
        insurance_employer AS InsuranceEmployer, health_base AS HealthBase,
        health_employee AS HealthEmployee, health_employer AS HealthEmployer,
        notes AS Notes, created_by AS CreatedBy, created_at AS CreatedAt, updated_at AS UpdatedAt
        """;

    private readonly IDbConnectionFactory _factory;
    public PayrollOpeningBalanceRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<PayrollOpeningBalance>> ListAsync(Guid? companyId,
        string? taxYearCode, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollOpeningBalance>(new CommandDefinition($"""
            SELECT {SelectColumns}
            FROM payroll_opening_balances
            WHERE (@companyId IS NULL OR company_id = @companyId)
              AND (@taxYearCode IS NULL OR tax_year_code = @taxYearCode)
            ORDER BY tax_year_code DESC, employee_id
            LIMIT 1000
            """, new { companyId, taxYearCode }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<PayrollOpeningBalance?> GetAsync(Guid employeeId, string taxYearCode,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollOpeningBalance>(new CommandDefinition($"""
            SELECT {SelectColumns}
            FROM payroll_opening_balances
            WHERE employee_id = @employeeId AND tax_year_code = @taxYearCode
            """, new { employeeId, taxYearCode }, cancellationToken: ct));
    }

    public async Task<Guid> UpsertAsync(PayrollOpeningBalance balance, CancellationToken ct = default)
    {
        balance.Validate();
        balance.Normalize();

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_opening_balances
                (id, company_id, employee_id, tax_year_code, tax_base, tax_withheld,
                 insurance_base, insurance_employee, insurance_employer,
                 health_base, health_employee, health_employer, notes, created_by)
            VALUES (@Id, @CompanyId, @EmployeeId, @TaxYearCode, @TaxBase, @TaxWithheld,
                    @InsuranceBase, @InsuranceEmployee, @InsuranceEmployer,
                    @HealthBase, @HealthEmployee, @HealthEmployer, @Notes, @CreatedBy)
            ON CONFLICT (employee_id, tax_year_code) DO UPDATE SET
                tax_base = EXCLUDED.tax_base,
                tax_withheld = EXCLUDED.tax_withheld,
                insurance_base = EXCLUDED.insurance_base,
                insurance_employee = EXCLUDED.insurance_employee,
                insurance_employer = EXCLUDED.insurance_employer,
                health_base = EXCLUDED.health_base,
                health_employee = EXCLUDED.health_employee,
                health_employer = EXCLUDED.health_employer,
                notes = EXCLUDED.notes,
                updated_at = now()
            RETURNING id
            """, balance, cancellationToken: ct));
    }

    public async Task<bool> DeleteAsync(Guid employeeId, string taxYearCode, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var deleted = await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM payroll_opening_balances
            WHERE employee_id = @employeeId AND tax_year_code = @taxYearCode
            """, new { employeeId, taxYearCode }, cancellationToken: ct));
        return deleted == 1;
    }
}
