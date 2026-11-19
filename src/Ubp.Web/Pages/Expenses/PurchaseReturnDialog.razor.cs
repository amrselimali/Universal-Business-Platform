using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;
using TreasuryModel = Ubp.Core.Models.Treasury;

namespace Ubp.Web.Pages.Expenses;

public partial class PurchaseReturnDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter, EditorRequired] public Guid BranchId { get; set; }

    [Inject] private PurchaseReturnService Returns { get; set; } = default!;
    [Inject] private LookupService Lookup { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private MudForm _form = default!;
    private Partner? _supplier;
    private PurchaseReturnInvoiceOption? _invoice;
    private ExpenseDocOption? _selectedExpense;
    private List<ExpenseDocOption> _expenseDocs = new();
    private string _method = PurchaseReturnMethods.Supplier;
    private Guid? _treasuryId;
    private string? _notes;
    private DateTime? _date = DateTime.Today;
    private IReadOnlyList<TreasuryModel> _treasuries = Array.Empty<TreasuryModel>();
    private List<ReturnLineModel> _lines = new();
    private bool _busy;

    private string _sourceType = PurchaseReturnSourceTypes.OperatingExpense;
    private bool IsExpenseSource => _sourceType == PurchaseReturnSourceTypes.OperatingExpense;
    private bool HasSourceSelected => IsExpenseSource ? _selectedExpense is not null : _invoice is not null;

    private decimal Total => Math.Round(_lines.Sum(l => l.Amount), 2,
        MidpointRounding.AwayFromZero);

    private bool CanSave => !_busy && _supplier is not null && HasSourceSelected &&
                            _date is not null && Total > 0 &&
                            (_method != PurchaseReturnMethods.Cash || _treasuryId is not null);

    protected override async Task OnInitializedAsync()
    {
        var actor = await UserContext.RequireAsync();
        _treasuries = await Lookup.TreasuriesAsync(actor, BranchId);
        _treasuryId = _treasuries.FirstOrDefault()?.Id;
    }

    private async Task OnSourceTypeChanged(string sourceType)
    {
        _sourceType = sourceType;
        _invoice = null;
        _selectedExpense = null;
        _expenseDocs = new();
        _lines = new();

        if (IsExpenseSource && _supplier is not null)
            await LoadExpenseDocsAsync();
    }

    private async Task<IEnumerable<Partner>> SearchSuppliers(string? search, CancellationToken ct)
    {
        var actor = await UserContext.GetAsync();
        if (actor is null) return Array.Empty<Partner>();
        return await Lookup.PartnersAsync(actor, PartnerKind.Supplier, search, ct);
    }

    private async Task<IEnumerable<PurchaseReturnInvoiceOption>> SearchInvoices(string? search,
        CancellationToken ct)
    {
        if (_supplier is null) return Array.Empty<PurchaseReturnInvoiceOption>();
        var actor = await UserContext.GetAsync();
        if (actor is null) return Array.Empty<PurchaseReturnInvoiceOption>();
        return await Returns.ListInvoicesAsync(actor, BranchId, _supplier.Id, search, ct);
    }

    private async Task LoadExpenseDocsAsync()
    {
        if (_supplier is null)
        {
            _expenseDocs = new();
            return;
        }

        var actor = await UserContext.GetAsync();
        if (actor is null) return;

        var rawLines = await Returns.ListOperatingExpenseStockLinesAsync(
            actor, BranchId, null, CancellationToken.None);

        _expenseDocs = rawLines
            .Where(x => x.SupplierId == _supplier.Id && x.ReturnableQty > 0)
            .GroupBy(x => new { x.ExpenseId, x.ExpenseDocNo, x.ExpenseDocDate })
            .Select(g => new ExpenseDocOption
            {
                ExpenseId = g.Key.ExpenseId,
                DocNo = g.Key.ExpenseDocNo,
                DocDate = g.Key.ExpenseDocDate,
                Total = Math.Round(g.Sum(x => x.ReturnableQty * x.UnitPrice), 2,
                    MidpointRounding.AwayFromZero),
                Lines = g.Select(x => new ReturnLineModel
                {
                    OperatingExpenseLineId = x.Id,
                    ItemId = x.ItemId,
                    UnitId = x.UnitId,
                    WarehouseId = x.WarehouseId,
                    ItemCode = x.ItemCode,
                    ItemName = x.ItemName,
                    OriginalQty = x.OriginalQty,
                    ReturnedQty = x.ReturnedQty,
                    ReturnableQty = x.ReturnableQty,
                    UnitPrice = x.UnitPrice
                }).ToList()
            })
            .OrderByDescending(x => x.DocDate)
            .ToList();
    }

    private static string SupplierLabel(Partner? supplier) =>
        supplier is null ? "" : $"{supplier.Code} — {supplier.NameAr}";

    private static string InvoiceLabel(PurchaseReturnInvoiceOption? invoice) =>
        invoice is null ? "" :
        $"{invoice.DocNo} — {invoice.DocDate:yyyy-MM-dd} — {invoice.Total:N2}" +
        (invoice.Status == "draft" ? " (مسودة)" : "");

    private static string ExpenseDocLabel(ExpenseDocOption? doc) =>
        doc is null ? "" : $"{doc.DocNo} — {doc.DocDate:yyyy-MM-dd} — متاح: {doc.Total:N2}";

    private async Task OnSupplierChanged(Partner? supplier)
    {
        _supplier = supplier;
        _invoice = null;
        _selectedExpense = null;
        _expenseDocs = new();
        _lines = new();

        if (IsExpenseSource && _supplier is not null)
            await LoadExpenseDocsAsync();
    }

    private void OnInvoiceChanged(PurchaseReturnInvoiceOption? invoice)
    {
        _invoice = invoice;
        _lines = invoice?.Lines.Select(line => new ReturnLineModel
        {
            OriginalLineId = line.OriginalLineId,
            ItemId = line.ItemId,
            UnitId = line.UnitId,
            WarehouseId = line.WarehouseId,
            ItemCode = line.ItemCode,
            ItemName = line.ItemName,
            OriginalQty = line.Quantity,
            ReturnedQty = line.ReturnedQty,
            ReturnableQty = line.ReturnableQty,
            UnitPrice = line.UnitPrice
        }).ToList() ?? new();
    }

    private void OnExpenseDocChanged(ExpenseDocOption? doc)
    {
        _selectedExpense = doc;
        _lines = doc?.Lines.Select(line => new ReturnLineModel
        {
            OperatingExpenseLineId = line.OperatingExpenseLineId,
            ItemId = line.ItemId,
            UnitId = line.UnitId,
            WarehouseId = line.WarehouseId,
            ItemCode = line.ItemCode,
            ItemName = line.ItemName,
            OriginalQty = line.OriginalQty,
            ReturnedQty = line.ReturnedQty,
            ReturnableQty = line.ReturnableQty,
            UnitPrice = line.UnitPrice
        }).ToList() ?? new();
    }

    private void Cancel() => MudDialog.Cancel();

    private async Task SaveAsync()
    {
        await _form.Validate();
        if (!CanSave || _supplier is null)
        {
            Snackbar.Add(T.T("validation.required_fields"), Severity.Warning);
            return;
        }

        var lines = _lines.Where(line => line.Quantity > 0).ToList();
        if (lines.Count == 0)
        {
            Snackbar.Add(T.T("validation.document_has_no_lines"), Severity.Warning);
            return;
        }
        if (lines.Any(line => line.Quantity > line.ReturnableQty))
        {
            Snackbar.Add(T.T("validation.return_quantity_exceeds"), Severity.Warning);
            return;
        }

        _busy = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            await Returns.CreateAsync(actor, new PurchaseReturnInput
            {
                BranchId = BranchId,
                DocDate = _date!.Value.Date,
                SupplierId = _supplier.Id,
                SourceType = _sourceType,
                OriginalDocumentId = IsExpenseSource ? null : _invoice?.Id,
                OperatingExpenseId = IsExpenseSource ? _selectedExpense?.ExpenseId : null,
                ReturnMethod = _method,
                TreasuryId = _method == PurchaseReturnMethods.Cash ? _treasuryId : null,
                Notes = _notes,
                Lines = lines.Select(line => new PurchaseReturnLineInput
                {
                    OriginalLineId = line.OriginalLineId,
                    OperatingExpenseLineId = line.OperatingExpenseLineId,
                    ItemId = line.ItemId,
                    UnitId = line.UnitId,
                    WarehouseId = line.WarehouseId,
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    SourceType = _sourceType
                }).ToList()
            });
            MudDialog.Close(DialogResult.Ok(true));
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        finally { _busy = false; }
    }

    private sealed class ExpenseDocOption
    {
        public Guid ExpenseId { get; set; }
        public string? DocNo { get; set; }
        public DateTime DocDate { get; set; }
        public decimal Total { get; set; }
        public List<ReturnLineModel> Lines { get; set; } = new();
    }

    private sealed class ReturnLineModel
    {
        public Guid OriginalLineId { get; set; }
        public Guid? OperatingExpenseLineId { get; set; }
        public Guid ItemId { get; set; }
        public Guid UnitId { get; set; }
        public Guid WarehouseId { get; set; }
        public string? ItemCode { get; set; }
        public string? ItemName { get; set; }
        public decimal OriginalQty { get; set; }
        public decimal ReturnedQty { get; set; }
        public decimal ReturnableQty { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Amount => Math.Round(Quantity * UnitPrice, 2,
            MidpointRounding.AwayFromZero);
    }
}