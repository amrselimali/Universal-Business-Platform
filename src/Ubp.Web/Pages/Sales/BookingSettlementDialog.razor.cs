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
    private Guid _cashTreasuryId;
    private string _settlementType = BookingSettlementTypes.Refund;
    private List<NewOfferRow> _newOffers = new();
    private string? _notes;
    private bool _loading = true;
    private bool _busy;

    private bool CannotSettle => _busy || _loading || SelectedCount == 0 ||
                                 SelectedTotal <= 0 ||
                                 (_settlementType == BookingSettlementTypes.Refund &&
                                  _treasuryId == Guid.Empty) ||
                                 (_settlementType == BookingSettlementTypes.NewBooking &&
                                  (_newOffers.Count == 0 || _newOffers.Any(o =>
                                      o.Service is null || o.Quantity <= 0 || o.UnitPrice < 0) ||
                                   (CashDifference != 0 && _cashTreasuryId == Guid.Empty)));

    private int SelectedCount => _rows.Count(r => r.Selected);
    private decimal SelectedTotal => Math.Round(_rows.Where(r => r.Selected).Sum(r => r.Due), 2,
        MidpointRounding.AwayFromZero);
    private decimal NewServicesTotal => Math.Round(
        _newOffers.Sum(o => o.Quantity * o.UnitPrice), 2, MidpointRounding.AwayFromZero);
    private decimal CashDifference => Math.Round(NewServicesTotal - SelectedTotal, 2,
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
                _cashTreasuryId = _treasuryId;
                _newOffers = new List<NewOfferRow> { NewOffer() };
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

    private void OnNewItemChanged(NewOfferRow row, ItemOption? service)
    {
        row.Service = service;
        row.UnitPrice = service?.DefaultPrice ?? 0;
        StateHasChanged();
    }

    private Task<IEnumerable<ItemOption>> SearchServices(string? search,
        CancellationToken ct) =>
        Task.FromResult(_services.Where(s =>
            string.IsNullOrWhiteSpace(search) ||
            s.Code.Contains(search, StringComparison.OrdinalIgnoreCase) ||
            s.NameAr.Contains(search, StringComparison.OrdinalIgnoreCase)));

    private string TreasuryLabel(Guid id)
    {
        var treasury = _treasuries.FirstOrDefault(t => t.Id == id);
        return treasury is null ? "—" : $"{treasury.Code} — {treasury.NameAr}";
    }

    private static string ServiceLabel(ItemOption? service) =>
        service is null ? "" : $"{service.Code} — {service.NameAr}";

    private NewOfferRow NewOffer() => new() { Quantity = 1 };

    private void AddOffer()
    {
        _newOffers.Add(NewOffer());
        StateHasChanged();
    }

    private void RemoveOffer(NewOfferRow row)
    {
        if (_newOffers.Count > 1) _newOffers.Remove(row);
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
            (_newOffers.Count == 0 || _newOffers.Any(o => o.Service is null ||
                                                          o.Quantity <= 0 || o.UnitPrice < 0)))
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
            var result = await Settlements.SettleAsync(actor, new BookingSettlementInput
            {
                BranchId = BranchId, CustomerId = CustomerId,
                TreasuryId = _settlementType == BookingSettlementTypes.Refund
                    ? _treasuryId : _cashTreasuryId,
                SettlementType = _settlementType,
                NewBookingLines = _settlementType == BookingSettlementTypes.NewBooking
                    ? _newOffers.Select(o => new NewBookingLineInput
                    {
                        ItemId = o.Service!.Id,
                        UnitId = o.Service.BaseUnitId,
                        Quantity = o.Quantity, UnitPrice = o.UnitPrice, Notes = o.Notes
                    }).ToList()
                    : new List<NewBookingLineInput>(),
                NewBookingNotes = _newOffers.FirstOrDefault()?.Notes,
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

    private sealed class NewOfferRow
    {
        public ItemOption? Service { get; set; }
        public decimal Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public string? Notes { get; set; }
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
        public decimal Due => Math.Round(PaidAmount - ExternalUnitPrice * ConsumedQty, 2,
            MidpointRounding.AwayFromZero);
    }
}
