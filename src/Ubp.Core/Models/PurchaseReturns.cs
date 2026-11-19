namespace Ubp.Core.Models;

public static class PurchaseReturnMethods
{
    public const string Supplier = "SUPPLIER";
    public const string Cash = "CASH";
    public static bool IsValid(string? value) => value is Supplier or Cash;
}

public static class PurchaseReturnSourceTypes
{
    public const string Invoice = "INVOICE";
    public const string OperatingExpense = "OPERATING_EXPENSE";
    public static bool IsValid(string? value) => value is Invoice or OperatingExpense;
}

public static class PurchaseReturnStatuses
{
    public const string Draft = "DRAFT";
    public const string Posted = "POSTED";
}

public sealed class PurchaseReturnLineInput
{
    public Guid OriginalLineId { get; set; }
    public Guid? OperatingExpenseLineId { get; set; }
    public Guid ItemId { get; set; }
    public Guid UnitId { get; set; }
    public Guid WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    /// <summary>يُعاد حسابه من الفاتورة الأصلية على السيرفر.</summary>
    public decimal UnitPrice { get; set; }
    public string SourceType { get; set; } = PurchaseReturnSourceTypes.Invoice;
}

public sealed class PurchaseReturnInput
{
    public Guid BranchId { get; set; }
    public DateTime DocDate { get; set; } = DateTime.Today;
    public Guid SupplierId { get; set; }
    public Guid? OriginalDocumentId { get; set; }
    public Guid? OperatingExpenseId { get; set; }
    public string SourceType { get; set; } = PurchaseReturnSourceTypes.Invoice;
    public string ReturnMethod { get; set; } = PurchaseReturnMethods.Supplier;
    public Guid? TreasuryId { get; set; }
    public Guid? TreasuryMethodId { get; set; }
    public string? Notes { get; set; }
    public List<PurchaseReturnLineInput> Lines { get; set; } = new();
}

public sealed class PurchaseReturnLine
{
    public Guid Id { get; set; }
    public int LineNo { get; set; }
    public Guid? OriginalLineId { get; set; }
    public Guid ItemId { get; set; }
    public string? ItemCode { get; set; }
    public string? ItemName { get; set; }
    public Guid UnitId { get; set; }
    public Guid WarehouseId { get; set; }
    public string? WarehouseName { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public Guid? StockDocumentId { get; set; }
    public string SourceType { get; set; } = PurchaseReturnSourceTypes.Invoice;
    public Guid? OperatingExpenseLineId { get; set; }
}

public sealed class PurchaseReturn
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public string? BranchName { get; set; }
    public string? DocNo { get; set; }
    public DateTime DocDate { get; set; }
    public Guid SupplierId { get; set; }
    public string SupplierName { get; set; } = "";
    public Guid? OriginalDocumentId { get; set; }
    public Guid? OperatingExpenseId { get; set; }
    public string? OriginalDocNo { get; set; }
    public string SourceType { get; set; } = PurchaseReturnSourceTypes.Invoice;
    public string ReturnMethod { get; set; } = PurchaseReturnMethods.Supplier;
    public Guid? TreasuryId { get; set; }
    public string? TreasuryName { get; set; }
    public Guid? TreasuryMethodId { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = PurchaseReturnStatuses.Draft;
    public string? Notes { get; set; }
    public Guid? StockDocumentId { get; set; }
    public Guid? VoucherId { get; set; }
    public Guid? JournalEntryId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PostedAt { get; set; }
    public IReadOnlyList<PurchaseReturnLine> Lines { get; set; } = Array.Empty<PurchaseReturnLine>();

    public bool IsDraft => Status == PurchaseReturnStatuses.Draft;
    public bool IsCash => ReturnMethod == PurchaseReturnMethods.Cash;
}

public sealed class PurchaseReturnInvoiceLineOption
{
    public Guid OriginalLineId { get; set; }
    public Guid ItemId { get; set; }
    public string? ItemCode { get; set; }
    public string? ItemName { get; set; }
    public Guid UnitId { get; set; }
    public Guid WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ReturnedQty { get; set; }
    public decimal ReturnableQty { get; set; }
    public decimal UnitPrice { get; set; }
}

/// <summary>خيار سطر مخزون من مصروفات التشغيل للاختيار في شاشة مرتجع المشتريات.</summary>
public sealed class OperatingExpenseStockLineOption
{
    public Guid Id { get; set; }
    public Guid ExpenseId { get; set; }
    public Guid SupplierId { get; set; }
    public string? ExpenseDocNo { get; set; }
    public DateTime ExpenseDocDate { get; set; }
    public Guid ItemId { get; set; }
    public string? ItemCode { get; set; }
    public string? ItemName { get; set; }
    public Guid UnitId { get; set; }
    public Guid WarehouseId { get; set; }
    public string? WarehouseName { get; set; }
    public decimal OriginalQty { get; set; }
    public decimal ReturnedQty { get; set; }
    public decimal ReturnableQty { get; set; }
    public decimal UnitPrice { get; set; }
}

public sealed class PurchaseReturnInvoiceOption
{
    public Guid Id { get; set; }
    public string? DocNo { get; set; }
    public DateTime DocDate { get; set; }
    public Guid SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public decimal Total { get; set; }
    /// <summary>حالة الفاتورة الأصلية: draft / posted.</summary>
    public string Status { get; set; } = "posted";
    public IReadOnlyList<PurchaseReturnInvoiceLineOption> Lines { get; set; } =
        Array.Empty<PurchaseReturnInvoiceLineOption>();
}