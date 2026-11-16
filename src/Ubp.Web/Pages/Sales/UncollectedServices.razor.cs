using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Sales;

public partial class UncollectedServices
{
    [Inject] private UncollectedServicesService Uncollected { get; set; } = default!;
    [Inject] private BranchService Branches { get; set; } = default!;
    [Inject] private IJSRuntime JS { get; set; } = default!;

    private IReadOnlyList<Branch> _branches = Array.Empty<Branch>();
    private List<ReservationRow> _rows = new();
    private DateTime? _from;
    private DateTime? _to;
    private Guid? _branchId;
    private string _sort = "date_desc";
    private string _group = "none";

    protected override string ScreenCode => ScreenCodes.UncollectedServices;

    private sealed record CustomerGroup(Guid CustomerId, string CustomerCode, string CustomerName,
        string Branches, int Lines, decimal RemainingQty, decimal RemainingValue);

    private sealed record BranchGroup(Guid BranchId, string BranchName, int Customers, int Lines,
        decimal RemainingQty, decimal RemainingValue);

    private List<CustomerGroup> CustomerGroups => _rows
        .GroupBy(r => r.CustomerId)
        .Select(g => new CustomerGroup(g.Key, g.First().CustomerCode ?? "", g.First().CustomerName,
            string.Join("، ", g.Select(x => x.BranchName).Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()),
            g.Count(), g.Sum(x => x.RemainingQty), g.Sum(x => x.RemainingValue)))
        .OrderByDescending(g => g.RemainingValue).ToList();

    private List<BranchGroup> BranchGroups => _rows
        .GroupBy(r => r.BranchId)
        .Select(g => new BranchGroup(g.Key, g.First().BranchName ?? "",
            g.Select(x => x.CustomerId).Distinct().Count(), g.Count(),
            g.Sum(x => x.RemainingQty), g.Sum(x => x.RemainingValue)))
        .OrderByDescending(g => g.RemainingValue).ToList();

    protected override async Task OnLoadAsync()
    {
        _branches = await Branches.OptionsAsync(Actor!);
        await LoadAsync();
    }

    private async Task LoadAsync()
    {
        try
        {
            var actor = await UserContext.RequireAsync();
            _rows = (await Uncollected.ListAsync(actor, _from, _to, _branchId, _sort)).ToList();
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
    }

    private async Task OnBranchChanged(Guid? value)
    {
        _branchId = value;
        await LoadAsync();
    }

    private async Task OnSortChanged(string value)
    {
        _sort = value;
        await LoadAsync();
    }

    private async Task OnGroupChanged(string value)
    {
        _group = value;
        await LoadAsync();
    }

    private async Task PrintAsync() => await JS.InvokeVoidAsync("ubpPrint");
}
