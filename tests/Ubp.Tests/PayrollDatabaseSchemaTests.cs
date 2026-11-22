using Dapper;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// تحقق فعلي من مخطط المرتبات على قاعدة بيانات حقيقية بعد سلسلة الترحيل كاملة.
/// يحمي من أخطاء مثل 0207 (عمود مفقود بسبب CREATE TABLE IF NOT EXISTS على جدول قديم).
/// </summary>
public sealed class PayrollDatabaseSchemaTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;
    public PayrollDatabaseSchemaTests(TestDb db) => _db = db;

    private async Task<HashSet<string>> ColumnsAsync(string table)
    {
        await using var connection = await _db.Factory.OpenAsync(default);
        var rows = await connection.QueryAsync<string>("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = @table
            """, new { table });
        return rows.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private async Task<bool> TableExistsAsync(string table)
    {
        await using var connection = await _db.Factory.OpenAsync(default);
        return await connection.ExecuteScalarAsync<bool>(
            "SELECT to_regclass('public.' || @table) IS NOT NULL", new { table });
    }

    [Theory]
    [InlineData("payroll_run_employees")]
    [InlineData("payroll_opening_balances")]
    [InlineData("payroll_tax_settings")]
    [InlineData("payroll_gross_up_shoulders")]
    [InlineData("attendance_shifts")]
    [InlineData("attendance_shift_assignments")]
    public async Task PayrollExtensionTablesExistAfterMigrations(string table) =>
        Assert.True(await TableExistsAsync(table), $"Table '{table}' is missing after migrations.");

    [Fact]
    public async Task RunsCarryTypeAndCutoffColumns()
    {
        var columns = await ColumnsAsync("payroll_runs");

        Assert.Contains("run_type", columns);
        Assert.Contains("source_run_id", columns);
        Assert.Contains("cutoff_at", columns);
    }

    [Fact]
    public async Task OpeningBalancesMatchTheModelColumns()
    {
        var columns = await ColumnsAsync("payroll_opening_balances");

        foreach (var expected in new[]
                 {
                     "company_id", "employee_id", "tax_year_code", "tax_base", "tax_withheld",
                     "insurance_base", "insurance_employee", "insurance_employer",
                     "health_base", "health_employee", "health_employer", "notes"
                 })
            Assert.Contains(expected, columns);
    }

    [Fact]
    public async Task GrossUpShouldersAreTheNewV61TableAndNotTheLegacyPolicyTable()
    {
        var columns = await ColumnsAsync("payroll_gross_up_shoulders");

        Assert.Contains("payroll_item_id", columns);
        Assert.Contains("shoulder_type", columns);
        Assert.Contains("effective_from", columns);
        // الجدول القديم payroll_gross_up_item_rules مبني على policy_id ولا يستخدمه V6.1.
        Assert.DoesNotContain("policy_id", columns);
    }

    [Fact]
    public async Task LeaveBalancesKeepCarryOverLimitColumn()
    {
        var columns = await ColumnsAsync("leave_balances");

        Assert.Contains("carry_over_limit", columns);
        Assert.Contains("carry_over_allowed", columns);
        Assert.Contains("remaining_balance", columns);
    }

    [Fact]
    public async Task PurchaseReturnTablesExistSoTheChainBootstrapsFromScratch()
    {
        Assert.True(await TableExistsAsync("purchase_returns"));
        Assert.True(await TableExistsAsync("purchase_return_lines"));
    }
}
