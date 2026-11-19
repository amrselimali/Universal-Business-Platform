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
}
