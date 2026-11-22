using Dapper;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed class PayrollRegisterRow
{
    public Guid EmployeeId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? BranchName { get; set; }
    public string CurrencyCode { get; set; } = "";
    public decimal GrossAmount { get; set; }
    public decimal DeductionsAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string CalculationVersion { get; set; } = "";
}

public sealed class PayrollPayslipRow
{
    public string ItemCode { get; set; } = "";
    public decimal Amount { get; set; }
    public string? FormulaReference { get; set; }
}

public sealed class PayrollVarianceRow
{
    public Guid EmployeeId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public decimal CurrentNet { get; set; }
    public decimal PreviousNet { get; set; }
    public decimal Difference { get; set; }
}

public sealed class PayrollTaxAccumulationRow
{
    public Guid EmployeeId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string ScopeType { get; set; } = "";
    public decimal TaxableIncomeYtd { get; set; }
    public decimal TaxDueYtd { get; set; }
    public decimal TaxWithheldYtd { get; set; }
    public decimal CreditBalance { get; set; }
}

public sealed class PayrollEmployerCostRow
{
    public Guid EmployeeId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public decimal GrossAmount { get; set; }
    public decimal EmployerCost { get; set; }
    public decimal EmployerInsurance { get; set; }
    public decimal EmployerHealth { get; set; }
}

/// <summary>سطر تقرير التأمين لدورة واحدة (بند 13.2): الأوعية والحصص لكل موظف.</summary>
public sealed class PayrollInsuranceReportRow
{
    public Guid EmployeeId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string CurrencyCode { get; set; } = "";
    public decimal InsuranceBasis { get; set; }
    public decimal SocialEmployee { get; set; }
    public decimal SocialEmployer { get; set; }
    public decimal HealthBasis { get; set; }
    public decimal HealthEmployee { get; set; }
    public decimal HealthEmployer { get; set; }

    public decimal TotalEmployee => SocialEmployee + HealthEmployee;
    public decimal TotalEmployer => SocialEmployer + HealthEmployer;
}

