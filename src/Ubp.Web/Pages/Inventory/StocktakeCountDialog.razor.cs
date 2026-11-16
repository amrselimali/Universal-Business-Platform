using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Inventory;

/// <summary>
/// شاشة إدخال الجرد: كود الصنف واسمه والكمية الفعلية والملاحظات ثم حفظ.
/// تُستخدم لجرد جديد (تُنشئ الجلسة عند الحفظ) ولجرد مسودة قائم.
/// الرصيد الدفتري يُحمَّل داخليًا لحساب الفروق والتحقق من الملاحظات دون عرضه.
/// </summary>
public partial class StocktakeCountDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter] public Guid Id { get; set; }
    [Parameter] public string Code { get; set; } = "";
    [Inject] private StocktakeService Stocktakes { get; set; } = default!;
    [Inject] private BranchService Branches { get; set; } = default!;
    [Inject] private WarehouseService Warehouses { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private IReadOnlyList<Branch> _branches = Array.Empty<Branch>();
    private IReadOnlyList<Warehouse> _warehouses = Array.Empty<Warehouse>();
    private StocktakeDetail? _detail;
    private List<EntryRow> _rows = new();
    private readonly HashSet<Guid> _missingNotes = new();
    private Guid _branchId;
    private Guid _warehouseId;
    private bool _loading;
    private bool _busy;
    private int _loadVersion;

    private bool IsNew => Id == Guid.Empty;
    private string TitleText => IsNew
        ? T.T("stocktake.add")
        : $"{T.T("stocktake.count")} — {Code}";

    protected override async Task OnInitializedAsync()
    {
        var actor = await UserContext.RequireAsync();
        if (IsNew)
        {
            _branches = await Branches.OptionsAsync(actor);
            _warehouses = await Warehouses.OptionsAsync(actor);
            _branchId = actor.CurrentBranchId ?? _branches.FirstOrDefault()?.Id ?? Guid.Empty;
            _warehouseId = _warehouses.FirstOrDefault(w => w.BranchIds.Contains(_branchId))?.Id
                           ?? Guid.Empty;
            await LoadSheetAsync(actor);
            return;
        }

        _detail = await Stocktakes.GetDetailAsync(actor, Id);
        Code = _detail.Header.Code;
        _branchId = _detail.Header.BranchId;
        _warehouseId = _detail.Header.WarehouseId;
        _rows = _detail.Lines.Select(line => new EntryRow
        {
            ItemId = line.ItemId,
            Code = line.ItemCode ?? "",
            Name = line.ItemName ?? "",
            BookQty = line.BookQty,
            UnitCost = line.UnitCost,
            CountedQty = line.CountedQty,
            Notes = line.Reason
        }).ToList();
    }

    private async Task OnBranchChangedAsync(Guid branchId)
    {
        _branchId = branchId;
        if (!_warehouses.Any(w => w.Id == _warehouseId && w.BranchIds.Contains(branchId)))
            _warehouseId = _warehouses.FirstOrDefault(w => w.BranchIds.Contains(branchId))?.Id
                           ?? Guid.Empty;
        await LoadSheetAsync();
    }

    private Task OnWarehouseChangedAsync(Guid warehouseId)
    {
        _warehouseId = warehouseId;
        return LoadSheetAsync();
    }

    private async Task LoadSheetAsync(ActorContext? actor = null)
    {
        if (!IsNew) return;
        var version = ++_loadVersion;
        _missingNotes.Clear();
        if (_branchId == Guid.Empty || _warehouseId == Guid.Empty)
        {
            _rows = new List<EntryRow>();
            _loading = false;
            return;
        }

        _loading = true;
        try
        {
            actor ??= await UserContext.RequireAsync();
            var sheet = await Stocktakes.GetCountSheetAsync(actor, _branchId, _warehouseId);
            if (version != _loadVersion) return;
            _rows = sheet.Select(row => new EntryRow
            {
                ItemId = row.ItemId,
                Code = row.ItemCode,
                Name = row.ItemName,
                BookQty = row.BookQty,
                UnitCost = row.UnitCost,
                CountedQty = row.BookQty,
                Notes = null
            }).ToList();
        }
        catch (AppException ex)
        {
            if (version == _loadVersion) Snackbar.Add(T.T(ex.Code), Severity.Error);
        }
        finally
        {
            if (version == _loadVersion) _loading = false;
        }
    }

    private void SetCounted(EntryRow row, decimal value)
    {
        row.CountedQty = value;
        row.Touched = true;
        if (value == row.BookQty || !string.IsNullOrWhiteSpace(row.Notes))
            _missingNotes.Remove(row.ItemId);
    }

    private void SetNotes(EntryRow row, string? value)
    {
        row.Notes = value;
        if (!string.IsNullOrWhiteSpace(value)) _missingNotes.Remove(row.ItemId);
    }

    private void Cancel() => MudDialog.Cancel();

    private async Task SaveAsync()
    {
        if (_busy) return;
        if (IsNew && (_branchId == Guid.Empty || _warehouseId == Guid.Empty))
        {
            Snackbar.Add(T.T("validation.warehouse_required"), Severity.Warning);
            return;
        }

        _missingNotes.Clear();
        var missing = _rows
            .Where(row => row.CountedQty != row.BookQty && string.IsNullOrWhiteSpace(row.Notes))
            .ToList();
        if (missing.Count > 0)
        {
            foreach (var row in missing) _missingNotes.Add(row.ItemId);
            Snackbar.Add(string.Format(T.T("stocktake.notes_missing"),
                string.Join(", ", missing.Take(5).Select(row => row.Code))), Severity.Warning);
            return;
        }

        _busy = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            if (IsNew)
            {
                var created = await Stocktakes.CreateAsync(actor, new StocktakeInput
                {
                    BranchId = _branchId,
                    WarehouseId = _warehouseId
                });
                var entered = _rows.ToDictionary(row => row.ItemId);
                var inputs = created.Lines.Select(line =>
                {
                    entered.TryGetValue(line.ItemId, out var row);
                    return new StocktakeLineInput
                    {
                        ItemId = line.ItemId,
                        CountedQty = row is { Touched: true } ? row.CountedQty : line.CountedQty,
                        UnitCost = line.UnitCost,
                        Reason = Clean(row?.Notes)
                    };
                }).ToList();
                await Stocktakes.UpdateLinesAsync(actor, created.Header.Id, inputs);
            }
            else
            {
                var inputs = _rows.Select(row => new StocktakeLineInput
                {
                    ItemId = row.ItemId,
                    CountedQty = row.CountedQty,
                    UnitCost = row.UnitCost,
                    Reason = Clean(row.Notes)
                }).ToList();
                await Stocktakes.UpdateLinesAsync(actor, Id, inputs);
            }
            MudDialog.Close(DialogResult.Ok(true));
        }
        catch (AppException ex)
        {
            Snackbar.Add(T.T(ex.Code), Severity.Error);
        }
        catch (Exception)
        {
            Snackbar.Add(T.T("error.generic"), Severity.Error);
        }
        finally
        {
            _busy = false;
        }
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed class EntryRow
    {
        public Guid ItemId { get; set; }
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public decimal BookQty { get; set; }
        public decimal UnitCost { get; set; }
        public decimal CountedQty { get; set; }
        public bool Touched { get; set; }
        public string? Notes { get; set; }
    }
}
