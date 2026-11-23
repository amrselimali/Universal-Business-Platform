namespace Ubp.Core.Models;

public static class ExecutionTypes
{
    public const string Original = "ORIGINAL";
    public const string Reversal = "REVERSAL";
    public const string Adjusted = "ADJUSTED";
}

public static class ExecutionStatuses
{
    public const string Draft = "draft";
    public const string Posted = "posted";
    public const string Cancelled = "cancelled";
    public const string Reversed = "reversed";
}

/// <summary>بيانات شاشة تنفيذ الحجز: قراءة فقط عدا الكمية ووحدات العدّاد.</summary>
public sealed class BookingExecutionPreview
{
    public Guid BookingId { get; set; }
    public Guid BookingLineId { get; set; }
    public string? BookingNo { get; set; }
    /// <summary>حالة الحجز المنفَّذ (confirmed/partially_delivered…) — 0213.</summary>
    public string? BookingStatus { get; set; }
    /// <summary>تاريخ حجز الموعد — 0213.</summary>
    public DateOnly? BookingDate { get; set; }
    /// <summary>الموظف المسؤول على الحجز — 0213.</summary>
    public Guid? AssignedEmployeeId { get; set; }
    public Guid BranchId { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = "";
    public Guid ItemId { get; set; }
    public string ItemCode { get; set; } = "";
    public string ItemName { get; set; } = "";
    public string ItemType { get; set; } = "GOODS";
    /// <summary>طريقة تنفيذ الصنف: reserved (الافتراضي) أو direct (تجاوز قيود التنفيذ).</summary>
    public string ExecutionMode { get; set; } = ItemExecutionModes.Reserved;
    public Guid UnitId { get; set; }
    public string UnitName { get; set; } = "";
    public Guid WarehouseId { get; set; }
    public string WarehouseName { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal DeliveredQty { get; set; }
    public decimal CancelledQty { get; set; }
    public decimal ReservedQty { get; set; }
    public decimal RemainingQty { get; set; }
    public decimal UnitPrice { get; set; }
    public string? EmployeeName { get; set; }
    /// <summary>الموظف المسؤول المحلول (حجز/موعد) — يُستخدم في التحقق من فرع التنفيذ.</summary>
    public Guid? EmployeeId { get; set; }
    /// <summary>فرع الموظف المسؤول؛ NULL = موظف على مستوى الشركة (0091).</summary>
    public Guid? EmployeeBranchId { get; set; }
    public bool ItemIsMetered { get; set; }
    public IReadOnlyList<ExecutionMeterAsset> MeterAssets { get; set; } =
        Array.Empty<ExecutionMeterAsset>();
    public string UnitsColumnLabel { get; set; } = "عدد الوحدات";
}

public sealed class ExecutionMeterAsset
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? MeterType { get; set; }
    public decimal CurrentMeterValue { get; set; }
}

public sealed class BookingExecutionInput
{
    public Guid BookingLineId { get; set; }
    public decimal Quantity { get; set; }
    public Guid? MeteredAssetId { get; set; }
    public decimal MeterUnits { get; set; }
    public string UnitsColumnLabel { get; set; } = "";
    /// <summary>الموظف المنفّذ المختار من نافذة تنفيذ الخدمة (منفّذ الجلسة) — 0088.</summary>
    public Guid? EmployeeId { get; set; }
}

public sealed class BookingExecutionResult
{
    public Guid ExecutionId { get; set; }
    public Guid BookingId { get; set; }
    public string? DocNo { get; set; }
    public decimal Quantity { get; set; }
    public decimal MeterUnits { get; set; }
    public decimal MeterValueAfter { get; set; }
    public decimal CostTotal { get; set; }
}
