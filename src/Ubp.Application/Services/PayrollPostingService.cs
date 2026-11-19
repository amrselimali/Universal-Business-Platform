using Ubp.Core.Models;
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

    public PayrollPostingService(IPayrollRunRepository runs, IEmployeeRepository employees,
        IJournalRepository journals, IJournalEntryRepository entries,
        IJournalPostingRepository posting, IAccountingSettingsRepository settings)
    {
        _runs = runs;
        _employees = employees;
        _journals = journals;
        _entries = entries;
        _posting = posting;
        _settings = settings;
    }

    public async Task<int> PostRunAsync(Guid runId, Guid userId, CancellationToken ct = default)
    {
        var run = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (run.Status != PayrollRunStatuses.Approved)
            throw new InvalidOperationException("Only approved payroll runs can be posted.");

        var journal = await _journals.GetByCodeAsync("GEN", ct)
            ?? throw new InvalidOperationException("The general journal is not configured.");
        var defaults = (await _settings.ListDefaultsAsync(ct))
            .Where(x => x.AccountId.HasValue)
            .ToDictionary(x => x.SettingKey, x => x.AccountId!.Value, StringComparer.OrdinalIgnoreCase);
        var expenseAccount = Need(defaults, PostingKeys.PayrollSalaryExpense);
        var payableAccount = Need(defaults, PostingKeys.PayrollPayable);
        var results = await _runs.ListResultsAsync(runId, ct);
        var count = 0;

        foreach (var result in results.Where(x => x.NetAmount > 0))
        {
            var employee = await _employees.GetAsync(result.EmployeeId, ct)
                ?? throw new InvalidOperationException($"Employee '{result.EmployeeId}' was not found.");
            if (!employee.BranchId.HasValue)
                throw new InvalidOperationException($"Employee '{result.EmployeeId}' has no branch for posting.");

            var existing = await _runs.GetJournalLinkAsync(runId, result.EmployeeId, ct);
            if (existing?.JournalEntryId is not null) continue;

            var entryId = Guid.NewGuid();
            await _entries.CreateDraftAsync(entryId, new JournalEntryInput
            {
                JournalId = journal.Id,
                BranchId = employee.BranchId.Value,
                EntryDate = run.SalaryTo.ToDateTime(TimeOnly.MinValue),
                Reference = $"PAYROLL-{runId:N}",
                Description = $"Payroll {run.SalaryFrom:yyyy-MM-dd} - {run.SalaryTo:yyyy-MM-dd} / {result.EmployeeId}",
                Lines = new List<JournalEntryLineInput>
                {
                    new() { AccountId = expenseAccount, Debit = result.GrossAmount, Description = "Payroll salary expense" },
                    new() { AccountId = payableAccount, Credit = result.GrossAmount, Description = "Payroll payable" }
                }
            }, userId, EntrySources.Payroll, result.EmployeeId, ct);
            await _posting.PostAsync(entryId, userId, ct);
            await _runs.SaveJournalLinkAsync(runId, result.EmployeeId, entryId, "accrual", ct);
            count++;
        }

        var current = await _runs.GetAsync(runId, ct)
            ?? throw new KeyNotFoundException("Payroll run was not found.");
        if (!await _runs.UpdateStatusAsync(runId, current.Version, PayrollRunStatuses.Posted, ct))
            throw new InvalidOperationException("The payroll run was changed by another user.");
        return count;
    }

    private static Guid Need(IReadOnlyDictionary<string, Guid> defaults, string key) =>
        defaults.TryGetValue(key, out var id)
            ? id
            : throw new InvalidOperationException($"Posting account '{key}' is not configured.");
}
