using Microsoft.AspNetCore.Components;
using Ubp.Core.Models;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Pos;

/// <summary>سطر مبسّط لعرض إيصال نقطة البيع النهائي (بلا ارتباط بنموذج السلة الداخلي).</summary>
public sealed record PosReceiptLine(string Name, decimal Qty, decimal Total);

/// <summary>لوحة الإيصال النهائي بعد إتمام البيع — عرض وطباعة فقط.</summary>
public partial class PosFinalReceipt
{
    [Parameter, EditorRequired] public PosReceipt? Receipt { get; set; }
    [Parameter] public IReadOnlyList<PosReceiptLine> Lines { get; set; } = Array.Empty<PosReceiptLine>();
    [Parameter] public string? CustomerName { get; set; }
    [Parameter] public string ReceiptNo { get; set; } = "";
    /// <summary>
    /// يظهر تاريخ انتهاء الصلاحية فقط عند وجود سطر محجوز واحد على الأقل (يُنفَّذ لاحقًا)؛
    /// البيع المباشر بالكامل يُطبع بلا صلاحية وبلا ملاحظة تنفيذ.
    /// </summary>
    [Parameter] public bool ShowExpiryDate { get; set; }
    [Parameter] public decimal Net { get; set; }
    [Parameter] public string? WhatsAppUrl { get; set; }
    [Parameter] public EventCallback OnPrint { get; set; }

    [Inject] private UiCulture T { get; set; } = default!;

    private Task PrintAsync() => OnPrint.InvokeAsync();
}