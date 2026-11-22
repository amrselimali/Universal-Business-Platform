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

    /// <summary>قائمة موظفي المرتبات مع بياناتهم الأساسية وحالة الملف (مفلترة بالحالة والبحث).</summary>
    Task<IReadOnlyList<PayrollEmployeeProfileRow>> ListProfilesAsync(string? status, string? search,
        CancellationToken ct = default);
    Task<PayrollEmployeeProfileRow?> GetProfileRowAsync(Guid employeeId, CancellationToken ct = default);
    /// <summary>ينشئ ملف مرتب بحالة مبدئي إن لم يكن موجوداً (تسجيل مبدئي بلا قيود إضافية).</summary>
    Task EnsureProfileAsync(Guid employeeId, CancellationToken ct = default);
    Task<bool> UpdateProfileStatusAsync(Guid employeeId, string status, CancellationToken ct = default);
    /// <summary>توزيعات مراكز التكلفة للموظف (employee_cost_centers).</summary>
    Task<IReadOnlyList<PayrollCostCenterAllocation>> ListCostCenterAllocationsAsync(Guid employeeId,
        CancellationToken ct = default);
    /// <summary>إغلاق التوزيعات السارية وإضافة توزيعات جديدة (تاريخ السريان يُحدَّد صراحةً).</summary>
    Task<int> ReplaceCostCenterAllocationsAsync(Guid employeeId,
        IReadOnlyCollection<PayrollCostCenterAllocation> allocations, CancellationToken ct = default);
    /// <summary>إعدادات صرف الموظف (employee_payment_settings).</summary>
    Task<IReadOnlyList<PayrollPaymentSetting>> ListPaymentSettingsAsync(Guid employeeId,
        CancellationToken ct = default);
    Task<int> ReplacePaymentSettingsAsync(Guid employeeId,
        IReadOnlyCollection<PayrollPaymentSetting> settings, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollEmployeeFieldSetting>> ListFieldSettingsAsync(Guid? companyId,
        CancellationToken ct = default);
    Task<Guid> UpsertFieldSettingAsync(PayrollEmployeeFieldSetting setting, CancellationToken ct = default);
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

    private const string ProfileRowColumns = """
        e.id AS EmployeeId, e.code AS Code, e.name_ar AS NameAr, e.phone AS Phone,
        e.hire_date AS HireDate, e.branch_id AS BranchId, b.name_ar AS BranchName,
        e.is_active AS IsActive,
        COALESCE(p.status, 'draft') AS Status,
        p.national_id AS NationalId, p.passport_number AS PassportNumber,
        p.insurance_number AS InsuranceNumber, p.tax_treatment_code AS TaxTreatmentCode,
        p.insurance_status_code AS InsuranceStatusCode, p.nationality_code AS NationalityCode,
        p.work_permit_status AS WorkPermitStatus, p.service_end_date AS ServiceEndDate,
        p.working_hours_per_month AS WorkingHoursPerMonth,
        p.time_management_enabled AS TimeManagementEnabled,
        p.salary_suspended AS SalarySuspended, p.non_working_wives AS NonWorkingWives,
        p.dependents AS Dependents, COALESCE(p.version, 0) AS Version,
        (p.employee_id IS NOT NULL) AS HasProfile
        """;

    public async Task<IReadOnlyList<PayrollEmployeeProfileRow>> ListProfilesAsync(string? status,
        string? search, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollEmployeeProfileRow>(new CommandDefinition($"""
            SELECT {ProfileRowColumns}
            FROM employees e
            LEFT JOIN payroll_employee_profiles p ON p.employee_id = e.id
            LEFT JOIN branches b ON b.id = e.branch_id
            WHERE e.is_active
              AND (@status IS NULL OR COALESCE(p.status, 'draft') = @status)
              AND (@search IS NULL OR e.code ILIKE @like OR e.name_ar ILIKE @like
                   OR COALESCE(e.phone, '') ILIKE @like)
            ORDER BY e.code
            LIMIT 500
            """, new
        {
            status = string.IsNullOrWhiteSpace(status) ? null : status,
            search = string.IsNullOrWhiteSpace(search) ? null : search,
            like = "%" + (search ?? "").Trim() + "%"
        }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<PayrollEmployeeProfileRow?> GetProfileRowAsync(Guid employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollEmployeeProfileRow>(new CommandDefinition($"""
            SELECT {ProfileRowColumns}
            FROM employees e
            LEFT JOIN payroll_employee_profiles p ON p.employee_id = e.id
            LEFT JOIN branches b ON b.id = e.branch_id
            WHERE e.id = @employeeId
            """, new { employeeId }, cancellationToken: ct));
    }

    public async Task EnsureProfileAsync(Guid employeeId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_employee_profiles (employee_id, status)
            VALUES (@employeeId, 'draft')
            ON CONFLICT (employee_id) DO NOTHING
            """, new { employeeId }, cancellationToken: ct));
    }

    public async Task<bool> UpdateProfileStatusAsync(Guid employeeId, string status,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE payroll_employee_profiles
            SET status = @status, version = version + 1, updated_at = now()
            WHERE employee_id = @employeeId
            """, new { employeeId, status }, cancellationToken: ct)) == 1;
    }

    public async Task<IReadOnlyList<PayrollEmployeeFieldSetting>> ListFieldSettingsAsync(Guid? companyId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollEmployeeFieldSetting>(new CommandDefinition("""
            SELECT id AS Id, company_id AS CompanyId, field_code AS FieldCode,
                   is_visible AS IsVisible, is_required AS IsRequired,
                   effective_from AS EffectiveFrom, effective_to AS EffectiveTo, version AS Version
            FROM company_employee_field_settings
            WHERE company_id IS NOT DISTINCT FROM @companyId
            ORDER BY field_code
            """, new { companyId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> UpsertFieldSettingAsync(PayrollEmployeeFieldSetting setting,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(setting.FieldCode))
            throw new ArgumentException("Field code is required.", nameof(setting));
        if (!setting.IsVisible && setting.IsRequired)
            throw new ArgumentException("A field cannot be hidden and required at the same time.", nameof(setting));
        if (setting.EffectiveTo is not null && setting.EffectiveTo < setting.EffectiveFrom)
            throw new ArgumentException("Field setting effective range is invalid.", nameof(setting));

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            DELETE FROM company_employee_field_settings
            WHERE field_code = @FieldCode AND company_id IS NOT DISTINCT FROM @CompanyId
            """, new { setting.FieldCode, setting.CompanyId }, transaction, cancellationToken: ct));
        var id = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO company_employee_field_settings
                (id, company_id, field_code, is_visible, is_required, effective_from, effective_to, version)
            VALUES (@Id, @CompanyId, @FieldCode, @IsVisible, @IsRequired,
                    @EffectiveFrom, @EffectiveTo, 1)
            RETURNING id
            """, new
        {
            Id = setting.Id == Guid.Empty ? Guid.NewGuid() : setting.Id, setting.CompanyId,
            setting.FieldCode, setting.IsVisible, setting.IsRequired,
            setting.EffectiveFrom, setting.EffectiveTo
        }, transaction, cancellationToken: ct));
        await transaction.CommitAsync(ct);
        return id;
    }

    public async Task<IReadOnlyList<PayrollCostCenterAllocation>> ListCostCenterAllocationsAsync(
        Guid employeeId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollCostCenterAllocation>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, branch_id AS BranchId,
                   cost_center_id AS CostCenterId, allocation_percent AS AllocationPercent,
                   effective_from AS EffectiveFrom, effective_to AS EffectiveTo
            FROM employee_cost_centers
            WHERE employee_id = @employeeId AND (effective_to IS NULL OR effective_to >= current_date)
            ORDER BY branch_id, cost_center_id
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    /// <summary>
    /// إغلاق التوزيعات السارية (أمس) ثم إضافة التوزيعات الجديدة بتاريخ سريانها.
    /// لا يُحذف أي صف تاريخي، فلا تفقد الدورات السابقة توزيعها.
    /// </summary>
    public async Task<int> ReplaceCostCenterAllocationsAsync(Guid employeeId,
        IReadOnlyCollection<PayrollCostCenterAllocation> allocations, CancellationToken ct = default)
    {
        var items = allocations.ToArray();
        if (items.Any(x => x.AllocationPercent is <= 0 or > 100))
            throw new ArgumentOutOfRangeException(nameof(allocations),
                "Cost center allocation percent must be within (0, 100].");

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);

        var effectiveFrom = items.Length > 0
            ? items.Min(x => x.EffectiveFrom)
            : DateOnly.FromDateTime(DateTime.Today);
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE employee_cost_centers
            SET effective_to = @closingDate
            WHERE employee_id = @employeeId
              AND (effective_to IS NULL OR effective_to > @closingDate)
            """, new { employeeId, closingDate = effectiveFrom.AddDays(-1) },
            transaction, cancellationToken: ct));

        foreach (var item in items)
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO employee_cost_centers
                    (id, employee_id, branch_id, cost_center_id, allocation_percent,
                     effective_from, effective_to)
                VALUES (@Id, @EmployeeId, @BranchId, @CostCenterId, @AllocationPercent,
                        @EffectiveFrom, @EffectiveTo)
                """, new
            {
                Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id,
                EmployeeId = employeeId, item.BranchId, item.CostCenterId,
                item.AllocationPercent, item.EffectiveFrom, item.EffectiveTo
            }, transaction, cancellationToken: ct));
        }

        await transaction.CommitAsync(ct);
        return items.Length;
    }

    public async Task<IReadOnlyList<PayrollPaymentSetting>> ListPaymentSettingsAsync(Guid employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollPaymentSetting>(new CommandDefinition("""
            SELECT id AS Id, employee_id AS EmployeeId, payment_method_code AS PaymentMethodCode,
                   amount AS Amount, percentage AS Percentage,
                   account_reference AS AccountReference,
                   effective_from AS EffectiveFrom, effective_to AS EffectiveTo
            FROM employee_payment_settings
            WHERE employee_id = @employeeId AND (effective_to IS NULL OR effective_to >= current_date)
            ORDER BY payment_method_code
            """, new { employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<int> ReplacePaymentSettingsAsync(Guid employeeId,
        IReadOnlyCollection<PayrollPaymentSetting> settings, CancellationToken ct = default)
    {
        var items = settings.ToArray();
        if (items.Any(x => x.Amount is null && x.Percentage is null))
            throw new ArgumentException("Every payment setting needs an amount or a percentage.",
                nameof(settings));

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);

        var effectiveFrom = items.Length > 0
            ? items.Min(x => x.EffectiveFrom)
            : DateOnly.FromDateTime(DateTime.Today);
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE employee_payment_settings
            SET effective_to = @closingDate
            WHERE employee_id = @employeeId
              AND (effective_to IS NULL OR effective_to > @closingDate)
            """, new { employeeId, closingDate = effectiveFrom.AddDays(-1) },
            transaction, cancellationToken: ct));

        foreach (var item in items)
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO employee_payment_settings
                    (id, employee_id, payment_method_code, amount, percentage,
                     account_reference, effective_from, effective_to)
                VALUES (@Id, @EmployeeId, @PaymentMethodCode, @Amount, @Percentage,
                        @AccountReference, @EffectiveFrom, @EffectiveTo)
                """, new
            {
                Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id,
                EmployeeId = employeeId, item.PaymentMethodCode, item.Amount, item.Percentage,
                item.AccountReference, item.EffectiveFrom, item.EffectiveTo
            }, transaction, cancellationToken: ct));
        }

        await transaction.CommitAsync(ct);
        return items.Length;
    }
}
