using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Sales;

/// <summary>نافذة تفاصيل المسدد لخدمة: الإيصالات والتسويات التي سددت من قيمتها.</summary>
public partial class PaymentDetailDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter] public Guid BookingLineId { get; set; }
    [Inject] private ReservationService Reservations { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;

    private PaymentDetail? _detail;
    private bool _loading = true;

    protected override async Task OnInitializedAsync()
    {
        try
        {
            var actor = await UserContext.RequireAsync();
            _detail = await Reservations.GetPaymentDetailAsync(actor, BookingLineId);
        }
        catch (AppException) { _detail = null; }
        catch (Exception) { _detail = null; }
        finally { _loading = false; }
    }

    private void Close() => MudDialog.Close();
}