using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;
using TreasuryModel = Ubp.Core.Models.Treasury;

namespace Ubp.Web.Pages.Sales;

/// <summary>
/// تسوية حساب عميل: يعرض الخدمات ذات الكمية المتبقية، ويحسب المستحق من سعر الوحدة
/// خارج العرض والكمية المستهلكة ناقص المسدد، ثم ينشئ إيصال تسوية مسودة وقيدًا مسودة.
/// </summary>
public partial class BookingSettlementDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter, EditorRequired] public Guid BranchId { get; set; }
    [Parameter, EditorRequired] public Guid CustomerId { get; set; }
    [Inject] private BookingSettlementService Settlements { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private IDialogService DialogService { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private BookingSettlementSheet? _sheet;
    private IReadOnlyList<TreasuryModel> _treasuries = Array.Empty<TreasuryModel>();
    private IReadOnlyList<ItemOption> _services = Array.Empty<ItemOption>();
    private List<SettlementRow> _rows = new();
    private Guid _treasuryId;
    private string _settlementType = BookingSettlementTypes.Refund;
    private Guid _newItemId;
    private decimal _newQty = 1;
    private decimal _newPrice;
    private string? _newNotes;
    private string? _notes;
    private bool _loading = true;
    private bool _busy;

    private bool CannotSettle => _busy || _loading || SelectedCount == 0 ||
                                 SelectedTotal <= 0 ||
                                 (_settlementType == BookingSettlementTypes.Refund &&
                                  _treasuryId == Guid.Empty) ||
                                 (_settlementType == BookingSettlementTypes.NewBooking &&
                                  (_newItemId == Guid.Empty || _newQty <= 0 || _newPrice < 0));

    private int SelectedCount => _rows.Count(r => r.Selected);
    private decimal SelectedTotal => Math.Round(_rows.Where(r => r.Selected).Sum(r => r.Due), 2,
        MidpointRounding.AwayFromZero);

    protected override async Task OnInitializedAsync()
    {
        try
        {
            var actor = await UserContext.RequireAsync();
            _sheet = await Settlements.GetSheetAsync(actor, BranchId, CustomerId);
            if (_sheet is not null)
            {
                _treasuries = await Settlements.ListTreasuriesAsync(actor, BranchId);
                _services = await Settlements.ListServicesAsync(actor);
                _treasuryId = _treasuries.FirstOrDefault()?.Id ?? Guid.Empty;
                _newItemId = _services.FirstOrDefault()?.Id ?? Guid.Empty;
                _newPrice = _services.FirstOrDefault()?.DefaultPrice ?? 0;
                _rows = _sheet.Lines.Select(line => new SettlementRow
                {
                    BookingId = line.BookingId, BookingLineId = line.BookingLineId,
                    BookingDate = line.BookingDate, ItemCode = line.ItemCode,
                    ItemName = line.ItemName, BookedQty = line.BookedQty,
                    ConsumedQty = line.ConsumedQty, RemainingQty = line.RemainingQty,
                    ServiceValue = line.BookedQty * line.UnitPrice,
                    DueBefore = line.RemainingValue,
                    PaidAmount = line.PaidAmount, ExternalUnitPrice = line.UnitPrice
                }).ToList();
            }
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        catch (Exception) { Snackbar.Add(T.T("error.generic"), Severity.Error); }
        finally { _loading = false; }
    }

    private void OnTreasuryChanged(Guid value) => _treasuryId = value;

    private void OnSettlementTypeChanged(string value)
    {
        _settlementType = value == BookingSettlementTypes.NewBooking
            ? BookingSettlementTypes.NewBooking : BookingSettlementTypes.Refund;
        StateHasChanged();
    }

    private void OnNewItemChanged(Guid itemId)
    {
        _newItemId = itemId;
        _newPrice = _services.FirstOrDefault(s => s.Id == itemId)?.DefaultPrice ?? 0;
        StateHasChanged();
    }

    private void Toggle(SettlementRow row, bool value)
    {
        row.Selected = value;
        StateHasChanged();
    }

    private void SetExternalPrice(SettlementRow row, decimal value)
    {
        row.ExternalUnitPrice = Math.Max(value, 0);
        StateHasChanged();
    }

    private void Cancel() => MudDialog.Cancel();

    private async Task SettleAsync()
    {
        if (_busy || _sheet is null) return;
        if (_settlementType == BookingSettlementTypes.Refund && _treasuryId == Guid.Empty)
        {
            Snackbar.Add(T.T("validation.treasury_not_found"), Severity.Warning);
            return;
        }
        if (_settlementType == BookingSettlementTypes.NewBooking &&
            (_newItemId == Guid.Empty || _newQty <= 0 || _newPrice < 0))
        {
            Snackbar.Add(T.T("settlement.select_service"), Severity.Warning);
            return;
        }
        var selected = _rows.Where(r => r.Selected).ToList();
        if (selected.Count == 0 || selected.Sum(r => r.Due) <= 0)
        {
            Snackbar.Add(T.T("validation.settlement_total_required"), Severity.Warning);
            return;
        }

        var confirmed = await DialogService.ShowMessageBoxAsync(T.T("settlement.settle"),
            T.T(_settlementType == BookingSettlementTypes.NewBooking
                ? "settlement.new_booking_confirm" : "settlement.confirm"),
            yesText: T.T("settlement.settle"), cancelText: T.T("common.cancel"));
        if (confirmed != true) return;

        _busy = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            var service = _services.FirstOrDefault(s => s.Id == _newItemId);
            var result = await Settlements.SettleAsync(actor, new BookingSettlementInput
            {
                BranchId = BranchId, CustomerId = CustomerId,
                TreasuryId = _settlementType == BookingSettlementTypes.Refund
                    ? _treasuryId : Guid.Empty,
                SettlementType = _settlementType,
                NewBookingItemId = _settlementType == BookingSettlementTypes.NewBooking
                    ? _newItemId : Guid.Empty,
                NewBookingUnitId = service?.BaseUnitId ?? Guid.Empty,
                NewBookingQuantity = _newQty,
                NewBookingUnitPrice = _newPrice,
                NewBookingNotes = _newNotes,
                DocDate = DateTime.Today, Notes = _notes,
                Lines = selected.Select(row => new BookingSettlementLineInput
                {
                    BookingId = row.BookingId, BookingLineId = row.BookingLineId,
                    ExternalUnitPrice = row.ExternalUnitPrice
                }).ToList()
            });
            Snackbar.Add(T.T(_settlementType == BookingSettlementTypes.NewBooking
                ? "settlement.new_booking_created" : "settlement.created"), Severity.Success);
            MudDialog.Close(DialogResult.Ok(result));
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        catch (Exception) { Snackbar.Add(T.T("error.generic"), Severity.Error); }
        finally { _busy = false; }
    }

    private sealed class SettlementRow
    {
        public Guid BookingId { get; set; }
        public Guid BookingLineId { get; set; }
        public DateTime BookingDate { get; set; }
        public string ItemCode { get; set; } = "";
        public string ItemName { get; set; } = "";
        public decimal BookedQty { get; set; }
        public decimal ConsumedQty { get; set; }
        public decimal RemainingQty { get; set; }
        public decimal ServiceValue { get; set; }
        public decimal DueBefore { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal ExternalUnitPrice { get; set; }
        public bool Selected { get; set; }
        public decimal Due => Math.Round(ExternalUnitPrice * ConsumedQty - PaidAmount, 2,
            MidpointRounding.AwayFromZero);
    }
}
