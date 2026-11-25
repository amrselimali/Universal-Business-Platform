namespace Ubp.Core.Models;

public enum PartnerKind
{
    Customer = 1,
    Supplier = 2
}

public sealed class Partner
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public Guid? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string ScopeType { get; set; } = "COMPANY";
    public Guid? BranchId { get; set; }
    public string? BranchName { get; set; }
    public string? Phone { get; set; }
    public string? Phone2 { get; set; }
    public string? WhatsAppPhone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? TaxNumber { get; set; }
    public decimal CreditLimit { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>عميل مربوط بدكتور خارجي (يظهر في شفت الدكتور الخارجي ويقبل دفعة مقدمة).</summary>
    public bool IsExternalDoctor { get; set; }
    public Dictionary<string, object?> CustomFields { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public int Version { get; set; } = 1;
}

/// <summary>
/// اختيار حقل «الكود الورقي» من تعريفات الحقول المخصصة للعميل (المفتاح أو التسمية
/// تحتوي paper/ورق) لعرضه في قائمة العملاء في عمود بجوار الكود.
/// </summary>
public static class PartnerCustomFieldRules
{
    public static CustomFieldDefinition? FindPaperCode(IEnumerable<CustomFieldDefinition> definitions) =>
        definitions.FirstOrDefault(IsPaperCode);

    public static bool IsPaperCode(CustomFieldDefinition definition) =>
        definition.FieldKey.Contains("paper", StringComparison.OrdinalIgnoreCase) ||
        definition.FieldKey.Contains("waraq", StringComparison.OrdinalIgnoreCase) ||
        definition.LabelAr.Contains("ورق", StringComparison.Ordinal) ||
        (definition.LabelEn?.Contains("paper", StringComparison.OrdinalIgnoreCase) ?? false);
}

public sealed class PartnerInput
{
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public Guid? CategoryId { get; set; }
    public string ScopeType { get; set; } = "COMPANY";
    public Guid? BranchId { get; set; }
    public string? Phone { get; set; }
    public string? Phone2 { get; set; }
    public string? WhatsAppPhone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? TaxNumber { get; set; }
    public decimal CreditLimit { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>ربط العميل بدكتور خارجي — يظهر في اختيار عميل شفت الدكتور الخارجي.</summary>
    public bool IsExternalDoctor { get; set; }
    public Dictionary<string, object?> CustomFields { get; set; } = new();
    /// <summary>أرصدة افتتاحية لخدمات العميل تُسجَّل مع إنشائه كحجوزات مؤكدة — 0104.</summary>
    public List<ServiceOpeningBalanceInput> OpeningBalances { get; set; } = new();
    /// <summary>
    /// قرار صريح من شاشة الإضافة: true = لا يوجد رصيد افتتاحي، false = يجب إدخال أرصدة،
    /// null = نداء قديم لا يفرض القرار (توافق خلفي).
    /// </summary>
    public bool? NoOpeningBalance { get; set; }
}

/// <summary>
/// رصيد افتتاحي لخدمة عند تكويد عميل جديد: كمية وسعر وحدة ومبلغ مسدد سابقًا،
/// يُحوَّل إلى حجز خدمة مؤكد (للتنفيذ) ويظهر مستحقه في تحصيلات الخدمات المحجوزة.
/// </summary>
/// <summary>
/// شرط شاشة إضافة العميل: أرصدة افتتاحية مسجلة أو قرار صريح «لا يوجد رصيد افتتاحي»،
/// وليس الاثنان معًا. null = نداء قديم لا يفرض القرار.
/// </summary>
public static class PartnerOpeningBalanceRules
{
    public static string? Validate(bool? noOpeningBalance, int openingBalancesCount)
    {
        if (noOpeningBalance is null) return null;
        var hasBalances = openingBalancesCount > 0;
        if (hasBalances && noOpeningBalance.Value)
            return "validation.opening_balance_exclusive";
        if (!hasBalances && !noOpeningBalance.Value)
            return "validation.opening_balance_required";
        return null;
    }

    /// <summary>
    /// نفس قواعد بند الرصيد عند التكويد تُطبَّق على التعديل المباشر:
    /// كمية موجبة، سعر غير سالب، ومسدد بين صفر والإجمالي.
    /// </summary>
    public static string? ValidateLine(decimal quantity, decimal unitPrice, decimal paidAmount)
    {
        if (quantity <= 0) return "validation.quantity_invalid";
        if (unitPrice < 0) return "validation.price_invalid";
        var total = Math.Round(quantity * unitPrice, 2, MidpointRounding.AwayFromZero);
        if (paidAmount < 0 || paidAmount > total) return "validation.paid_exceeds_total";
        return null;
    }
}

public sealed class ServiceOpeningBalanceInput
{
    public Guid ServiceId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal TotalAmount => Math.Round(Quantity * UnitPrice, 2, MidpointRounding.AwayFromZero);
    public decimal RemainingAmount => Math.Max(TotalAmount - PaidAmount, 0);
}

/// <summary>نتيجة تكويد عميل مع أرصدة افتتاحية: العميل والحجوزات المنشأة لسجل المراجعة.</summary>
public sealed class PartnerOpeningBalancesResult
{
    public Partner Partner { get; set; } = new();
    public IReadOnlyList<PartnerOpeningBalanceBooking> Bookings { get; set; } =
        Array.Empty<PartnerOpeningBalanceBooking>();
}

public sealed class PartnerOpeningBalanceBooking
{
    public Guid BookingId { get; set; }
    public string? DocNo { get; set; }
    public Guid ServiceId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
}

public sealed class PartnerCategory
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public int PartnerCount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public int Version { get; set; } = 1;
}

public sealed class PartnerCategoryInput
{
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// بند رصيد افتتاحي لعميل: حجز خدمة مؤكد يُنشأ مع تكويد العميل ويُعرض في شاشات
/// الخدمات المحجوزة وتحصيلات الخدمات المحجوزة وتسوية الحساب. قابل للتعديل المباشر
/// قبل أي تنفيذ/تحصيل/تحويل/تسوية، وبلا أي أثر محاسبي.
/// </summary>
public sealed class PartnerOpeningBalanceLine
{
    public Guid BookingId { get; set; }
    public Guid BookingLineId { get; set; }
    public Guid BranchId { get; set; }
    public string? DocNo { get; set; }
    public DateTime BookingDate { get; set; }
    public string Status { get; set; } = "";
    public Guid ServiceId { get; set; }
    public string ServiceCode { get; set; } = "";
    public string ServiceName { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DeliveredQty { get; set; }
    public decimal InvoicedQty { get; set; }
    public decimal TransferredQty { get; set; }
    public decimal SettledQty { get; set; }
    public int PaymentCount { get; set; }
    public int SettlementCount { get; set; }
    public int RelatedCount { get; set; }
    public int LineCount { get; set; }
    /// <summary>إجمالي الإيصالات المسجلة على الحجز (لا يُعدَّل منها شيء من هنا).</summary>
    public decimal ReceiptsAmount { get; set; }

    public decimal TotalAmount => Math.Round(Quantity * UnitPrice, 2, MidpointRounding.AwayFromZero);
    public decimal RemainingAmount => Math.Max(TotalAmount - PaidAmount, 0);

    /// <summary>أقصى مسدد مسموح = قيمة الخدمة ناقص الإيصالات المسجلة.</summary>
    public decimal MaxPaidAmount => Math.Max(
        Math.Round(TotalAmount - ReceiptsAmount, 2, MidpointRounding.AwayFromZero), 0);

    /// <summary>مفتاح ترجمة سبب منع التعديل، أو null إذا كان البند قابلًا للتعديل.</summary>
    public string? LockReasonKey { get; set; }
    public bool IsEditable => LockReasonKey is null;

    /// <summary>
    /// المسدد قابل للتعديل حتى بعد التنفيذ أو التحصيل (بحد أقصى قيمة الخدمة ناقص
    /// الإيصالات)، ويُمنع فقط بعد التحويل أو التسوية لأنهما يغيّران اقتصاديات البند.
    /// </summary>
    public bool CanEditPaid { get; set; }
}

/// <summary>سطر تعديل مباشر لبند رصيد افتتاحي: BookingLineId فارغ = بند جديد.</summary>
public sealed class PartnerOpeningBalanceEditLine
{
    public Guid? BookingLineId { get; set; }
    public Guid? ServiceId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal PaidAmount { get; set; }
}

/// <summary>تغيّر مسجَّل في المراجعة لكل بند رصيد افتتاحي بعد الحفظ.</summary>
public sealed class PartnerOpeningBalanceChange
{
    public Guid BookingId { get; set; }
    public string Action { get; set; } = "";
    public object? OldValues { get; set; }
    public object? NewValues { get; set; }
}

/// <summary>
/// نتيجة تعديل الأرصدة الافتتاحية: العدادات والفروق (فرق القيمة وفرق المسدد/النقد)
/// تُعرض للمستخدم وتُسجَّل في المراجعة، ولا تُنشئ أي قيد أو سند محاسبي.
/// </summary>
public sealed class PartnerOpeningBalanceEditResult
{
    public int Added { get; set; }
    public int Updated { get; set; }
    public int Removed { get; set; }
    public decimal OldTotal { get; set; }
    public decimal NewTotal { get; set; }
    public decimal OldPaid { get; set; }
    public decimal NewPaid { get; set; }
    public decimal ValueDifference => NewTotal - OldTotal;
    public decimal CashDifference => NewPaid - OldPaid;
    public IReadOnlyList<PartnerOpeningBalanceChange> Changes { get; set; } =
        Array.Empty<PartnerOpeningBalanceChange>();
}
