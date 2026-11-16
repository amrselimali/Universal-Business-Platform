namespace Ubp.Infrastructure.Repositories;

public sealed partial class BookingSettlementRepository
{
    private sealed record JournalLeg(Guid AccountId, decimal Debit, decimal Credit,
        Guid? CustomerId);

    private sealed class TreasuryRow
    {
        public Guid Id { get; set; }
        public Guid BranchId { get; set; }
        public Guid AccountId { get; set; }
        public string Name { get; set; } = "";
        public string TreasuryType { get; set; } = "";
        public Guid MethodId { get; set; }
    }

    private sealed class LockedLine
    {
        public Guid BookingLineId { get; set; }
        public Guid BookingId { get; set; }
        public Guid ItemId { get; set; }
        public decimal BookedQty { get; set; }
        public decimal RemainingQty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DeliveredQty { get; set; }
        public decimal InvoicedQty { get; set; }
        public decimal TransferredQty { get; set; }
        public decimal SettledQty { get; set; }
        public DateTime BookingDate { get; set; }
        public Guid BranchId { get; set; }
        public Guid CustomerId { get; set; }
        public string BookingStatus { get; set; } = "";
        public decimal DepositAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal SettledPaidAmount { get; set; }
        public decimal BookingRemainingValue { get; set; }
    }

    private sealed class SettlementCalc
    {
        public Guid BookingId { get; set; }
        public Guid BookingLineId { get; set; }
        public Guid ItemId { get; set; }
        public DateTime BookingDate { get; set; }
        public decimal BookedQty { get; set; }
        public decimal ConsumedQty { get; set; }
        public decimal SettledQty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal ExternalUnitPrice { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal RefundAmount { get; set; }
        public decimal RevenueAdjustment { get; set; }
    }
}
