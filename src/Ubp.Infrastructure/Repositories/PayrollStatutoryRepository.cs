using System.Security.Cryptography;
using System.Text;
using Dapper;
using Ubp.Core.Models;
using Ubp.Infrastructure.Data;

namespace Ubp.Infrastructure.Repositories;

public sealed record PayrollTaxPeriodKey(Guid CompanyId, Guid TaxPeriodId, string TaxYearCode,
    string PeriodCode, DateOnly From, DateOnly To);

/// <summary>
/// قراءة وكتابة إعدادات الضريبة والتأمينات والتأمين الصحي والـ Gross-up على الجداول القائمة
/// فقط (payroll_tax_policies/brackets/exemptions/balances/transactions،
/// payroll_insurance_policies/balances/transactions، payroll_health_insurance_rules،
/// payroll_gross_up_policies) — بدون أي تغيير في المخطط أو الترحيلات.
/// </summary>
public interface IPayrollStatutoryRepository
{
    Task<Guid> GetCompanyIdAsync(CancellationToken ct = default);

    Task<PayrollTaxPolicy?> GetTaxPolicyAsync(DateOnly asOf, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollTaxBracket>> ListTaxBracketsAsync(Guid policyId, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollTaxExemption>> ListTaxExemptionsAsync(DateOnly asOf, CancellationToken ct = default);
    Task<PayrollTaxBalance?> GetTaxBalanceAsync(Guid employeeId, Guid taxPeriodId, string scopeType,
        Guid? branchId, CancellationToken ct = default);
    Task<PayrollTaxBalance> SaveTaxBalanceAsync(PayrollTaxBalance balance, CancellationToken ct = default);
    Task ReplaceTaxTransactionsAsync(Guid runId, Guid employeeId, Guid taxPeriodId, string scopeType,
        Guid? branchId, decimal taxableIncome, decimal taxDue, decimal taxWithheld,
        string? taxYearCode = null, CancellationToken ct = default);
    Task<(decimal Taxable, decimal Due, decimal Withheld)> GetTaxYearToDateAsync(Guid employeeId,
        Guid taxPeriodId, string scopeType, Guid? branchId, CancellationToken ct = default);
    Task DeleteTaxTransactionsAsync(Guid runId, Guid employeeId, CancellationToken ct = default);
    Task<string?> GetBranchCodeAsync(Guid branchId, CancellationToken ct = default);

    Task<PayrollInsurancePolicy?> GetInsurancePolicyAsync(string? branchCode, DateOnly asOf,
        CancellationToken ct = default);
    Task<PayrollHealthInsuranceRule?> GetHealthInsuranceRuleAsync(DateOnly asOf, CancellationToken ct = default);
    Task<PayrollGrossUpPolicy?> GetGrossUpPolicyAsync(CancellationToken ct = default);

    Task<IReadOnlyList<PayrollTaxPolicy>> ListTaxPoliciesAsync(CancellationToken ct = default);
    Task<Guid> CreateTaxPolicyAsync(PayrollTaxPolicy policy, IReadOnlyList<PayrollTaxBracket> brackets,
        CancellationToken ct = default);
    Task<IReadOnlyList<PayrollInsurancePolicy>> ListInsurancePoliciesAsync(CancellationToken ct = default);
    Task<Guid> CreateInsurancePolicyAsync(PayrollInsurancePolicy policy, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollHealthInsuranceRule>> ListHealthInsuranceRulesAsync(
        CancellationToken ct = default);
    Task<Guid> CreateHealthInsuranceRuleAsync(PayrollHealthInsuranceRule rule,
        CancellationToken ct = default);

    /// <summary>إعداد نطاق التراكم الضريبي للسنة (COMPANY/BRANCH) + سياسة نقل الرصيد بين الفروع.</summary>
    Task<PayrollTaxSettings?> GetTaxSettingsAsync(Guid companyId, string taxYearCode, DateOnly asOf,
        CancellationToken ct = default);
    Task<Guid> SaveTaxSettingsAsync(PayrollTaxSettings settings, CancellationToken ct = default);
    Task<IReadOnlyList<PayrollGrossUpItemRule>> ListGrossUpRulesAsync(Guid? companyId, DateOnly asOf,
        CancellationToken ct = default);
    /// <summary>��� ������� �������� ������� �� ��� (���� ��� ����� ������).</summary>
    Task<int> CountTaxTransactionsAsync(string taxYearCode, CancellationToken ct = default);
    Task ReplaceInsuranceBalancesAsync(Guid runId, Guid companyId, Guid employeeId, Guid? branchId,
        string scopeType, PayrollInsurancePolicy? socialPolicy, InsuranceContributions social,
        PayrollHealthInsuranceRule? healthRule, InsuranceContributions health,
        DateOnly cumulativeFrom, CancellationToken ct = default);
}

/// <summary>حصص التأمين (موظف/صاحب عمل/وعاء) لأي محرك تأميني.</summary>
public readonly record struct InsuranceContributions(decimal Basis, decimal Employee, decimal Employer)
{
    public decimal Total => Employee + Employer;
    public static InsuranceContributions None => new(0m, 0m, 0m);
}

public sealed partial class PayrollStatutoryRepository : IPayrollStatutoryRepository
{
    private readonly IDbConnectionFactory _factory;
    public PayrollStatutoryRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<Guid> GetCompanyIdAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var id = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT id FROM app_settings LIMIT 1", cancellationToken: ct));
        return id ?? throw new InvalidOperationException("PAYROLL_COMPANY_NOT_CONFIGURED");
    }

    /// <summary>
    /// الفترة الضريبية ليست كياناً مستقلاً في هذا المخطط؛ لذلك يُشتق مُعرّف ثابت (Deterministic)
    /// من السنة والشهر حتى تبقى الأرصدة قابلة للتجميع دون جدول فترات ضريبية.
    /// </summary>
    public static Guid TaxPeriodId(DateOnly date)
    {
        var key = $"PAYROLL-TAX-{date.Year:D4}-{date.Month:D2}";
        var hash = MD5.HashData(Encoding.UTF8.GetBytes(key));
        return new Guid(hash);
    }

    public static PayrollTaxPeriodKey PeriodKey(Guid companyId, DateOnly date)
    {
        var from = new DateOnly(date.Year, date.Month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        return new PayrollTaxPeriodKey(companyId, TaxPeriodId(date), $"{date.Year:D4}",
            $"{date.Year:D4}-{date.Month:D2}", from, to);
    }

    public async Task<PayrollTaxPolicy?> GetTaxPolicyAsync(DateOnly asOf, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var policy = await connection.QuerySingleOrDefaultAsync<PayrollTaxPolicy>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, effective_from AS EffectiveFrom, effective_to AS EffectiveTo,
                   cumulative AS Cumulative, is_approved AS IsApproved, version AS Version
            FROM payroll_tax_policies
            WHERE effective_from <= @asOf AND (effective_to IS NULL OR effective_to >= @asOf)
            ORDER BY is_approved DESC, effective_from DESC
            LIMIT 1
            """, new { asOf }, cancellationToken: ct));
        if (policy is null) return null;
        policy.Brackets = await ListTaxBracketsAsync(policy.Id, ct);
        return policy.Brackets.Count > 0 ? policy : null;
    }

    public async Task<IReadOnlyList<PayrollTaxBracket>> ListTaxBracketsAsync(Guid policyId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollTaxBracket>(new CommandDefinition("""
            SELECT id AS Id, policy_id AS PolicyId, upper_limit AS UpperLimit,
                   rate AS Rate, bracket_order AS BracketOrder
            FROM payroll_tax_brackets WHERE policy_id = @policyId
            ORDER BY bracket_order, upper_limit
            """, new { policyId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PayrollTaxExemption>> ListTaxExemptionsAsync(DateOnly asOf,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollTaxExemption>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, name_ar AS NameAr, name_en AS NameEn,
                   exemption_type AS ExemptionType, amount AS Amount, percentage AS Percentage,
                   condition_expression AS ConditionExpression, effective_from AS EffectiveFrom,
                   effective_to AS EffectiveTo, is_active AS IsActive
            FROM payroll_tax_exemptions
            WHERE is_active AND effective_from <= @asOf
              AND (effective_to IS NULL OR effective_to >= @asOf)
            ORDER BY code
            """, new { asOf }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<PayrollTaxBalance?> GetTaxBalanceAsync(Guid employeeId, Guid taxPeriodId,
        string scopeType, Guid? branchId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollTaxBalance>(new CommandDefinition("""
            SELECT id AS Id, company_id AS CompanyId, tax_period_id AS TaxPeriodId,
                   employee_id AS EmployeeId, scope_type AS ScopeType, branch_id AS BranchId,
                   taxable_income_ytd AS TaxableIncomeYtd, tax_due_ytd AS TaxDueYtd,
                   tax_withheld_ytd AS TaxWithheldYtd, credit_balance AS CreditBalance,
                   last_run_id AS LastRunId, row_version AS RowVersion
            FROM payroll_tax_balances
            WHERE employee_id = @employeeId AND tax_period_id = @taxPeriodId
              AND scope_type = @scopeType AND branch_id IS NOT DISTINCT FROM @branchId
            LIMIT 1
            """, new { employeeId, taxPeriodId, scopeType, branchId }, cancellationToken: ct));
    }

    public async Task<PayrollTaxBalance> SaveTaxBalanceAsync(PayrollTaxBalance balance,
        CancellationToken ct = default)
    {
        if (!PayrollTaxScopes.IsValid(balance.ScopeType))
            throw new ArgumentException("Invalid payroll tax scope.", nameof(balance));
        if (string.Equals(balance.ScopeType, PayrollTaxScopes.Company, StringComparison.OrdinalIgnoreCase)
            && balance.BranchId is not null)
            throw new ArgumentException("Company tax scope cannot carry a branch id.", nameof(balance));

        await using var connection = await _factory.OpenAsync(ct);
        var existing = await GetTaxBalanceAsync(balance.EmployeeId, balance.TaxPeriodId,
            balance.ScopeType, balance.BranchId, ct);
        if (existing is null)
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_tax_balances
                    (id, company_id, tax_period_id, employee_id, scope_type, branch_id,
                     taxable_income_ytd, tax_due_ytd, tax_withheld_ytd, credit_balance,
                     last_run_id, row_version)
                VALUES (@Id, @CompanyId, @TaxPeriodId, @EmployeeId, @ScopeType, @BranchId,
                        @TaxableIncomeYtd, @TaxDueYtd, @TaxWithheldYtd, @CreditBalance,
                        @LastRunId, 1)
                """, new
            {
                Id = balance.Id == Guid.Empty ? Guid.NewGuid() : balance.Id,
                balance.CompanyId, balance.TaxPeriodId, balance.EmployeeId, balance.ScopeType,
                balance.BranchId, balance.TaxableIncomeYtd, balance.TaxDueYtd,
                balance.TaxWithheldYtd, balance.CreditBalance, balance.LastRunId
            }, cancellationToken: ct));
        }
        else
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE payroll_tax_balances SET
                    taxable_income_ytd = @TaxableIncomeYtd, tax_due_ytd = @TaxDueYtd,
                    tax_withheld_ytd = @TaxWithheldYtd, credit_balance = @CreditBalance,
                    last_run_id = @LastRunId, row_version = row_version + 1
                WHERE id = @Id
                """, new
            {
                Id = existing.Id, balance.TaxableIncomeYtd, balance.TaxDueYtd,
                balance.TaxWithheldYtd, balance.CreditBalance, balance.LastRunId
            }, cancellationToken: ct));
        }
        return balance;
    }

    /// <summary>
    /// يسجّل حركات الضريبة للدورة بشكل Idempotent: تُحذف حركات نفس (الدورة/الموظف) أولاً
    /// ثم تُدرج القيمة الحالية حتى لا تتضاعف الأرصدة عند إعادة الحساب.
    /// </summary>
    public async Task ReplaceTaxTransactionsAsync(Guid runId, Guid employeeId, Guid taxPeriodId,
        string scopeType, Guid? branchId, decimal taxableIncome, decimal taxDue, decimal taxWithheld,
        string? taxYearCode = null, CancellationToken ct = default)
    {
        var balance = await GetTaxBalanceAsync(employeeId, taxPeriodId, scopeType, branchId, ct);
        if (balance is null) return;

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_tax_transactions WHERE run_id = @runId AND employee_id = @employeeId",
            new { runId, employeeId }, transaction, cancellationToken: ct));

