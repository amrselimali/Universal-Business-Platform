using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Partners;

public partial class PartnerOpeningBalancesDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter, EditorRequired] public Partner Customer { get; set; } = default!;
    [Inject] private PartnerService Partners { get; set; } = default!;
    [Inject] private LookupService Lookup { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private readonly List<Row> _rows = new();
    private decimal _oldTotal;
    private decimal _oldPaid;
    private bool _loading = true;
    private bool _busy;

    private decimal CurrentTotal => _rows.Sum(r => r.Total);
    private decimal CurrentPaid => _rows.Sum(r => r.PaidAmount);
    private decimal ValueDifference => CurrentTotal - _oldTotal;
    private decimal CashDifference => CurrentPaid - _oldPaid;

    private static decimal Round2(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>
    /// عرض المبلغ/الفرق بكامل علاماته العشرية **دون أي تقريب** (خلية الفرق)،
    /// حتى يظهر الفرق الحقيقي مهما كان عدد الكسور في سعر الوحدة أو المسدد.
    /// </summary>
    private static string Money(decimal value) =>
        value.ToString("0.###############################",
            System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>صف قابل للتعديل أو مقفل بسبب استخدامه (تنفيذ/تحصيل/تحويل/تسوية).</summary>
    private sealed class Row
    {
        public Guid? BookingLineId { get; init; }
        public string? DocNo { get; init; }
        public string? ServiceCode { get; init; }
        public string? ServiceName { get; init; }
        public bool IsLocked { get; init; }
        public string? LockReasonKey { get; init; }
        public bool CanEditPaid { get; init; } = true;
        public decimal MaxPaidAmount { get; init; }
        public ItemOption? Service { get; set; }
        public decimal Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal Total => Math.Round(Quantity * UnitPrice, 2, MidpointRounding.AwayFromZero);
        public decimal Remaining => Math.Max(Total - PaidAmount, 0);
        /// <summary>أقصى مسدد مسموح للصف: قيمة الخدمة، أو قيمتها ناقص الإيصالات للبند المقفل.</summary>
        public decimal MaxPaid => IsLocked
            ? MaxPaidAmount
            : Total > 0 ? Total : decimal.MaxValue;
    }

    protected override async Task OnInitializedAsync()
    {
        try
        {
            var actor = await UserContext.RequireAsync();
            var lines = await Partners.ListOpeningBalancesAsync(actor, PartnerKind.Customer,
                Customer.Id);
            foreach (var line in lines)
            {
                _rows.Add(new Row
                {
                    BookingLineId = line.BookingLineId, DocNo = line.DocNo,
                    ServiceCode = line.ServiceCode, ServiceName = line.ServiceName,
                    IsLocked = !line.IsEditable, LockReasonKey = line.LockReasonKey,
                    CanEditPaid = line.CanEditPaid, MaxPaidAmount = line.MaxPaidAmount,
                    Service = new ItemOption
                    {
                        Id = line.ServiceId, Code = line.ServiceCode, NameAr = line.ServiceName,
                        ItemType = "SERVICE", DefaultPrice = line.UnitPrice
                    },
                    Quantity = line.Quantity, UnitPrice = line.UnitPrice,
                    PaidAmount = line.PaidAmount
                });
            }
            _oldTotal = lines.Sum(l => l.TotalAmount);
            _oldPaid = lines.Sum(l => l.PaidAmount);
        }
        catch (AppException ex)
        {
            Snackbar.Add(T.T(ex.Code), Severity.Error);
            MudDialog.Cancel();
        }
        finally { _loading = false; }
    }

    /// <summary>سطر جديد: المسدد مفتوح افتراضيًا (المسدد متاح دائمًا في التعديل).</summary>
    private void AddRow() => _rows.Add(new Row { Quantity = 1, CanEditPaid = true });

    private void RemoveRow(Row row)
    {
        if (row.IsLocked) return;
        _rows.Remove(row);
    }

    private void OnServiceChanged(Row row, ItemOption? service)
    {
        var previousId = row.Service?.Id;
        row.Service = service;
        if (service is not null && service.Id != previousId)
            row.UnitPrice = service.DefaultPrice;
    }

    private async Task<IEnumerable<ItemOption>> SearchServices(string? search, CancellationToken ct)
    {
        var actor = await UserContext.RequireAsync();
        return await Lookup.ServiceItemsAsync(actor, search, 100, ct: ct);
    }

    private string ServiceLabel(ItemOption? service) => service is null ? "" :
        T.Language == "en" && !string.IsNullOrWhiteSpace(service.NameEn)
            ? $"{service.Code} — {service.NameEn}"
            : $"{service.Code} — {service.NameAr}";

    private void Cancel() => MudDialog.Cancel();

    /// <summary>
    /// الحفظ يرسل البنود القابلة للتعديل والجديدة فقط؛ البنود المقفلة تبقى كما هي
    /// على الخادم. الحذف = عدم إرسال بند قابل للتعديل.
    /// </summary>
    private async Task SaveAsync()
    {
        var inputs = new List<PartnerOpeningBalanceEditLine>();
        var index = 0;
        foreach (var row in _rows.Where(r => !r.IsLocked || r.CanEditPaid))
        {
            index++;
            var prefix = $"{T.T("partners.opening_balance_row")} {index}";
            if (row.Service is null)
            {
                Snackbar.Add($"{prefix}: {T.T("validation.required_fields")}", Severity.Warning);
                return;
            }
            if (row.IsLocked)
            {
                // بند مستخدم: يُرسل المسدد فقط، وبحد أقصى قيمة الخدمة ناقص الإيصالات.
                // المقارنة بدقة قرشين حتى لا تمنع كسور سعر الوحدة إدخال قيمة الإجمالي الظاهرة.
                if (row.PaidAmount < 0 || Round2(row.PaidAmount) > Round2(row.MaxPaid))
                {
                    Snackbar.Add($"{prefix}: {T.T("validation.paid_exceeds_total")}",
                        Severity.Warning);
                    return;
                }
            }
            else
            {
                var error = PartnerOpeningBalanceRules.ValidateLine(row.Quantity, row.UnitPrice,
                    row.PaidAmount);
                if (error is not null)
                {
                    Snackbar.Add($"{prefix}: {T.T(error)}", Severity.Warning);
                    return;
                }
            }
            inputs.Add(new PartnerOpeningBalanceEditLine
            {
                BookingLineId = row.BookingLineId, ServiceId = row.Service.Id,
                Quantity = row.Quantity, UnitPrice = row.UnitPrice,
                PaidAmount = row.PaidAmount
            });
        }

        _busy = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            var result = await Partners.UpdateOpeningBalancesAsync(actor, PartnerKind.Customer,
                Customer.Id, inputs);
            Snackbar.Add(T.T("opening_balances.saved", result.Added, result.Updated,
                result.Removed, result.ValueDifference, result.CashDifference), Severity.Success);
            MudDialog.Close(DialogResult.Ok(result));
        }
        catch (AppException ex) { Snackbar.Add(T.T(ex.Code), Severity.Error); }
        finally { _busy = false; }
    }
}
