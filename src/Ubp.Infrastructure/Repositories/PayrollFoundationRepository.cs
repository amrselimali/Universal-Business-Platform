using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollFoundationRepository
{
    Task<PayrollEmployeeProfile?> GetProfileAsync(Guid employeeId, CancellationToken ct = default);
    Task<PayrollEmployeeProfile?> SaveProfileAsync(Guid employeeId, PayrollEmployeeProfileInput input, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollEmployeeContract>> ListContractsAsync(Guid employeeId, CancellationToken ct = default);
    Task<Guid> AddContractAsync(PayrollEmployeeContract contract, Guid? userId, CancellationToken ct = default);
}

public sealed class PayrollFoundationRepository : IPayrollFoundationRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollFoundationRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<PayrollEmployeeProfile?> GetProfileAsync(Guid employeeId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollEmployeeProfile>(new CommandDefinition("""
            SELECT employee_id AS EmployeeId, status AS Status, national_id AS NationalId,
                passport_number AS PassportNumber, insurance_number AS InsuranceNumber,
                tax_treatment_code AS TaxTreatmentCode, insurance_status_code AS InsuranceStatusCode,
                nationality_code AS NationalityCode, work_permit_status AS WorkPermitStatus,
                service_end_date AS ServiceEndDate, working_hours_per_month AS WorkingHoursPerMonth,
                time_management_enabled AS TimeManagementEnabled, salary_suspended AS SalarySuspended,
                non_working_wives AS NonWorkingWives, dependents AS Dependents, version AS Version
            FROM payroll_employee_profiles WHERE employee_id = @employeeId
            """, new { employeeId }, cancellationToken: ct));
    }

    public async Task<PayrollEmployeeProfile?> SaveProfileAsync(Guid employeeId,
        PayrollEmployeeProfileInput input, CancellationToken ct = default)
    {
        if (input.Status is not (PayrollEmployeeStatuses.Draft or PayrollEmployeeStatuses.Incomplete
            or PayrollEmployeeStatuses.Approved or PayrollEmployeeStatuses.Suspended or PayrollEmployeeStatuses.Terminated))
            throw new ArgumentException("Unsupported payroll employee status.", nameof(input));
        if (input.NonWorkingWives < 0 || input.Dependents < 0)
            throw new ArgumentOutOfRangeException(nameof(input), "Dependent counts cannot be negative.");

        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_employee_profiles
                (employee_id, status, national_id, passport_number, insurance_number,
                 tax_treatment_code, insurance_status_code, nationality_code, work_permit_status,
                 service_end_date, working_hours_per_month, time_management_enabled,
                 salary_suspended, non_working_wives, dependents)
            VALUES (@employeeId, @Status, @NationalId, @PassportNumber, @InsuranceNumber,
                @TaxTreatmentCode, @InsuranceStatusCode, @NationalityCode, @WorkPermitStatus,
                @ServiceEndDate, @WorkingHoursPerMonth, @TimeManagementEnabled,
                @SalarySuspended, @NonWorkingWives, @Dependents)
            ON CONFLICT (employee_id) DO UPDATE SET
                status = EXCLUDED.status, national_id = EXCLUDED.national_id,
                passport_number = EXCLUDED.passport_number, insurance_number = EXCLUDED.insurance_number,
                tax_treatment_code = EXCLUDED.tax_treatment_code,
                insurance_status_code = EXCLUDED.insurance_status_code,
                nationality_code = EXCLUDED.nationality_code,
                work_permit_status = EXCLUDED.work_permit_status,
                service_end_date = EXCLUDED.service_end_date,
                working_hours_per_month = EXCLUDED.working_hours_per_month,
                time_management_enabled = EXCLUDED.time_management_enabled,
                salary_suspended = EXCLUDED.salary_suspended,
                non_working_wives = EXCLUDED.non_working_wives,
                dependents = EXCLUDED.dependents, version = payroll_employee_profiles.version + 1,
                updated_at = now()
            """, new
            {
                employeeId, input.Status, input.NationalId, input.PassportNumber, input.InsuranceNumber,
                input.TaxTreatmentCode, input.InsuranceStatusCode, input.NationalityCode,
                input.WorkPermitStatus, input.ServiceEndDate, input.WorkingHoursPerMonth,
                input.TimeManagementEnabled, input.SalarySuspended, input.NonWorkingWives,
                input.Dependents
            }, cancellationToken: ct));
        return await GetProfileAsync(employeeId, ct);
    }

    public async Task<IReadOnlyList<PayrollEmployeeContract>> ListContractsAsync(Guid employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollEmployeeContract>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, effective_from AS EffectiveFrom,
                effective_to AS EffectiveTo, currency_code AS CurrencyCode,
                gross_salary AS GrossSalary, insurable_salary AS InsurableSalary,
                is_approved AS IsApproved, version AS Version
            FROM employee_contracts WHERE employee_id = @employeeId
            ORDER BY effective_from DESC, id
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> AddContractAsync(PayrollEmployeeContract contract, Guid? userId,
        CancellationToken ct = default)
    {
        if (contract.GrossSalary < 0 || string.IsNullOrWhiteSpace(contract.CurrencyCode))
            throw new ArgumentException("Contract currency and non-negative salary are required.", nameof(contract));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO employee_contracts
                (id, employee_id, effective_from, effective_to, currency_code,
                 gross_salary, insurable_salary, is_approved, created_by)
            VALUES (@Id, @EmployeeId, @EffectiveFrom, @EffectiveTo, @CurrencyCode,
                @GrossSalary, @InsurableSalary, @IsApproved, @userId)
            RETURNING id
            """, new
            {
                contract.Id, contract.EmployeeId, contract.EffectiveFrom, contract.EffectiveTo,
                contract.CurrencyCode, contract.GrossSalary, contract.InsurableSalary,
                contract.IsApproved, userId
            }, cancellationToken: ct));
    }
}
