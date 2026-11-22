using System.Text;
using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// تقارير المرتبات: السجل، الكشف التفصيلي، فروق الفترات، تراكم الضريبة، تكلفة صاحب العمل،
/// والاستثناءات — كلها قراءة فقط من نتائج التشغيل القائمة، مع تصدير CSV.
/// </summary>
public sealed class PayrollReportingService
{
    private readonly IPayrollReportingRepository _reports;
    private readonly IPayrollRunRepository _runs;
    private readonly IPayrollStatutoryRepository _statutory;

    public PayrollReportingService(IPayrollReportingRepository reports, IPayrollRunRepository runs,
        IPayrollStatutoryRepository statutory)
    {
        _reports = reports;
        _runs = runs;
        _statutory = statutory;
    }

    public Task<IReadOnlyList<PayrollRegisterRow>> RegisterAsync(Guid runId, CancellationToken ct = default) =>
        _reports.RegisterAsync(runId, ct);

    public Task<IReadOnlyList<PayrollPayslipRow>> PayslipAsync(Guid runId, Guid employeeId,
        CancellationToken ct = default) => _reports.PayslipAsync(runId, employeeId, ct);

    public Task<IReadOnlyList<PayrollVarianceRow>> VarianceAsync(Guid runId, Guid? previousRunId,
        CancellationToken ct = default) => _reports.VarianceAsync(runId, previousRunId, ct);

    public Task<IReadOnlyList<PayrollTaxAccumulationRow>> TaxAccumulationAsync(DateOnly from, DateOnly to,
        CancellationToken ct = default) => _reports.TaxAccumulationAsync(from, to, ct);

    public Task<IReadOnlyList<PayrollEmployerCostRow>> EmployerCostAsync(Guid runId,
        CancellationToken ct = default) => _reports.EmployerCostAsync(runId, ct);

    public Task<IReadOnlyList<PayrollRunIssue>> ExceptionsAsync(Guid runId, CancellationToken ct = default) =>
        _runs.ListIssuesAsync(runId, ct);

    public Task<IReadOnlyList<PayrollAuditRow>> AuditAsync(DateTime fromUtc, DateTime toUtc,
        CancellationToken ct = default) => _reports.AuditAsync(fromUtc, toUtc, 200, ct);

    public Task<IReadOnlyList<PayrollInsuranceReportRow>> InsuranceAsync(Guid runId,
        CancellationToken ct = default) => _reports.InsuranceAsync(runId, ct);

    public Task<IReadOnlyList<PayrollTaxExemption>> ExemptionsAsync(DateOnly asOf,
        CancellationToken ct = default) => _statutory.ListTaxExemptionsAsync(asOf, ct);

    /// <summary>مصنّف Excel متعدد الأوراق: ملخص، سجل، تأمين، تكلفة صاحب العمل، استثناءات، إعفاءات.</summary>
    public async Task<string> ExportWorkbookXmlAsync(Guid runId, CancellationToken ct = default)
    {
        var run = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        var totals = await _runs.GetTotalsAsync(runId, ct);
        var register = await _reports.RegisterAsync(runId, ct);
        var insurance = await _reports.InsuranceAsync(runId, ct);
        var employer = await _reports.EmployerCostAsync(runId, ct);
        var issues = await _runs.ListIssuesAsync(runId, ct);
        var exemptions = await _statutory.ListTaxExemptionsAsync(run.SalaryTo, ct);

        var sheets = new List<PayrollSheet>
        {
            new("Summary", new[] { "Key", "Value" }, new List<IReadOnlyList<object?>>
            {
                new object?[] { "RunId", run.Id.ToString() },
                new object?[] { "RunType", run.RunType },
                new object?[] { "Status", run.Status },
                new object?[] { "SalaryFrom", run.SalaryFrom },
                new object?[] { "SalaryTo", run.SalaryTo },
                new object?[] { "Employees", totals.EmployeeCount },
                new object?[] { "Gross", totals.GrossAmount },
                new object?[] { "Deductions", totals.DeductionsAmount },
                new object?[] { "Net", totals.NetAmount },
                new object?[] { "Issues", totals.IssueCount },
                new object?[] { "BlockingIssues", totals.BlockingIssueCount }
            }),
            new("Register",
                new[] { "Code", "Employee", "Branch", "Currency", "Gross", "Deductions", "Net", "Version" },
                register.Select(row => (IReadOnlyList<object?>)new object?[]
                {
                    row.Code, row.NameAr, row.BranchName, row.CurrencyCode,
                    row.GrossAmount, row.DeductionsAmount, row.NetAmount, row.CalculationVersion
                }).ToList()),
            new("Insurance",
                new[]
                {
                    "Code", "Employee", "Currency", "InsuranceBase", "SocialEmployee", "SocialEmployer",
                    "HealthBase", "HealthEmployee", "HealthEmployer"
                },
                insurance.Select(row => (IReadOnlyList<object?>)new object?[]
                {
                    row.Code, row.NameAr, row.CurrencyCode, row.InsuranceBasis,
                    row.SocialEmployee, row.SocialEmployer, row.HealthBasis,
                    row.HealthEmployee, row.HealthEmployer
                }).ToList()),
            new("EmployerCost",
                new[] { "Code", "Employee", "Gross", "EmployerCost", "EmployerInsurance", "EmployerHealth" },
                employer.Select(row => (IReadOnlyList<object?>)new object?[]
                {
                    row.Code, row.NameAr, row.GrossAmount, row.EmployerCost,
                    row.EmployerInsurance, row.EmployerHealth
                }).ToList()),
            new("Exceptions",
                new[] { "Severity", "Code", "Message", "Overridden", "Reason" },
                issues.Select(issue => (IReadOnlyList<object?>)new object?[]
                {
                    issue.Severity, issue.Code, issue.Message, issue.IsOverridden, issue.OverrideReason
                }).ToList()),
            new("TaxExemptions",
                new[] { "Code", "Name", "Type", "Amount", "Percentage", "Condition", "From", "To" },
                exemptions.Select(item => (IReadOnlyList<object?>)new object?[]
                {
                    item.Code, item.NameAr, item.ExemptionType, item.Amount, item.Percentage,
                    item.ConditionExpression, item.EffectiveFrom, item.EffectiveTo
                }).ToList())
        };

        return PayrollWorkbookBuilder.BuildWorkbookXml(sheets);
    }