/// <summary>استعلامات التقارير على جداول المرتبات القائمة (قراءة فقط، بلا تغيير مخطط).</summary>
public interface IPayrollReportingRepository
{
    Task<IReadOnlyList<PayrollRegisterRow>> RegisterAsync(Guid payrollRunId, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollPayslipRow>> PayslipAsync(Guid payrollRunId, Guid employeeId,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollVarianceRow>> VarianceAsync(Guid payrollRunId, Guid? previousRunId,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollTaxAccumulationRow>> TaxAccumulationAsync(DateOnly from, DateOnly to,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollEmployerCostRow>> EmployerCostAsync(Guid payrollRunId,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollAuditRow>> AuditAsync(DateTime fromUtc, DateTime toUtc, int limit = 200,
        CancellationToken ct = default);
    /// <summary>تقرير التأمين لدورة: وعاء وحصص التأمينات الاجتماعية والصحية لكل موظف (بند 13.2).</summary>
    Task<IReadOnlyList<PayrollInsuranceReportRow>> InsuranceAsync(Guid payrollRunId,
        CancellationToken ct = default);
}

public sealed class PayrollAuditRow
{
    public long Id { get; set; }
    public string TableName { get; set; } = "";
    public string RecordId { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Username { get; set; }
    public string? AuditAction { get; set; }
    public string? NewData { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class PayrollReportingRepository : IPayrollReportingRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollReportingRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IReadOnlyList<PayrollRegisterRow>> RegisterAsync(Guid payrollRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollRegisterRow>(new CommandDefinition("""
            SELECT r.employee_id AS EmployeeId, e.code AS Code, e.name_ar AS NameAr,
                   b.name_ar AS BranchName, r.currency_code AS CurrencyCode,
                   r.gross_amount AS GrossAmount, r.deductions_amount AS DeductionsAmount,
                   r.net_amount AS NetAmount, r.calculation_version AS CalculationVersion
            FROM payroll_results r
            JOIN employees e ON e.id = r.employee_id
            LEFT JOIN branches b ON b.id = e.branch_id
            WHERE r.payroll_run_id = @payrollRunId
            ORDER BY e.code
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollPayslipRow>> PayslipAsync(Guid payrollRunId, Guid employeeId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollPayslipRow>(new CommandDefinition("""
            SELECT d.item_code AS ItemCode, d.amount AS Amount, d.formula_reference AS FormulaReference
            FROM payroll_result_details d
            JOIN payroll_results r ON r.id = d.payroll_result_id
            WHERE r.payroll_run_id = @payrollRunId AND r.employee_id = @employeeId
            ORDER BY d.item_code
            """, new { payrollRunId, employeeId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollVarianceRow>> VarianceAsync(Guid payrollRunId, Guid? previousRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollVarianceRow>(new CommandDefinition("""
            WITH current AS (
                SELECT employee_id, net_amount FROM payroll_results WHERE payroll_run_id = @payrollRunId
            ), previous AS (
                SELECT employee_id, net_amount FROM payroll_results
                WHERE payroll_run_id = COALESCE(@previousRunId, (
                    SELECT id FROM payroll_runs
                    WHERE id <> @payrollRunId
                      AND salary_to < (SELECT salary_to FROM payroll_runs WHERE id = @payrollRunId)
                    ORDER BY salary_to DESC LIMIT 1))
            )
            SELECT COALESCE(c.employee_id, p.employee_id) AS EmployeeId, e.code AS Code, e.name_ar AS NameAr,
                   COALESCE(c.net_amount, 0) AS CurrentNet, COALESCE(p.net_amount, 0) AS PreviousNet,
                   COALESCE(c.net_amount, 0) - COALESCE(p.net_amount, 0) AS Difference
            FROM current c
            FULL OUTER JOIN previous p ON p.employee_id = c.employee_id
            JOIN employees e ON e.id = COALESCE(c.employee_id, p.employee_id)
            ORDER BY e.code
            """, new { payrollRunId, previousRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollTaxAccumulationRow>> TaxAccumulationAsync(DateOnly from, DateOnly to,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollTaxAccumulationRow>(new CommandDefinition("""
            SELECT t.employee_id AS EmployeeId, e.code AS Code, e.name_ar AS NameAr,
                   t.scope_type AS ScopeType, t.taxable_income_ytd AS TaxableIncomeYtd,
                   t.tax_due_ytd AS TaxDueYtd, t.tax_withheld_ytd AS TaxWithheldYtd,
                   t.credit_balance AS CreditBalance
            FROM payroll_tax_balances t
            JOIN employees e ON e.id = t.employee_id
            WHERE EXISTS (
                SELECT 1 FROM payroll_tax_transactions x
                WHERE x.tax_balance_id = t.id AND x.created_at::date BETWEEN @from AND @to)
            ORDER BY e.code
            """, new { from, to }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollAuditRow>> AuditAsync(DateTime fromUtc, DateTime toUtc,
        int limit = 200, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollAuditRow>(new CommandDefinition("""
            SELECT a.id AS Id, a.table_name AS TableName, a.record_id AS RecordId, a.action AS Action,
                   u.username AS Username, a.new_data ->> 'audit_action' AS AuditAction,
                   a.new_data::text AS NewData, a.created_at AS CreatedAt
            FROM audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.table_name LIKE 'payroll%'
              AND a.created_at >= @fromUtc AND a.created_at <= @toUtc
            ORDER BY a.id DESC
            LIMIT @limit
            """, new { fromUtc, toUtc, limit = Math.Clamp(limit, 1, 500) }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollEmployerCostRow>> EmployerCostAsync(Guid payrollRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollEmployerCostRow>(new CommandDefinition("""
            SELECT r.employee_id AS EmployeeId, e.code AS Code, e.name_ar AS NameAr,
                   r.gross_amount AS GrossAmount,
                   COALESCE((SELECT max(d.amount) FROM payroll_result_details d
                             WHERE d.payroll_result_id = r.id AND d.item_code = 'EMPLOYER_COST'),
                            r.gross_amount) AS EmployerCost,
                   COALESCE((SELECT sum(t.amount) FROM payroll_insurance_transactions t
                             WHERE t.run_id = @payrollRunId AND t.employee_id = r.employee_id
                               AND t.side = 'EMPLOYER'), 0) AS EmployerInsurance,
                   COALESCE((SELECT sum(h.amount) FROM payroll_health_insurance_transactions h
                             WHERE h.run_id = @payrollRunId AND h.employee_id = r.employee_id), 0) AS EmployerHealth
            FROM payroll_results r
            JOIN employees e ON e.id = r.employee_id
            WHERE r.payroll_run_id = @payrollRunId
            ORDER BY e.code
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollInsuranceReportRow>> InsuranceAsync(Guid payrollRunId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollInsuranceReportRow>(new CommandDefinition("""
            SELECT r.employee_id AS EmployeeId, e.code AS Code, e.name_ar AS NameAr,
                   r.currency_code AS CurrencyCode,
                   COALESCE(MAX(d.amount) FILTER (WHERE d.item_code = 'INSURABLE_BASE'), 0) AS InsuranceBasis,
                   COALESCE(SUM(d.amount) FILTER (WHERE d.item_code = 'SOCIAL_INSURANCE_EMPLOYEE'), 0)
                       AS SocialEmployee,
                   COALESCE(SUM(d.amount) FILTER (WHERE d.item_code = 'SOCIAL_INSURANCE_EMPLOYER'), 0)
                       AS SocialEmployer,
                   COALESCE(MAX(d.amount) FILTER (WHERE d.item_code = 'HEALTH_INSURANCE_BASE'), 0)
                       AS HealthBasis,
                   COALESCE(SUM(d.amount) FILTER (WHERE d.item_code = 'HEALTH_INSURANCE_EMPLOYEE'), 0)
                       AS HealthEmployee,
                   COALESCE(SUM(d.amount) FILTER (WHERE d.item_code = 'HEALTH_INSURANCE_EMPLOYER'), 0)
                       AS HealthEmployer
            FROM payroll_results r
            JOIN employees e ON e.id = r.employee_id
            LEFT JOIN payroll_result_details d ON d.payroll_result_id = r.id
            WHERE r.payroll_run_id = @payrollRunId
            GROUP BY r.employee_id, e.code, e.name_ar, r.currency_code
            ORDER BY e.code
            """, new { payrollRunId }, cancellationToken: ct));
        return rows.ToList();
    }
}

