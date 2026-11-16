namespace Ubp.Core.Models;

/// <summary>بيانات عميل شاشة تسوية حساب الخدمات المحجوزة.</summary>
public sealed class BookingSettlementSheet
{
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerCode { get; set; } = "";
    public string? CustomerPhone { get; set; }
    public Guid BranchId { get; set; }
    public string? BranchName { get; set; }
    /// <summary>رقم آخر حجز/الكود الورقي المعروض أعلى شاشة التسوية.</summary>
    public string? PaperCode { get; set; }
    public List<BookingSettlementSheetRow> Lines { get; set; } = new();
}

/// <summary>سطر خدمة محجوزة قابلة للتسوية: له كمية متبقية أكبر من صفر.</summary>
public sealed class BookingSettlementSheetRow
{
    public Guid BookingId { get; set; }
    public Guid BookingLineId { get; set; }
    public Guid ItemId { get; set; }
    public string? BookingNo { get; set; }
    public DateTime BookingDate { get; set; }
    public string ItemCode { get; set; } = "";
    public string ItemName { get; set; } = "";
    public decimal BookedQty { get; set; }
    public decimal ConsumedQty { get; set; }
    public decimal RemainingQty { get; set; }
    public decimal UnitPrice { get; set; }
    /// <summary>الجزء المنسوب لهذا السطر من المدفوع/الدفعة المقدمة للحجز.</summary>
    public decimal PaidAmount { get; set; }
    public decimal RemainingValue { get; set; }
}

public sealed class BookingSettlementLineInput
{
    public Guid BookingId { get; set; }
    public Guid BookingLineId { get; set; }
    /// <summary>سعر الوحدة خارج العرض — يُدخل يدويًا في شاشة التسوية.</summary>
    public decimal ExternalUnitPrice { get; set; }
}

public sealed class BookingSettlementInput
{
    public Guid BranchId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid TreasuryId { get; set; }
    /// <summary>refund = استرداد من خزينة، new_booking = حجز عرض جديد بالقيمة المستحقة.</summary>
    public string SettlementType { get; set; } = BookingSettlementTypes.Refund;
    public Guid NewBookingItemId { get; set; }
    public Guid NewBookingUnitId { get; set; }
    public decimal NewBookingQuantity { get; set; }
    public decimal NewBookingUnitPrice { get; set; }
    public string? NewBookingNotes { get; set; }
    /// <summary>سطور عروض متعددة في الحجز الجديد — 0105.</summary>
    public List<NewBookingLineInput> NewBookingLines { get; set; } = new();
    public DateTime DocDate { get; set; } = DateTime.Today;
    public string? Notes { get; set; }
    public List<BookingSettlementLineInput> Lines { get; set; } = new();
}

public sealed class NewBookingLineInput
{
    public Guid ItemId { get; set; }
    public Guid UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? Notes { get; set; }
}

public static class BookingSettlementTypes
{
    public const string Refund = "refund";
    public const string NewBooking = "new_booking";
}

public sealed class BookingSettlementResult
{
    public Guid SettlementId { get; set; }
    public Guid VoucherId { get; set; }
    public string? VoucherNo { get; set; }
    public Guid? NewBookingId { get; set; }
    public string? NewBookingNo { get; set; }
    public decimal TotalRefund { get; set; }
    public decimal TotalSettledQty { get; set; }
    public int LinesCount { get; set; }
}

/// <summary>سطر إيصال تسوية حساب عميل للعرض والطباعة.</summary>
public sealed class BookingSettlementReceiptLine
{
    public string ItemName { get; set; } = "";
    public decimal SettledQty { get; set; }
    public decimal RemainingQty { get; set; }
    public decimal ExternalUnitPrice { get; set; }
    public decimal RefundAmount { get; set; }
}
