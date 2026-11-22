using System.Reflection;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حراسة مخطط المرتبات: تمنع رجوع الخطأ في 0133، وتمنع تضارب مصادر الحقيقة
/// بين سجل تنفيذ الموظف (payroll_run_employees) وجدول المبالغ (payroll_results).
/// تقرأ السكربتات من الموارد المضمّنة في Ubp.Infrastructure — لا تعتمد على مسار الملفات.
/// </summary>
public sealed class PayrollSchemaGuardTests
{
    private static readonly Assembly InfrastructureAssembly =
        typeof(Ubp.Infrastructure.Repositories.PayrollRunRepository).Assembly;

    private static string ReadScript(string fileName)
    {
        var resource = InfrastructureAssembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("." + fileName, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Embedded migration '{fileName}' was not found.");
        using var stream = InfrastructureAssembly.GetManifestResourceStream(resource)!;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private static IEnumerable<string> AllPayrollScripts() =>
        InfrastructureAssembly.GetManifestResourceNames()
            .Where(n => n.Contains(".Migrations.Scripts.", StringComparison.Ordinal))
            .Where(n => n.Contains("payroll", StringComparison.OrdinalIgnoreCase))
            .Select(n =>
            {
                using var stream = InfrastructureAssembly.GetManifestResourceStream(n)!;
                using var reader = new StreamReader(stream);
                return reader.ReadToEnd();
            });

    [Fact]
    public void AdjustmentRunScriptAddsTypeAndSourceRunSafely()
    {
        var text = ReadScript("0210_payroll_adjustment_runs.sql");

        Assert.Contains("ADD COLUMN IF NOT EXISTS run_type", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("DEFAULT 'REGULAR'", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("ck_payroll_runs_type", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("source_run_id", text, StringComparison.OrdinalIgnoreCase);
        // لا إسقاط لأي عمود: الترحيل إضافي فقط ويحفظ سلوك الدورات القائمة.
        Assert.DoesNotContain("DROP COLUMN", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SimulationRunsScriptDeclaresItsTable()
    {
        var text = ReadScript("0133_payroll_simulation_runs.sql");
        Assert.Contains("CREATE TABLE IF NOT EXISTS payroll_simulation_runs", text,
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RunEmployeesTableExistsAndIsUniquePerEmployeeSegment()
    {
        var text = ReadScript("0206_payroll_run_employees.sql");
        Assert.Contains("CREATE TABLE IF NOT EXISTS payroll_run_employees", text,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("UNIQUE (run_id, employee_id, run_segment)", text,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("REFERENCES payroll_runs(id)", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("REFERENCES employees(id)", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RunEmployeesTableHoldsNoAmountsSoResultsStaySingleSourceOfTruth()
    {
        var text = ReadScript("0206_payroll_run_employees.sql");
        foreach (var moneyColumn in new[]
                 {
                     "gross_amount", "net_amount", "deductions_amount", "employer_cost",
                     "total_amount", "paid_amount"
                 })
        {
            Assert.False(text.Contains(moneyColumn, StringComparison.OrdinalIgnoreCase),
                $"payroll_run_employees must not store money column '{moneyColumn}'.");
        }
    }

    [Fact]
    public void SingleSourceOfTruthTablesAreDeclaredExactlyOnce()
    {
        var scripts = AllPayrollScripts().ToList();
        foreach (var table in new[] { "payroll_results", "payroll_run_employees", "payroll_simulation_runs" })
        {
            var count = scripts.Count(s =>
                s.Contains($"CREATE TABLE IF NOT EXISTS {table}", StringComparison.OrdinalIgnoreCase));
            Assert.True(count == 1, $"Table '{table}' must be declared exactly once, found {count}.");
        }
    }
}
