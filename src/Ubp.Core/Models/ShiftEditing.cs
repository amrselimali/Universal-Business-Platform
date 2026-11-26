namespace Ubp.Core.Models;

/// <summary>سطر قابل للتعديل من تقرير الشفت (توحيد مستندات الشيفت) — 0089.</summary>
public sealed class ShiftEditableLine
{
    public string EntityType { get; set; } = "";
    public Guid DocId { get; set; }
    public string? DocNo { get; set; }
    public DateTime? DocDate { get; set; }
    public Guid? LineId { get; set; }
    /// <summary>بند الحجز الأصلي (لخدمة منفذة) — 0111.</summary>
    public Guid? BookingLineId { get; set; }
    /// <summary>الشفت الذي سُجّل فيه المستند.</summary>
    public Guid? ShiftId { get; set; }
    public string? PartyName { get; set; }
    public string? ItemName { get; set; }
    public string? EmployeeName { get; set; }
    public string? TreasuryName { get; set; }
    /// <summary>حالة المستند الأصلي: draft/posted (لتفعيل قيد الفرق للمُرحّل).</summary>
    public string DocStatus { get; set; } = "draft";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    /// <summary>المعرّفات الأصلية لتهيئة الاختيارات ومقارنة التغييرات.</summary>
    public Guid? AccountId { get; set; }
    public Guid? TreasuryId { get; set; }
    public Guid? EmployeeId { get; set; }
    /// <summary>الحقول القابلة للتعديل لهذا السطر مفصولة بفاصلة.</summary>
    public string FieldsCsv { get; set; } = "";
    /// <summary>عدد البلصات الفعلي = وحدات عدّاد الأصل المرتبط بالتنفيذ (0214).</summary>
    public decimal MeterUnits { get; set; }
    /// <summary>الأصل الثابت المرتبط بالعدّاد (يظهر بجوار عدد البلصات) — 0214.</summary>
    public Guid? MeteredAssetId { get; set; }
    public string? MeteredAssetName { get; set; }
    /// <summary>
    /// هل يجوز حذف السطر؟ بند الحجز: بلا تنفيذ ولا حركة على الكمية. المستندات: مسودة فقط.
    /// الخدمات المنفذة لا تُحذف (تُعدّل بعكس + تنفيذ معدّل).
    /// </summary>
    public bool CanDelete { get; set; }

    public IReadOnlyList<string> Fields => FieldsCsv.Split(',',
        StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

/// <summary>طلب تعديل حقل في سطر مستند ضمن الشفت — 0089.</summary>
public sealed class ShiftLineEditInput
{
    public Guid ShiftId { get; set; }
    public string EntityType { get; set; } = "";
    public Guid DocId { get; set; }
    public Guid? LineId { get; set; }
    /// <summary>account / treasury / item / employee / quantity / unit_price / amount / description.</summary>
    public string Field { get; set; } = "";
    public string? NewValue { get; set; }
    public string? Note { get; set; }
}

public sealed class ShiftEditOutcome
{
    public bool Applied { get; set; }
    public Guid? DifferenceEntryId { get; set; }
    public string? Message { get; set; }
}

/// <summary>
/// طلب حذف سطر من مستندات الشفت (وليس تعديله): يُرفض إذا كان على السطر تنفيذ أو حركة
/// أو مستند مرتبط، أو كان المستند مُرحَّلًا.
/// </summary>
public sealed class ShiftLineDeleteInput
{
    public Guid ShiftId { get; set; }
    public string EntityType { get; set; } = "";
    public Guid DocId { get; set; }
    public Guid? LineId { get; set; }
    public string? Note { get; set; }
}

/// <summary>نتيجة حذف سطر من الشفت.</summary>
public sealed class ShiftLineDeleteResult
{
    public bool Deleted { get; set; }
    /// <summary>حُذف المستند نفسه لخلوّه من السطور (مسودة بلا مراجع).</summary>
    public bool DocumentDeleted { get; set; }
}
