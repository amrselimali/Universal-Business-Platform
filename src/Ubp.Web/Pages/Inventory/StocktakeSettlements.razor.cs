using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Inventory;

public partial class StocktakeSettlements
{
    [Inject] private StocktakeSettlementService Settlements { get; set; } = default!;
    [Inject] private IDialogService DialogService { get; set; } = default!;

    private MudTable<Stocktake> _table = default!;
    private IReadOnlyList<Warehouse> _warehouses = Array.Empty<Warehouse>();
    private DateTime? _from = new(DateTime.Today.Year, 1, 1);
    private DateTime? _to = DateTime.Today;
    private Guid? _warehouseId;
    private string? _search;
    private bool _posting;

    protected override string ScreenCode => ScreenCodes.StocktakeSettlements;

    protected override async Task OnLoadAsync()
    {
        _warehouses = await Settlements.ListWarehousesAsync(Actor!);
    }

    private async Task<TableData<Stocktake>> LoadServerData(TableState state, CancellationToken ct)
    {
        try
        {
            var result = await Settlements.ListAsync(Actor!, new PageRequest
            {
                Page = state.Page + 1,
                PageSize = state.PageSize,
                Search = _search
            }, _from, _to, _warehouseId, ct);
            return new TableData<Stocktake> { Items = result.Items, TotalItems = result.Total };
        }
        catch (AppException ex)
        {
            Snackbar.Add(T.T(ex.Code), Severity.Error);
            return new TableData<Stocktake> { Items = Array.Empty<Stocktake>(), TotalItems = 0 };
        }
    }

    private async Task ReloadAsync() => await _table.ReloadServerData();

    private async Task ViewAsync(Stocktake stocktake)
    {
        await DialogService.ShowAsync<StocktakeViewDialog>(stocktake.Code,
            new DialogParameters { ["Id"] = stocktake.Id, ["Code"] = stocktake.Code },
            new DialogOptions { MaxWidth = MaxWidth.ExtraLarge, FullWidth = true });
    }

    private async Task PostAsync(Stocktake stocktake)
    {
        if (_posting || stocktake.Status != "DRAFT") return;
        var confirmed = await DialogService.ShowMessageBoxAsync(T.T("stocktake.post"),
            T.T("stocktake.settlement_confirm"), yesText: T.T("stocktake.post"),
            cancelText: T.T("common.cancel"));
        if (confirmed != true) return;

        _posting = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            await Settlements.PostAsync(actor, stocktake.Id);
            await ReloadAsync();
            ShowSuccess("stocktake.settlement_posted");
        }
        catch (AppException ex) { ShowError(ex); }
        catch (Exception) { Snackbar.Add(T.T("error.generic"), Severity.Error); }
        finally { _posting = false; }
    }
}
