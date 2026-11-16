using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Inventory;

/// <summary>عرض قراءة فقط لبيانات جرد محفوظ: الدفترية والفعلية والفرق والملاحظات.</summary>
public partial class StocktakeViewDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter] public Guid Id { get; set; }
    [Parameter] public string Code { get; set; } = "";
    [Inject] private StocktakeSettlementService Settlements { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;

    private StocktakeDetail? _detail;
    private string? _error;
    private bool _loading = true;

    private string DisplayCode =>
        !string.IsNullOrWhiteSpace(Code) ? Code : _detail?.Header.Code ?? "";

    protected override async Task OnInitializedAsync()
    {
        try
        {
            var actor = await UserContext.RequireAsync();
            _detail = await Settlements.GetDetailAsync(actor, Id);
        }
        catch (AppException ex)
        {
            _error = T.T(ex.Code);
        }
        catch (Exception)
        {
            _error = T.T("error.generic");
        }
        finally
        {
            _loading = false;
        }
    }

    private static string DifferenceStyle(decimal difference) =>
        difference > 0
            ? "color:#047857;font-weight:700"
            : difference < 0
                ? "color:#B91C1C;font-weight:700"
                : string.Empty;

    private void Close() => MudDialog.Close();
}
