using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using TreasuryModel = Ubp.Core.Models.Treasury;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Expenses;

public partial class OperatingExpenseDialog : ComponentBase
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter] public Guid? BranchId { get; set; }
    [Parameter] public Guid? ExpenseId { get; set; }

    [Inject] private OperatingExpenseService Expenses { get; set; } = default!;
    [Inject] private LookupService Lookup { get; set; } = default!;
    [Inject] private BranchService BranchApi { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private PermissionService Permissions { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private sealed class LineModel
    {
        public string? Description { get; set; }
        public Guid? CostCenterId { get; set; }
        public ItemOption? Item { get; set; }
        public Guid? WarehouseId { get; set; }
        public decimal Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal Amount => Math.Round(Quantity * UnitPrice, 2, MidpointRounding.AwayFromZero);
    }

    private MudForm _form = default!;
    private readonly List<LineModel> _lines = new();
    private IReadOnlyList<Branch> Branches = Array.Empty<Branch>();
    private IReadOnlyList<Warehouse> _warehouses = Array.Empty<Warehouse>();
    private IReadOnlyList<CostCenter> _costCenters = Array.Empty<CostCenter>();
    private IReadOnlyList<TreasuryModel> _treasuries = Array.Empty<TreasuryModel>();
    private Guid _branchId;
    private DateTime? _docDate = DateTime.Today;
    private Partner? _supplier;
    private Guid _treasuryId;
    private bool _onCredit;
    private bool _busy;
    private bool _canPost;

    private bool IsEditMode => ExpenseId.HasValue && ExpenseId.Value != Guid.Empty;

    private decimal Total => Math.Round(_lines.Sum(l => l.Amount), 2, MidpointRounding.AwayFromZero);

    private IReadOnlyList<Warehouse> BranchWarehouses => _branchId == Guid.Empty
        ? _warehouses
        : _warehouses.Where(w => w.BranchIds.Count == 0 || w.BranchIds.Contains(_branchId))
            .ToList();

    protected override async Task OnInitializedAsync()
    {
        var actor = await UserContext.RequireAsync();
        _canPost = await Permissions.HasAsync(actor, ScreenCodes.OperatingExpenses,
            ActionCodes.Post);
        Branches = await BranchApi.OptionsAsync(actor);
        _warehouses = await Lookup.WarehousesAsync(actor);

        if (IsEditMode)
        {
            var expense = await Expenses.GetAsync(actor, ExpenseId!.Value);
            if (expense is not null)
            {
                _branchId = BranchId ?? expense.BranchId;
                _docDate = expense.DocDate;
                _onCredit = !expense.IsPaid;

                await ReloadBranchAsync(preserveTreasury: true);
                if (expense.TreasuryId.HasValue)
                    _treasuryId = expense.TreasuryId.Value;

                if (expense.SupplierId != Guid.Empty)
                {
                    var suppliers = await Lookup.PartnersAsync(actor, PartnerKind.Supplier, null);
                    _supplier = suppliers.FirstOrDefault(s => s.Id == expense.SupplierId);
                }

                var items = await Lookup.ItemsAsync(actor, null, 200, false);
                foreach (var line in expense.Lines)
                {
                    _lines.Add(new LineModel
                    {
                        Description = line.Description,
                        CostCenterId = line.CostCenterId,
                        Item = line.ItemId.HasValue
                            ? items.FirstOrDefault(i => i.Id == line.ItemId.Value)
                            : null,
                        WarehouseId = line.WarehouseId,
                        Quantity = line.Quantity == 0 ? 1 : line.Quantity,
                        UnitPrice = line.UnitPrice
                    });
                }
            }
        }

        if (_branchId == Guid.Empty)
            _branchId = BranchId ?? actor.CurrentBranchId ?? Branches.FirstOrDefault()?.Id ?? Guid.Empty;

        if (_costCenters.Count == 0 && _treasuries.Count == 0)
            await ReloadBranchAsync(preserveTreasury: false);

        if (_lines.Count == 0)
            AddLine();
    }

    private async Task ReloadBranchAsync(bool preserveTreasury = false)
    {
        var previousTreasury = _treasuryId;
        var actor = await UserContext.RequireAsync();
        _costCenters = await Lookup.CostCentersAsync(actor,
            _branchId == Guid.Empty ? actor.CurrentBranchId : _branchId);
        _treasuries = await Lookup.TreasuriesAsync(actor, _branchId);

        if (preserveTreasury && previousTreasury != Guid.Empty &&
            _treasuries.Any(t => t.Id == previousTreasury))
        {
            _treasuryId = previousTreasury;
        }
        else
        {
            _treasuryId = _treasuries.FirstOrDefault()?.Id ?? Guid.Empty;
        }
    }

    private async Task OnBranchChanged(Guid branchId)
    {
        _branchId = branchId;
        foreach (var line in _lines) line.WarehouseId = null;
        await ReloadBranchAsync(preserveTreasury: false);
    }

    private void OnItemChanged(LineModel line, ItemOption? item)
    {
        line.Item = item;
        if (item is null) { line.WarehouseId = null; return; }
        line.WarehouseId ??= BranchWarehouses.FirstOrDefault()?.Id;
    }

    private void AddLine() => _lines.Add(new LineModel());
    private void Cancel() => MudDialog.Cancel();

    private static string SupplierLabel(Partner? partner) =>
        partner is null ? string.Empty : $"{partner.Code} — {partner.NameAr}";

    private static string ItemLabel(ItemOption? item) =>
        item is null ? string.Empty : $"{item.Code} — {item.NameAr}";

    private Task<IEnumerable<Partner>> SearchSuppliers(string? search, CancellationToken ct) =>
        LoadAsync(search, (actor, text) => Lookup.PartnersAsync(actor, PartnerKind.Supplier, text, ct));

    private Task<IEnumerable<ItemOption>> SearchItems(string? search, CancellationToken ct) =>
        LoadAsync(search, (actor, text) => Lookup.ItemsAsync(actor, text, 50, false, ct: ct));

    private async Task<IEnumerable<T>> LoadAsync<T>(string? search,
        Func<ActorContext, string?, Task<IReadOnlyList<T>>> load)
    {
        var actor = await UserContext.RequireAsync();
        return await load(actor, search);
    }
}