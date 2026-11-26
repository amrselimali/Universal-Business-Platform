using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Reports.Accounting;

public partial class Ledger
{
    [Inject] private AccountingReportService Reports { get; set; } = default!;
    [Inject] private AccountService AccountsService { get; set; } = default!;
    [Inject] private BranchService BranchService { get; set; } = default!;
    [Inject] private IJSRuntime JS { get; set; } = default!;

    private IReadOnlyList<Account> _accounts = Array.Empty<Account>();
    private IReadOnlyList<Branch> _branches = Array.Empty<Branch>();
    private List<LedgerRow> _rows = new();
    private LedgerPage? _page;
    private Guid? _accountId;
    private DateTime? _from = new(DateTime.Today.Year, 1, 1);
    private DateTime? _to = DateTime.Today;
    private IReadOnlyList<Guid> _branchIds = Array.Empty<Guid>();
    private bool _includeChildren = true;
    private bool _busy;
    private bool IsEnglish => T.Language == "en";
    private string DraftMessage => string.Format(T.T("accounting.draft_pending"),
        _page?.DraftEntries ?? 0, (_page?.DraftDebit ?? 0).ToString("N2"));

    protected override string ScreenCode => ScreenCodes.LedgerReport;

    protected override async Task OnLoadAsync()
    {
        _accounts = await AccountsService.PostableAsync(Actor!);
        _branches = await BranchService.OptionsAsync(Actor!);
        _accountId = _accounts.FirstOrDefault()?.Id;
    }

    /// <summary>ظ†ط·ط§ظ‚ ط§ظ„ظپط±ظˆط¹: ظ„ط§ ط§ط®طھظٹط§ط± = ظƒظ„ ظپط±ظˆط¹ ط§ظ„ظ…ط³طھط®ط¯ظ… (ظٹظ‚طµظ‘ظ‡ط§ ط§ظ„ط³ظٹط±ظپط±).</summary>
    private async Task OnBranchScope(IReadOnlyList<Guid> branchIds)
    {
        _branchIds = branchIds;
        await SearchAsync();
    }

    private async Task SearchAsync() => await RunAsync(async () =>
    {
        if (_accountId is null) return;
        _busy = true;
        try
        {
            _page = await Reports.LedgerAsync(Actor!, new LedgerRequest
            {
                AccountId = _accountId.Value,
                From = _from ?? new DateTime(DateTime.Today.Year, 1, 1),
                To = _to ?? DateTime.Today,
                BranchIds = _branchIds.ToArray(),
                IncludeChildren = _includeChildren,
                PageSize = 50
            });
            _rows = _page.Rows.ToList();
        }
        finally { _busy = false; }
    });

    private async Task LoadMoreAsync() => await RunAsync(async () =>
    {
        if (_page?.NextCursor is null || _accountId is null) return;
        _busy = true;
        try
        {
            var next = await Reports.LedgerAsync(Actor!, new LedgerRequest
            {
                AccountId = _accountId.Value,
                From = _page.From,
                To = _page.To,
                BranchIds = _branchIds.ToArray(),
                IncludeChildren = _includeChildren,
                PageSize = 50,
                Cursor = LedgerCursor.From(_page.NextCursor)
            });
            _rows.AddRange(next.Rows);
            _page.NextCursor = next.NextCursor;
            _page.HasMore = next.HasMore;
        }
        finally { _busy = false; }
    });

    private async Task PrintAsync()
    {
        await JS.InvokeVoidAsync("print");
    }
}
