namespace Ubp.Core.Models;

public static class ReservationAdjustmentKinds
{
    public const string ToAdvance = "TO_ADVANCE";
    public const string Release = "RELEASE";
    public const string Extend = "EXTEND";
}

/// <summary>سطر من عرض الحجوزات: ما حُجز وما استُهلك وما بقِي غير مستخدم (الترحيل 0047).</summary>
public sealed class ReservationRow
{
    public Guid BookingId { get; set; }
    public Guid BranchId { get; set; }
    public string? BranchName { get; set; }
    public Guid CustomerId { get; set; }
    public string? CustomerCode { get; set; }
    public string BookingStatus { get; set; } = "";
    public string? BookingNo { get; set; }
    public DateTime BookingDate { get; set; }
    public string? BookingNotes { get; set; }
    public decimal DepositAmount { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public Guid BookingLineId { get; set; }
    public string CustomerName { get; set; } = "";
    public Guid ItemId { get; set; }
    public string ItemCode { get; set; } = "";
    public string ItemName { get; set; } = "";
    public Guid WarehouseId { get; set; }
    public string WarehouseName { get; set; } = "";
    public decimal BookedQty { get; set; }
    public decimal ReservedQty { get; set; }
    public decimal ConsumedQty { get; set; }
    public decimal SettledQty { get; set; }
    public decimal RemainingQty { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal RemainingValue { get; set; }
    public decimal PaidAmount { get; set; }
    /// <summary>المتبقي غير المحصل من قيمة الخدمة = قيمة الحجز − المسدد للخدمة.</summary>
    public decimal UncollectedValue { get; set; }
}

/// <summary>سطر تفصيل سداد لخدمة: مصدر الدفعة (إيصال/تسوية) وتاريخها والمبلغ المنسوب للخدمة.</summary>
public sealed class PaymentDetailRow
{
    public string Kind { get; set; } = "";
    public string? DocNo { get; set; }
    public DateTime Date { get; set; }
    public string? TreasuryName { get; set; }
    public decimal Amount { get; set; }
}

/// <summary>تفاصيل سداد خدمة: إجمالي القيمة والمسدد والإيصالات والتسويات.</summary>
public sealed class PaymentDetail
{
    public string? BookingNo { get; set; }
    public string? CustomerName { get; set; }
    public string? ItemName { get; set; }
    public decimal ServiceValue { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DueAmount => Math.Max(Math.Round(ServiceValue - PaidAmount, 2), 0);
    public IReadOnlyList<PaymentDetailRow> Rows { get; set; } = Array.Empty<PaymentDetailRow>();
}

/// <summary>تفاصيل الكمية المستهلكة من خدمة محجوزة موزعة على المصادر.</summary>
public sealed class ConsumptionDetail
{
    public Guid BookingLineId { get; set; }
    public decimal TotalConsumed { get; set; }
    public IReadOnlyList<ConsumptionSourceLine> Lines { get; set; } =
        Array.Empty<ConsumptionSourceLine>();
}

/// <summary>سطر مصدر استهلاك: تنفيذ / أرصدة افتتاحية / تحويل خدمات / تسويات.</summary>
public sealed class ConsumptionSourceLine
{
    public string Source { get; set; } = "";
    public decimal Quantity { get; set; }
    public int Documents { get; set; }
    public DateTime? FirstDate { get; set; }
    public DateTime? LastDate { get; set; }
    public string? Note { get; set; }
}
