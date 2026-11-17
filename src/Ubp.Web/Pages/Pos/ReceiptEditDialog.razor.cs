using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Web.Services;
using TreasuryModel = Ubp.Core.Models.Treasury;

namespace Ubp.Web.Pages.Pos;

public partial class ReceiptEditDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter, EditorRequired] public Guid VoucherId { get; set; }

    [Inject] private PosService Pos { get; set; } = default!;
    [Inject] private LookupService Lookup { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private MudForm _form = default!;
    private Voucher? _original;
    private Partner? _customer;
    private IReadOnlyList<TreasuryModel> _treasuries = Array.Empty<TreasuryModel>();
    private IReadOnlyList<TreasuryMethod> _methods = Array.Empty<TreasuryMethod>();
    private Guid? _treasuryId;
    private Guid _methodId;
    private decimal _amount;
    private decimal _fee;
    private string? _notes;
    private bool _busy;
    private bool _loading = true;

    private decimal Net => Math.Round(_amount - _fee, 2, MidpointRounding.AwayFromZero);

    protected override async Task OnInitializedAsync()
    {
        try
        {
            var actor = await UserContext.RequireAsync();
            _original = await Pos.GetReceiptAsync(actor, VoucherId);
            _treasuries = await Lookup.TreasuriesAsync(actor, _original.BranchId);
            _methods = await Lookup.TreasuryMethodsAsync(actor, _original.BranchId);
            _treasuryId = _original.TreasuryId;
            _methodId = _original.Lines.FirstOrDefault()?.TreasuryMethodId ?? _methods.FirstOrDefault()?.Id ?? Guid.Empty;
            _amount = _original.TotalAmount;
            _fee = _original.FeeTotal;
            _notes = _original.Notes;
            _customer = (await Lookup.PartnersAsync(actor, PartnerKind.Customer,
                _original.PartyName, ct: default, branchId: _original.BranchId))
                .FirstOrDefault(c => c.Id == _original.PartyId);
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        finally { _loading = false; }
    }

    private async Task<IEnumerable<Partner>> SearchCustomers(string? search, CancellationToken ct)
    {
        var actor = await UserContext.GetAsync();
        if (actor is null || _original is null) return Array.Empty<Partner>();
        return await Lookup.PartnersAsync(actor, PartnerKind.Customer, search, ct,
            _original.BranchId);
    }

    private static string CustomerLabel(Partner? partner) =>
        partner is null ? "" : $"{partner.Code} — {partner.NameAr}";

    private async Task<IEnumerable<TreasuryMethod>> SearchMethods(string? search,
        CancellationToken ct)
    {
        var actor = await UserContext.GetAsync();
        if (actor is null || _original is null) return Array.Empty<TreasuryMethod>();
        var methods = await Lookup.TreasuryMethodsAsync(actor, _original.BranchId);
        return string.IsNullOrWhiteSpace(search)
            ? methods.Where(m => m.TreasuryId == _treasuryId).ToList()
            : methods.Where(m => m.TreasuryId == _treasuryId &&
                                 (m.NameAr.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                  m.Code.Contains(search, StringComparison.OrdinalIgnoreCase)));
    }

    private async Task OnTreasuryChanged(Guid? value)
    {
        _treasuryId = value;
        var actor = await UserContext.GetAsync();
        if (actor is null) return;
        _methods = await Lookup.TreasuryMethodsAsync(actor, _original!.BranchId);
        _methodId = _methods.FirstOrDefault(m => m.TreasuryId == _treasuryId)?.Id ?? Guid.Empty;
    }

    private void Cancel() => MudDialog.Cancel();

    private async Task SaveAsync()
    {
        await _form.Validate();
        if (_customer is null || _treasuryId is null || _methodId == Guid.Empty ||
            _amount <= 0 || _fee < 0 || _fee >= _amount)
        {
            Snackbar.Add(T.T("validation.required_fields"), Severity.Warning);
            return;
        }
        _busy = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            await Pos.EditReceiptAsync(actor, new ReceiptEditInput
            {
                VoucherId = VoucherId, CustomerId = _customer.Id,
                TreasuryId = _treasuryId.Value, TreasuryMethodId = _methodId,
                Amount = _amount, FeeAmount = _fee, Notes = _notes
            });
            MudDialog.Close(DialogResult.Ok(true));
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        finally { _busy = false; }
    }
}
