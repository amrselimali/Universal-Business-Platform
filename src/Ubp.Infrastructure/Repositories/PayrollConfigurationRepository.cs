using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public interface IPayrollConfigurationRepository
{
    Task<IReadOnlyList<PayrollItem>> ListItemsAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollItemVersion>> ListItemVersionsAsync(Guid itemId, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollDataSource>> ListDataSourcesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PayrollFormula>> ListFormulasAsync(CancellationToken ct = default);
    Task<Guid> CreateItemAsync(PayrollItem item, CancellationToken ct = default);
    Task<Guid> AddItemVersionAsync(PayrollItemVersion version, CancellationToken ct = default);

    Task<IReadOnlyList<PayrollGroup>> ListGroupsAsync(CancellationToken ct = default);
    Task<Guid> CreateGroupAsync(PayrollGroup group, CancellationToken ct = default);
    Task<Guid> CreateDataSourceAsync(PayrollDataSource source, CancellationToken ct = default);
    Task<Guid> CreateFormulaAsync(PayrollFormula formula, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollSourceAllocation>> ListSourceAllocationsAsync(Guid? snapshotId = null,
        CancellationToken ct = default);
}

public sealed class PayrollConfigurationRepository : IPayrollConfigurationRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollConfigurationRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<PayrollItem>> ListItemsAsync(bool includeInactive = false,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollItem>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, name_ar AS NameAr, name_en AS NameEn,
                category_code AS CategoryCode, is_variable AS IsVariable,
                affects_net_salary AS AffectsNetSalary, is_taxable AS IsTaxable,
                is_insurable AS IsInsurable, employer_borne AS EmployerBorne,
                allow_negative AS AllowNegative, version AS Version
            FROM payroll_items WHERE (@includeInactive OR is_active)
            ORDER BY code
            """, new { includeInactive }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollFormula>> ListFormulasAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollFormula>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, name_ar AS NameAr, expression AS Expression, version AS Version
            FROM payroll_formulas WHERE is_active ORDER BY code
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollItemVersion>> ListItemVersionsAsync(Guid itemId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollItemVersion>(new CommandDefinition("""
            SELECT id AS Id, payroll_item_id AS PayrollItemId, effective_from AS EffectiveFrom,
                effective_to AS EffectiveTo, calculation_type AS CalculationType,
                formula_code AS FormulaCode, minimum_value AS MinimumValue,
                maximum_value AS MaximumValue, rounding_mode AS RoundingMode,
                version AS Version, is_approved AS IsApproved
            FROM payroll_item_versions WHERE payroll_item_id = @itemId
            ORDER BY effective_from DESC
            """, new { itemId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollDataSource>> ListDataSourcesAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollDataSource>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, name_ar AS NameAr, provider_code AS ProviderCode,
                aggregation_code AS AggregationCode, include_cancelled AS IncludeCancelled,
                is_active AS IsActive, version AS Version
            FROM payroll_data_sources WHERE is_active ORDER BY code
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateItemAsync(PayrollItem item, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(item.Code) || string.IsNullOrWhiteSpace(item.NameAr))
            throw new ArgumentException("Payroll item code and Arabic name are required.", nameof(item));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_items
                (id, code, name_ar, name_en, category_code, is_variable, affects_net_salary,
                 is_taxable, is_insurable, employer_borne, allow_negative)
            VALUES (@Id, @Code, @NameAr, @NameEn, @CategoryCode, @IsVariable, @AffectsNetSalary,
                @IsTaxable, @IsInsurable, @EmployerBorne, @AllowNegative)
            RETURNING id
            """, item, cancellationToken: ct));
    }

    public async Task<Guid> AddItemVersionAsync(PayrollItemVersion version, CancellationToken ct = default)
    {
        if (version.EffectiveTo is not null && version.EffectiveTo < version.EffectiveFrom)
            throw new ArgumentException("Payroll item version effective range is invalid.", nameof(version));
        if (version.MinimumValue is not null && version.MaximumValue is not null &&
            version.MaximumValue < version.MinimumValue)
            throw new ArgumentException("Payroll item version limits are invalid.", nameof(version));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_item_versions
                (id, payroll_item_id, effective_from, effective_to, calculation_type, formula_code,
                 minimum_value, maximum_value, rounding_mode, is_approved)
            VALUES (@Id, @PayrollItemId, @EffectiveFrom, @EffectiveTo, @CalculationType, @FormulaCode,
                @MinimumValue, @MaximumValue, @RoundingMode, @IsApproved)
            RETURNING id
            """, version, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollGroup>> ListGroupsAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollGroup>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, name_ar AS NameAr, name_en AS NameEn,
                   is_active AS IsActive, version AS Version
            FROM payroll_groups ORDER BY code
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateGroupAsync(PayrollGroup group, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(group.Code) || string.IsNullOrWhiteSpace(group.NameAr))
            throw new ArgumentException("Payroll group code and Arabic name are required.", nameof(group));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_groups (id, code, name_ar, name_en, is_active)
            VALUES (@Id, @Code, @NameAr, @NameEn, @IsActive)
            ON CONFLICT (code) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
                is_active = EXCLUDED.is_active, version = payroll_groups.version + 1
            RETURNING id
            """, new
        {
            Id = group.Id == Guid.Empty ? Guid.NewGuid() : group.Id, group.Code, group.NameAr,
            group.NameEn, group.IsActive
        }, cancellationToken: ct));
    }

    public async Task<Guid> CreateDataSourceAsync(PayrollDataSource source, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(source.Code) || string.IsNullOrWhiteSpace(source.NameAr))
            throw new ArgumentException("Payroll data source code and Arabic name are required.", nameof(source));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_data_sources (id, code, name_ar, provider_code, aggregation_code, include_cancelled)
            VALUES (@Id, @Code, @NameAr, @ProviderCode, @AggregationCode, @IncludeCancelled)
            RETURNING id
            """, new
        {
            Id = source.Id == Guid.Empty ? Guid.NewGuid() : source.Id, source.Code, source.NameAr,
            source.ProviderCode, source.AggregationCode, source.IncludeCancelled
        }, cancellationToken: ct));
    }

    public async Task<Guid> CreateFormulaAsync(PayrollFormula formula, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(formula.Code) || string.IsNullOrWhiteSpace(formula.Expression))
            throw new ArgumentException("Formula code and expression are required.", nameof(formula));
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_formulas (id, code, name_ar, expression)
            VALUES (@Id, @Code, @NameAr, @Expression)
            ON CONFLICT (code) DO UPDATE SET name_ar = EXCLUDED.name_ar,
                expression = EXCLUDED.expression, version = payroll_formulas.version + 1
            RETURNING id
            """, new
        {
            Id = formula.Id == Guid.Empty ? Guid.NewGuid() : formula.Id,
            formula.Code, formula.NameAr, formula.Expression
        }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollSourceAllocation>> ListSourceAllocationsAsync(Guid? snapshotId = null,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollSourceAllocation>(new CommandDefinition("""
            SELECT id AS Id, source_snapshot_id AS SourceSnapshotId, employee_id AS EmployeeId,
                   allocation_method AS AllocationMethod, source_value AS SourceValue,
                   allocated_value AS AllocatedValue, allocation_percent AS AllocationPercent,
                   rule_version AS RuleVersion, created_at AS CreatedAt
            FROM payroll_source_allocations
            WHERE (@snapshotId IS NULL OR source_snapshot_id = @snapshotId)
            ORDER BY created_at DESC
            LIMIT 500
            """, new { snapshotId }, cancellationToken: ct));
        return rows.ToList();
    }
}
