using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>Creates and posts payroll journal entries, idempotently per run and employee.</summary>
public sealed class PayrollPostingService
{
    private readonly IPayrollRunRepository _runs;
    private readonly IEmployeeRepository _employees;
    private readonly IJournalRepository _journals;
    private readonly IJournalEntryRepository _entries;
    private readonly IJournalPostingRepository _posting;
    private readonly IAccountingSettingsRepository _settings;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollPostingService(IPayrollRunRepository runs, IEmployeeRepository employees,
        IJournalRepository journals, IJournalEntryRepository entries,
        IJournalPostingRepository posting, IAccountingSettingsRepository settings,
        PermissionService permissions, PayrollAuditWriter audit)
    {
        _runs = runs;
        _employees = employees;
        _journals = journals;
        _entries = entries;
        _posting = posting;
        _settings = settings;
        _permissions = permissions;
        _audit = audit;
    }

    public async Task<int> PostRunAsync(Guid runId, Guid userId, ActorContext? actor = null,
        CancellationToken ct = default)
    {
        var run = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (actor is not null &&
            !await _permissions.HasAsync(actor, ScreenCodes.PayrollRuns, ActionCodes.Post, ct) &&
            !await _permissions.HasAsync(actor, ScreenCodes.PayrollPosting, ActionCodes.Post, ct))
            throw new ForbiddenException();
        if (run.Status != PayrollRunStatuses.Approved)
            throw new InvalidOperationException("Only approved payroll runs can be posted.");

        var issues = await _runs.ListIssuesAsync(runId, ct);
        if (issues.Any(x => PayrollRunWorkflow.IsBlocker(x.Severity) && !x.IsOverridden))
            throw new InvalidOperationException("PAYROLL_RUN_HAS_BLOCKING_ISSUES");

        var journal = await _journals.GetByCodeAsync("GEN", ct)
            ?? throw new InvalidOperationException("The general journal is not configured.");
        var defaults = (await _settings.ListDefaultsAsync(ct))
            .Where(x => x.AccountId.HasValue)
            .ToDictionary(x => x.SettingKey, x => x.AccountId!.Value, StringComparer.OrdinalIgnoreCase);
        var expenseAccount = Need(defaults, PostingKeys.PayrollSalaryExpense);
        var payableAccount = Need(defaults, PostingKeys.PayrollPayable);
        var results = await _runs.ListResultsAsync(runId, ct);
        var count = 0;

        foreach (var result in results.Where(x => x.GrossAmount != 0 || x.NetAmount != 0))
        {
            var employee = await _employees.GetAsync(result.EmployeeId, ct)
                ?? throw new InvalidOperationException($"Employee '{result.EmployeeId}' was not found.");
            if (!employee.BranchId.HasValue)
                throw new InvalidOperationException($"Employee '{result.EmployeeId}' has no branch for posting.");

            var existing = await _runs.GetJournalLinkAsync(runId, result.EmployeeId, ct);
            if (existing?.JournalEntryId is not null) continue;

            var details = await _runs.ListResultDetailsAsync(result.Id, ct);
            decimal AmountOf(params string[] codes) => details
                .Where(d => codes.Contains(d.ItemCode, StringComparer.OrdinalIgnoreCase))
                .Sum(d => d.Amount);

            var tax = AmountOf("INCOME_TAX");
            var insurance = AmountOf("SOCIAL_INSURANCE_EMPLOYEE", "HEALTH_INSURANCE_EMPLOYEE");
            var employerCost = AmountOf("EMPLOYER_COST");
            var otherDeductions = result.GrossAmount - result.NetAmount - tax - insurance;
            var employerShare = Math.Max(0, employerCost - result.GrossAmount);

            var taxAccount = Optional(defaults, PostingKeys.PayrollTaxPayable) ?? payableAccount;
            var insuranceAccount = Optional(defaults, PostingKeys.PayrollInsurancePayable) ?? payableAccount;
            var deductionsAccount = Optional(defaults, PostingKeys.PayrollDeductionsPayable) ?? payableAccount;

            // الأسطر بالإشارة: الصافي السالب (دورة تسوية استقطاعات فقط) يصبح مديناً على حساب المستحق،
            // فيبقى القيد متوازناً دون اختراع مبالغ أو قلب للحسابات.
            var lines = new List<JournalEntryLineInput>();
            void AddSigned(Guid account, decimal amount, string description, bool credit)
            {
                if (amount == 0) return;
                var asCredit = credit ? amount > 0 : amount < 0;
                lines.Add(new JournalEntryLineInput
                {
                    AccountId = account,
                    Debit = asCredit ? 0 : Math.Abs(amount),
                    Credit = asCredit ? Math.Abs(amount) : 0,
                    Description = description
                });
            }

            AddSigned(expenseAccount, result.GrossAmount, "Payroll salary expense", credit: false);
            AddSigned(payableAccount, result.NetAmount, "Payroll net payable", credit: true);
            AddSigned(taxAccount, tax, "Income tax payable", credit: true);
            AddSigned(insuranceAccount, insurance, "Social/health insurance payable", credit: true);
            AddSigned(deductionsAccount, otherDeductions, "Other deductions payable", credit: true);
            if (employerShare > 0)
            {
                var employerExpense = Optional(defaults, PostingKeys.PayrollEmployerExpense) ?? expenseAccount;
                var employerPayable = Optional(defaults, PostingKeys.PayrollEmployerPayable) ?? payableAccount;
                lines.Add(new() { AccountId = employerExpense, Debit = employerShare, Description = "Employer contributions expense" });
                lines.Add(new() { AccountId = employerPayable, Credit = employerShare, Description = "Employer contributions payable" });
            }

            var entryId = Guid.NewGuid();
            await _entries.CreateDraftAsync(entryId, new JournalEntryInput
            {
                JournalId = journal.Id,
                BranchId = employee.BranchId.Value,
                EntryDate = run.SalaryTo.ToDateTime(TimeOnly.MinValue),
                Reference = $"PAYROLL-{runId:N}",
                Description = $"Payroll {run.SalaryFrom:yyyy-MM-dd} - {run.SalaryTo:yyyy-MM-dd} / {result.EmployeeId}",
                Lines = lines
            }, userId, EntrySources.Payroll, result.EmployeeId, ct);
            await _posting.PostAsync(entryId, userId, ct);
            await _runs.SaveJournalLinkAsync(runId, result.EmployeeId, entryId, "accrual", ct);
            count++;
        }

        var current = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (!await _runs.UpdateStatusAsync(runId, current.Version, PayrollRunStatuses.Posted, ct))
            throw new InvalidOperationException("The payroll run was changed by another user.");
        if (actor is not null)
            await _audit.WriteAsync(actor, "payroll_runs", runId.ToString(), "POST",
                new { status = PayrollRunStatuses.Approved },
                new { status = PayrollRunStatuses.Posted, entries = count }, ct);
        return count;
    }

    private static Guid Need(IReadOnlyDictionary<string, Guid> defaults, string key) =>
        defaults.TryGetValue(key, out var id)
            ? id
            : throw new InvalidOperationException($"Posting account '{key}' is not configured.");

    /// <summary>حساب اختياري: يُستخدم للتفصيل إن كان مضبوطاً، وإلا يرجع للحساب الافتراضي.</summary>
    private static Guid? Optional(IReadOnlyDictionary<string, Guid> defaults, string key) =>
        defaults.TryGetValue(key, out var id) ? id : null;
}
