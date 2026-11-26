using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Sales;

public partial class Reservations
{
    [Inject] private IDialogService Dialogs { get; set; } = default!;
    [Inject] private BranchService Branches { get; set; } = default!;
    private MudTable<ReservationRow> _table = default!;
    private ReservationRow? _selected;
    private bool _onlyRemaining;
    private bool _openOnly = true;
    private bool _busy;
    private string? _customerSearch;
    private DateTime? _extendTo = DateTime.Today.AddDays(30);
    private IReadOnlyList<Branch> _branches = Array.Empty<Branch>();
    /// <summary>الفروع المختارة (الافتراضي: كل الفروع المربوطة بالمستخدم).</summary>
    private HashSet<Guid> _branchIds = new();
    private IReadOnlyCollection<Guid>? _selectedBranchIds;

    protected override string ScreenCode => ScreenCodes.Reservations;

    protected override async Task OnLoadAsync()
    {
        _branches = await Branches.OptionsAsync(Actor!);
        // الوضع الافتراضي: كل الفروع المربوطة بالمستخدم محددة.
        _branchIds = _branches.Select(b => b.Id).ToHashSet();
        _selectedBranchIds = _branchIds.Count == 0 ? null : _branchIds.ToArray();
    }

    private IReadOnlyList<Guid> AllBranchesSelected => _branches.Select(b => b.Id).ToList();

    /// <summary>عرض أسماء الفروع بدل معرّفاتها في قائمة الفلتر.</summary>
    private string BranchName(Guid id) =>
        _branches.FirstOrDefault(b => b.Id == id)?.NameAr ?? id.ToString();

    private async Task OnBranchesChanged(IEnumerable<Guid>? values)
    {
        _branchIds = values is null ? new HashSet<Guid>() : values.ToHashSet();
        _selectedBranchIds = _branchIds.Count == 0 ? null : _branchIds.ToArray();
        await RefreshAsync();
    }

    private async Task<TableData<ReservationRow>> LoadAsync(TableState state, CancellationToken ct)
    {
        var page = await ReservationsApi.ListAsync(Actor!, new PageRequest
        {
            Page = state.Page + 1,
            PageSize = state.PageSize <= 25 ? 25 : 50
        }, null, _onlyRemaining, _customerSearch, ct, _selectedBranchIds, _openOnly);
        return new TableData<ReservationRow> { Items = page.Items, TotalItems = page.Total };
    }

    private async Task RefreshAsync() => await _table.ReloadServerData();

    private async Task OnOpenOnlyChanged(bool value)
    {
        _openOnly = value;
        await RefreshAsync();
    }

    private async Task OnRemainingChanged(bool value)
    {
        _onlyRemaining = value;
        await RefreshAsync();
    }

    private void OnSelected(ReservationRow? row) => _selected = row;

    private async Task ExecuteAsync(ReservationRow row)
    {
        try
        {
            var dialog = await Dialogs.ShowAsync<ExecutionDialog>(T.T("execution.title"),
                new DialogParameters { ["BookingLineId"] = row.BookingLineId });
            if ((await dialog.Result) is { Canceled: false })
            {
                await RefreshAsync();
                Snackbar.Add(T.T("execution.done"), Severity.Success);
            }
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
    }

    private async Task ExtendAsync(ReservationRow row)
    {
        if (_busy || _extendTo is null) return;
        _busy = true;
        try
        {
            await ReservationsApi.ExtendAsync(Actor!, row.BookingId,
                Fmt.StartOfDay(_extendTo.Value));
            Snackbar.Add(T.T("reservations.extended"), Severity.Success);
            await RefreshAsync();
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        finally { _busy = false; }
    }

    /// <summary>فتح تفاصيل السداد: الإيصالات والتسويات التي سددت من قيمة الخدمة.</summary>
    private async Task ShowPaymentsAsync(ReservationRow row)
    {
        await Dialogs.ShowAsync<PaymentDetailDialog>(T.T("payment_detail.title"),
            new DialogParameters { ["BookingLineId"] = row.BookingLineId },
            new DialogOptions { MaxWidth = MaxWidth.Medium, FullWidth = true });
    }

    /// <summary>تفاصيل الكمية المستهلكة ومصادرها (افتتاحي/تحويل/تنفيذ).</summary>
    private async Task ShowConsumptionAsync(ReservationRow row)
    {
        await Dialogs.ShowAsync<ConsumptionDetailDialog>(T.T("consumption.title"),
            new DialogParameters { ["BookingLineId"] = row.BookingLineId },
            new DialogOptions { MaxWidth = MaxWidth.Medium, FullWidth = true });
    }

    private async Task SettleAsync(ReservationRow row)
    {
        if (_busy || row.RemainingQty <= 0) return;
        var dialog = await Dialogs.ShowAsync<BookingSettlementDialog>(T.T("settlement.title"),
            new DialogParameters
            {
                ["BranchId"] = row.BranchId,
                ["CustomerId"] = row.CustomerId
            },
            new DialogOptions { MaxWidth = MaxWidth.ExtraLarge, FullWidth = true });
        if ((await dialog.Result) is { Canceled: false })
        {
            await RefreshAsync();
            Snackbar.Add(T.T("settlement.created"), Severity.Success);
        }
    }

    private async Task ReleaseAsync(ReservationRow row)
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await ReservationsApi.ReleaseAsync(Actor!, row.BookingId, T.T("reservations.release_reason"));
            Snackbar.Add(T.T("reservations.released"), Severity.Success);
            await RefreshAsync();
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        finally { _busy = false; }
    }
}