    public async Task<string> ExportInsuranceCsvAsync(Guid runId, CancellationToken ct = default)
    {
        var rows = await _reports.InsuranceAsync(runId, ct);
        var sheet = new PayrollSheet("Insurance",
            new[]
            {
                "Code", "Employee", "Currency", "InsuranceBase", "SocialEmployee", "SocialEmployer",
                "HealthBase", "HealthEmployee", "HealthEmployer"
            },
            rows.Select(row => (IReadOnlyList<object?>)new object?[]
            {
                row.Code, row.NameAr, row.CurrencyCode, row.InsuranceBasis,
                row.SocialEmployee, row.SocialEmployer, row.HealthBasis,
                row.HealthEmployee, row.HealthEmployer
            }).ToList());
        return PayrollWorkbookBuilder.BuildCsv(sheet);
    }

    public async Task<string> ExportExemptionsCsvAsync(DateOnly asOf, CancellationToken ct = default)
    {
        var exemptions = await _statutory.ListTaxExemptionsAsync(asOf, ct);
        var sheet = new PayrollSheet("TaxExemptions",
            new[] { "Code", "Name", "Type", "Amount", "Percentage", "Condition", "From", "To" },
            exemptions.Select(item => (IReadOnlyList<object?>)new object?[]
            {
                item.Code, item.NameAr, item.ExemptionType, item.Amount, item.Percentage,
                item.ConditionExpression, item.EffectiveFrom, item.EffectiveTo
            }).ToList());
        return PayrollWorkbookBuilder.BuildCsv(sheet);
    }

    public async Task<string> ExportRegisterCsvAsync(Guid runId, CancellationToken ct = default)
    {
        var rows = await _reports.RegisterAsync(runId, ct);
        var builder = new StringBuilder();
        builder.AppendLine("Code,Employee,Branch,Currency,Gross,Deductions,Net,CalculationVersion");
        foreach (var row in rows)
            builder.AppendLine(string.Join(',',
                Csv(row.Code), Csv(row.NameAr), Csv(row.BranchName ?? ""), Csv(row.CurrencyCode),
                row.GrossAmount.ToString("0.00"), row.DeductionsAmount.ToString("0.00"),
                row.NetAmount.ToString("0.00"), Csv(row.CalculationVersion)));
        return builder.ToString();
    }

    public async Task<string> ExportPayslipCsvAsync(Guid runId, Guid employeeId, CancellationToken ct = default)
    {
        var rows = await _reports.PayslipAsync(runId, employeeId, ct);
        var builder = new StringBuilder();
        builder.AppendLine("ItemCode,Amount,Reference");
        foreach (var row in rows)
            builder.AppendLine(string.Join(',', Csv(row.ItemCode),
                row.Amount.ToString("0.00"), Csv(row.FormulaReference ?? "")));
        return builder.ToString();
    }

    private static string Csv(string value) =>
        value.Contains(',') || value.Contains('"')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
}