        if (taxableIncome != 0)
            await InsertTaxTransactionAsync(connection, transaction, balance, runId, employeeId, branchId,
                "TAXABLE", taxableIncome, taxYearCode, ct);
        if (taxDue != 0)
            await InsertTaxTransactionAsync(connection, transaction, balance, runId, employeeId, branchId,
                "DUE", taxDue, taxYearCode, ct);
        if (taxWithheld != 0)
            await InsertTaxTransactionAsync(connection, transaction, balance, runId, employeeId, branchId,
                "WITHHELD", taxWithheld, taxYearCode, ct);
        await transaction.CommitAsync(ct);
    }

    /// <summary>مجموع حركات السنة الضريبية للموظف (قبل أي حركة جديدة) — أساس الحساب التراكمي.</summary>
    public async Task<(decimal Taxable, decimal Due, decimal Withheld)> GetTaxYearToDateAsync(Guid employeeId,
        Guid taxPeriodId, string scopeType, Guid? branchId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var row = await connection.QuerySingleAsync<TaxYtdRow>(new CommandDefinition("""
            SELECT
                COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'TAXABLE'), 0) AS Taxable,
                COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'DUE'), 0) AS Due,
                COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'WITHHELD'), 0) AS Withheld
            FROM payroll_tax_transactions t
            JOIN payroll_tax_balances b ON b.id = t.tax_balance_id
            WHERE t.employee_id = @employeeId AND b.tax_period_id = @taxPeriodId
              AND b.scope_type = @scopeType AND b.branch_id IS NOT DISTINCT FROM @branchId
            """, new { employeeId, taxPeriodId, scopeType, branchId }, cancellationToken: ct));
        return (row.Taxable, row.Due, row.Withheld);
    }

    private sealed class TaxYtdRow
    {
        public decimal Taxable { get; set; }
        public decimal Due { get; set; }
        public decimal Withheld { get; set; }
    }

    public async Task DeleteTaxTransactionsAsync(Guid runId, Guid employeeId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_tax_transactions WHERE run_id = @runId AND employee_id = @employeeId",
            new { runId, employeeId }, cancellationToken: ct));
    }

    public async Task<string?> GetBranchCodeAsync(Guid branchId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT code FROM branches WHERE id = @branchId", new { branchId }, cancellationToken: ct));
    }

    private static Task InsertTaxTransactionAsync(System.Data.Common.DbConnection connection,
        System.Data.Common.DbTransaction transaction, PayrollTaxBalance balance, Guid runId,
        Guid employeeId, Guid? branchId, string type, decimal amount, string? taxYearCode, CancellationToken ct) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_tax_transactions
                (id, company_id, tax_balance_id, run_id, employee_id, branch_id,
                 transaction_type, amount, source_reference, tax_year_code)
            VALUES (@Id, @CompanyId, @TaxBalanceId, @RunId, @EmployeeId, @BranchId,
                    @TransactionType, @Amount, @RunId, @TaxYearCode)
            """, new
        {
            Id = Guid.NewGuid(), CompanyId = balance.CompanyId, TaxBalanceId = balance.Id,
            RunId = runId, EmployeeId = employeeId, BranchId = branchId,
            TransactionType = type, Amount = amount, TaxYearCode = taxYearCode
        }, transaction, cancellationToken: ct));

    /// <summary>
    /// اختيار سياسة التأمينات: لا يوجد عمود فرع في جدول السياسات، لذلك يُدعم اصطلاح الكود
    /// (كود الفرع أو INS-{code} أو {code}-INS أو SOC-{code}) ثم سياسة عامة ثم أول سياسة سارية معتمدة.
    /// </summary>
    public async Task<PayrollInsurancePolicy?> GetInsurancePolicyAsync(string? branchCode, DateOnly asOf,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = (await connection.QueryAsync<PayrollInsurancePolicy>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, effective_from AS EffectiveFrom, effective_to AS EffectiveTo,
                   minimum_basis AS MinimumBasis, maximum_basis AS MaximumBasis,
                   employee_rate AS EmployeeRate, employer_rate AS EmployerRate,
                   is_approved AS IsApproved, version AS Version
            FROM payroll_insurance_policies
            WHERE effective_from <= @asOf AND (effective_to IS NULL OR effective_to >= @asOf)
            ORDER BY is_approved DESC, effective_from DESC
            """, new { asOf }, cancellationToken: ct))).ToList();
        if (rows.Count == 0) return null;
        return PayrollInsurancePolicyMatcher.SelectByBranch(rows, branchCode);
    }

    public async Task<PayrollHealthInsuranceRule?> GetHealthInsuranceRuleAsync(DateOnly asOf,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollHealthInsuranceRule>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, effective_from AS EffectiveFrom, effective_to AS EffectiveTo,
                   basis_expression AS BasisExpression, employee_rate AS EmployeeRate,
                   employer_rate AS EmployerRate, is_approved AS IsApproved
            FROM payroll_health_insurance_rules
            WHERE effective_from <= @asOf AND (effective_to IS NULL OR effective_to >= @asOf)
            ORDER BY is_approved DESC, effective_from DESC
            LIMIT 1
            """, new { asOf }, cancellationToken: ct));
    }

    public async Task<PayrollGrossUpPolicy?> GetGrossUpPolicyAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollGrossUpPolicy>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, solver_code AS SolverCode, tolerance AS Tolerance,
                   max_iterations AS MaxIterations, is_approved AS IsApproved
            FROM payroll_gross_up_policies
            ORDER BY is_approved DESC, code
            LIMIT 1
            """, cancellationToken: ct));
    }

    /// <summary>
    /// حفظ حصص التأمين الاجتماعي والصحي للدورة: رصيد واحد لكل (موظف/سياسة/نطاق/فرع)
    /// يُحدَّث بالقيمة الحالية، وحركات لكل دورة تُحذف وتُعاد (Idempotent).
    /// </summary>
    public async Task ReplaceInsuranceBalancesAsync(Guid runId, Guid companyId, Guid employeeId,
        Guid? branchId, string scopeType, PayrollInsurancePolicy? socialPolicy, InsuranceContributions social,
        PayrollHealthInsuranceRule? healthRule, InsuranceContributions health, DateOnly cumulativeFrom,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);

        if (socialPolicy is not null && social.Total != 0)
        {
            var balanceId = await UpsertInsuranceBalanceAsync(connection, transaction, companyId, employeeId,
                socialPolicy.Id, scopeType, branchId, social, cumulativeFrom, ct);
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM payroll_insurance_transactions WHERE run_id = @runId AND employee_id = @employeeId",
                new { runId, employeeId }, transaction, cancellationToken: ct));
            await InsertInsuranceTransactionAsync(connection, transaction, balanceId, runId, employeeId,
                "EMPLOYEE", social.Employee, ct);
            await InsertInsuranceTransactionAsync(connection, transaction, balanceId, runId, employeeId,
                "EMPLOYER", social.Employer, ct);
        }

        if (healthRule is not null && health.Total != 0)
        {
            var balanceId = await UpsertHealthBalanceAsync(connection, transaction, companyId, employeeId,
                healthRule.Id, health, ct);
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM payroll_health_insurance_transactions WHERE run_id = @runId AND employee_id = @employeeId",
                new { runId, employeeId }, transaction, cancellationToken: ct));
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_health_insurance_transactions
                    (id, balance_id, run_id, employee_id, transaction_type, amount)
                VALUES (@Id, @BalanceId, @RunId, @EmployeeId, 'CONTRIBUTION', @Amount)
                """, new
            {
                Id = Guid.NewGuid(), BalanceId = balanceId, RunId = runId,
                EmployeeId = employeeId, Amount = health.Total
            }, transaction, cancellationToken: ct));
        }

        await transaction.CommitAsync(ct);
    }

    private static async Task<Guid> UpsertInsuranceBalanceAsync(System.Data.Common.DbConnection connection,
        System.Data.Common.DbTransaction transaction, Guid companyId, Guid employeeId, Guid policyId,
        string scopeType, Guid? branchId, InsuranceContributions contributions, DateOnly cumulativeFrom,
        CancellationToken ct)
    {
        var existing = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM payroll_insurance_balances
            WHERE employee_id = @employeeId AND policy_id = @policyId
              AND scope_type = @scopeType AND branch_id IS NOT DISTINCT FROM @branchId
            LIMIT 1
            """, new { employeeId, policyId, scopeType, branchId }, transaction, cancellationToken: ct));

        if (existing is not null)
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE payroll_insurance_balances SET
                    basis = @Basis, employee_contribution = @Employee,
                    employer_contribution = @Employer, total_contribution = @Total,
                    version = version + 1
                WHERE id = @Id
                """, new
            {
                Id = existing.Value, Basis = contributions.Basis, Employee = contributions.Employee,
                Employer = contributions.Employer, Total = contributions.Total
            }, transaction, cancellationToken: ct));
            return existing.Value;
        }

        var id = Guid.NewGuid();
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_insurance_balances
                (id, company_id, employee_id, policy_id, scope_type, branch_id, basis,
                 employee_contribution, employer_contribution, total_contribution, cumulative_from)
            VALUES (@Id, @CompanyId, @EmployeeId, @PolicyId, @ScopeType, @BranchId, @Basis,
                    @Employee, @Employer, @Total, @CumulativeFrom)
            """, new
        {
            Id = id, CompanyId = companyId, EmployeeId = employeeId, PolicyId = policyId,
            ScopeType = scopeType, BranchId = branchId, Basis = contributions.Basis,
            Employee = contributions.Employee, Employer = contributions.Employer,
            Total = contributions.Total, CumulativeFrom = cumulativeFrom
        }, transaction, cancellationToken: ct));
        return id;
    }

    private static async Task<Guid> UpsertHealthBalanceAsync(System.Data.Common.DbConnection connection,
        System.Data.Common.DbTransaction transaction, Guid companyId, Guid employeeId, Guid ruleId,
        InsuranceContributions contributions, CancellationToken ct)
    {
        var existing = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM payroll_health_insurance_balances
            WHERE employee_id = @employeeId AND rule_id = @ruleId
            LIMIT 1
            """, new { employeeId, ruleId }, transaction, cancellationToken: ct));

        if (existing is not null)
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE payroll_health_insurance_balances SET
                    basis = @Basis, employee_contribution = @Employee,
                    employer_contribution = @Employer, total_contribution = @Total,
                    version = version + 1
                WHERE id = @Id
                """, new
            {
                Id = existing.Value, Basis = contributions.Basis, Employee = contributions.Employee,
                Employer = contributions.Employer, Total = contributions.Total
            }, transaction, cancellationToken: ct));
            return existing.Value;
        }

        var id = Guid.NewGuid();
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_health_insurance_balances
                (id, company_id, employee_id, rule_id, basis,
                 employee_contribution, employer_contribution, total_contribution)
            VALUES (@Id, @CompanyId, @EmployeeId, @RuleId, @Basis,
                    @Employee, @Employer, @Total)
            """, new
        {
            Id = id, CompanyId = companyId, EmployeeId = employeeId, RuleId = ruleId,
            Basis = contributions.Basis, Employee = contributions.Employee,
            Employer = contributions.Employer, Total = contributions.Total
        }, transaction, cancellationToken: ct));
        return id;
    }

    private static Task InsertInsuranceTransactionAsync(System.Data.Common.DbConnection connection,
        System.Data.Common.DbTransaction transaction, Guid balanceId, Guid runId, Guid employeeId,
        string side, decimal amount, CancellationToken ct) =>
        connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_insurance_transactions
                (id, company_id, balance_id, run_id, employee_id, transaction_type, amount, side)
            SELECT @Id, b.company_id, b.id, @RunId, @EmployeeId, 'CONTRIBUTION', @Amount, @Side
            FROM payroll_insurance_balances b WHERE b.id = @BalanceId
            """, new
        {
            Id = Guid.NewGuid(), BalanceId = balanceId, RunId = runId, EmployeeId = employeeId,
            Side = side, Amount = amount
        }, transaction, cancellationToken: ct));

    public async Task<IReadOnlyList<PayrollTaxPolicy>> ListTaxPoliciesAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var policies = (await connection.QueryAsync<PayrollTaxPolicy>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, effective_from AS EffectiveFrom, effective_to AS EffectiveTo,
                   cumulative AS Cumulative, is_approved AS IsApproved, version AS Version
            FROM payroll_tax_policies ORDER BY effective_from DESC, code
            """, cancellationToken: ct))).ToList();
        foreach (var policy in policies) policy.Brackets = await ListTaxBracketsAsync(policy.Id, ct);
        return policies;
    }

    public async Task<Guid> CreateTaxPolicyAsync(PayrollTaxPolicy policy,
        IReadOnlyList<PayrollTaxBracket> brackets, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(policy.Code))
            throw new ArgumentException("Tax policy code is required.", nameof(policy));
        if (brackets.Count == 0)
            throw new ArgumentException("At least one tax bracket is required.", nameof(brackets));

        await using var connection = await _factory.OpenAsync(ct);
        using var transaction = await connection.BeginTransactionAsync(ct);
        var policyId = policy.Id == Guid.Empty ? Guid.NewGuid() : policy.Id;
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO payroll_tax_policies
                (id, code, effective_from, effective_to, cumulative, is_approved, version)
            VALUES (@Id, @Code, @EffectiveFrom, @EffectiveTo, @Cumulative, @IsApproved, 1)
            ON CONFLICT (code, effective_from) DO UPDATE SET
                effective_to = EXCLUDED.effective_to, cumulative = EXCLUDED.cumulative,
                is_approved = EXCLUDED.is_approved, version = payroll_tax_policies.version + 1
            """, new
        {
            Id = policyId, policy.Code, policy.EffectiveFrom, policy.EffectiveTo,
            policy.Cumulative, policy.IsApproved
        }, transaction, cancellationToken: ct));

        var storedId = await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(
            "SELECT id FROM payroll_tax_policies WHERE code = @code AND effective_from = @from",
            new { code = policy.Code, from = policy.EffectiveFrom }, transaction, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition(
            "DELETE FROM payroll_tax_brackets WHERE policy_id = @policyId",
            new { policyId = storedId }, transaction, cancellationToken: ct));
        var order = 0;
        foreach (var bracket in brackets.OrderBy(x => x.UpperLimit))
        {
            order++;
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO payroll_tax_brackets (id, policy_id, upper_limit, rate, bracket_order)
                VALUES (@Id, @PolicyId, @UpperLimit, @Rate, @BracketOrder)
                """, new
            {
                Id = Guid.NewGuid(), PolicyId = storedId, bracket.UpperLimit, bracket.Rate,
                BracketOrder = bracket.BracketOrder > 0 ? bracket.BracketOrder : order
            }, transaction, cancellationToken: ct));
        }
        await transaction.CommitAsync(ct);
        return storedId;
    }

    public async Task<IReadOnlyList<PayrollInsurancePolicy>> ListInsurancePoliciesAsync(
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollInsurancePolicy>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, effective_from AS EffectiveFrom, effective_to AS EffectiveTo,
                   minimum_basis AS MinimumBasis, maximum_basis AS MaximumBasis,
                   employee_rate AS EmployeeRate, employer_rate AS EmployerRate,
                   is_approved AS IsApproved, version AS Version
            FROM payroll_insurance_policies ORDER BY effective_from DESC, code
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateInsurancePolicyAsync(PayrollInsurancePolicy policy,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(policy.Code))
            throw new ArgumentException("Insurance policy code is required.", nameof(policy));
        if (policy.EmployeeRate is < 0 or > 1 || policy.EmployerRate is < 0 or > 1)
            throw new ArgumentException("Insurance rates must be between 0 and 1.", nameof(policy));
        if (policy.MinimumBasis is { } min && policy.MaximumBasis is { } max && max < min)
            throw new ArgumentException("Insurance maximum basis must be >= minimum basis.", nameof(policy));

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_insurance_policies
                (id, code, effective_from, effective_to, minimum_basis, maximum_basis,
                 employee_rate, employer_rate, is_approved)
            VALUES (@Id, @Code, @EffectiveFrom, @EffectiveTo, @MinimumBasis, @MaximumBasis,
                    @EmployeeRate, @EmployerRate, @IsApproved)
            ON CONFLICT (code) DO UPDATE SET
                effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to,
                minimum_basis = EXCLUDED.minimum_basis, maximum_basis = EXCLUDED.maximum_basis,
                employee_rate = EXCLUDED.employee_rate, employer_rate = EXCLUDED.employer_rate,
                is_approved = EXCLUDED.is_approved, version = payroll_insurance_policies.version + 1
            RETURNING id
            """, new
        {
            Id = policy.Id == Guid.Empty ? Guid.NewGuid() : policy.Id, policy.Code,
            policy.EffectiveFrom, policy.EffectiveTo, policy.MinimumBasis, policy.MaximumBasis,
            policy.EmployeeRate, policy.EmployerRate, policy.IsApproved
        }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollHealthInsuranceRule>> ListHealthInsuranceRulesAsync(
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollHealthInsuranceRule>(new CommandDefinition("""
            SELECT id AS Id, code AS Code, effective_from AS EffectiveFrom, effective_to AS EffectiveTo,
                   basis_expression AS BasisExpression, employee_rate AS EmployeeRate,
                   employer_rate AS EmployerRate, is_approved AS IsApproved
            FROM payroll_health_insurance_rules ORDER BY effective_from DESC, code
            """, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Guid> CreateHealthInsuranceRuleAsync(PayrollHealthInsuranceRule rule,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rule.Code) || string.IsNullOrWhiteSpace(rule.BasisExpression))
            throw new ArgumentException("Health rule code and basis expression are required.", nameof(rule));
        if (rule.EmployeeRate is < 0 or > 1 || rule.EmployerRate is < 0 or > 1)
            throw new ArgumentException("Health rates must be between 0 and 1.", nameof(rule));

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_health_insurance_rules
                (id, code, effective_from, effective_to, basis_expression,
                 employee_rate, employer_rate, is_approved)
            VALUES (@Id, @Code, @EffectiveFrom, @EffectiveTo, @BasisExpression,
                    @EmployeeRate, @EmployerRate, @IsApproved)
            ON CONFLICT (code) DO UPDATE SET
                effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to,
                basis_expression = EXCLUDED.basis_expression, employee_rate = EXCLUDED.employee_rate,
                employer_rate = EXCLUDED.employer_rate, is_approved = EXCLUDED.is_approved,
                version = payroll_health_insurance_rules.version + 1
            RETURNING id
            """, new
        {
            Id = rule.Id == Guid.Empty ? Guid.NewGuid() : rule.Id, rule.Code,
            rule.EffectiveFrom, rule.EffectiveTo, rule.BasisExpression,
            rule.EmployeeRate, rule.EmployerRate, rule.IsApproved
        }, cancellationToken: ct));
    }

    public async Task<PayrollTaxSettings?> GetTaxSettingsAsync(Guid companyId, string taxYearCode,
        DateOnly asOf, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.QuerySingleOrDefaultAsync<PayrollTaxSettings>(new CommandDefinition("""
            SELECT id AS Id, company_id AS CompanyId, tax_year_code AS TaxYearCode,
                   scope_type AS ScopeType, branch_carry_policy AS BranchCarryPolicy,
                   effective_from AS EffectiveFrom, effective_to AS EffectiveTo, status AS Status,
                   approved_by AS ApprovedBy, approved_at AS ApprovedAt, version AS Version
            FROM payroll_tax_settings
            WHERE company_id = @companyId AND tax_year_code = @taxYearCode
              AND effective_from <= @asOf AND (effective_to IS NULL OR effective_to >= @asOf)
            ORDER BY (status = 'approved') DESC, effective_from DESC
            LIMIT 1
            """, new { companyId, taxYearCode, asOf }, cancellationToken: ct));
    }

    /// <summary>
    /// حفظ إعداد نطاق الضريبة. يُمنع تغيير النطاق بعد أول حركة ضريبية معتمدة في السنة
    /// إلا بإجراء موثق (بند ب.3) — الحماية هنا على مستوى الخدمة، والقاعدة تحفظ التاريخ.
    /// </summary>
    public async Task<Guid> SaveTaxSettingsAsync(PayrollTaxSettings settings, CancellationToken ct = default)
    {
        if (!PayrollTaxScopes.IsValid(settings.ScopeType))
            throw new ArgumentException("Invalid tax accumulation scope.", nameof(settings));
        if (string.IsNullOrWhiteSpace(settings.TaxYearCode))
            throw new ArgumentException("Tax year code is required.", nameof(settings));

        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition("""
            INSERT INTO payroll_tax_settings
                (id, company_id, tax_year_code, scope_type, branch_carry_policy,
                 effective_from, effective_to, status, approved_by, approved_at, version)
            VALUES (@Id, @CompanyId, @TaxYearCode, @ScopeType, @BranchCarryPolicy,
                    @EffectiveFrom, @EffectiveTo, @Status, @ApprovedBy, @ApprovedAt, 1)
            ON CONFLICT (company_id, tax_year_code, effective_from) DO UPDATE SET
                scope_type = EXCLUDED.scope_type,
                branch_carry_policy = EXCLUDED.branch_carry_policy,
                effective_to = EXCLUDED.effective_to, status = EXCLUDED.status,
                approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at,
                version = payroll_tax_settings.version + 1
            RETURNING id
            """, new
        {
            Id = settings.Id == Guid.Empty ? Guid.NewGuid() : settings.Id, settings.CompanyId,
            settings.TaxYearCode, settings.ScopeType, settings.BranchCarryPolicy,
            settings.EffectiveFrom, settings.EffectiveTo, settings.Status,
            settings.ApprovedBy, settings.ApprovedAt
        }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<PayrollGrossUpItemRule>> ListGrossUpRulesAsync(Guid? companyId,
        DateOnly asOf, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<PayrollGrossUpItemRule>(new CommandDefinition("""
            SELECT id AS Id, company_id AS CompanyId, payroll_item_id AS PayrollItemId,
                   shoulder_type AS ShoulderType, shoulder_value AS ShoulderValue,
                   max_amount AS MaxAmount, is_active AS IsActive,
                   effective_from AS EffectiveFrom, effective_to AS EffectiveTo, version AS Version
            FROM payroll_gross_up_shoulders
            WHERE is_active AND effective_from <= @asOf
              AND (effective_to IS NULL OR effective_to >= @asOf)
              AND (company_id IS NULL OR company_id = @companyId)
            ORDER BY payroll_item_id, effective_from DESC
            """, new { companyId, asOf }, cancellationToken: ct));
        return rows.ToList();
    }

    /// <summary>عدد الحركات الضريبية في السنة — يُستخدم لقفل تغيير نطاق التراكم بعد أول اعتماد.</summary>
    public async Task<int> CountTaxTransactionsAsync(string taxYearCode, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*) FROM payroll_tax_transactions
            WHERE tax_year_code = @taxYearCode
            """, new { taxYearCode }, cancellationToken: ct));
    }
}
