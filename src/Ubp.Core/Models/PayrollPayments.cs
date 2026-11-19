namespace Ubp.Core.Models;

public sealed class PayrollPayment
{
    public Guid Id { get; set; }
    public Guid PayrollRunId { get; set; }
    public Guid EmployeeId { get; set; }
    public string PaymentMethodCode { get; set; } = "";
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "";
    public string Status { get; set; } = "pending";
    public string? ExternalReference { get; set; }
    public string IdempotencyKey { get; set; } = "";
}

public sealed class PayrollJournalLink
{
    public Guid Id { get; set; }
    public Guid PayrollRunId { get; set; }
    public Guid? JournalEntryId { get; set; }
    public string PostingType { get; set; } = "accrual";
    public string Status { get; set; } = "pending";
}
