namespace Ubp.Core.Models;

public sealed class PayrollMigrationBatch
{
    public Guid Id { get; set; }
    public string SourceSystem { get; set; } = "";
    public DateOnly AsOfDate { get; set; }
    public string Status { get; set; } = "draft";
    public int ImportedRows { get; set; }
    public int MatchedRows { get; set; }
}

public sealed class PayrollPeriodReconciliation
{
    public Guid Id { get; set; }
    public Guid PayrollRunId { get; set; }
    public decimal PreviousNet { get; set; }
    public decimal CurrentNet { get; set; }
    public decimal Difference => CurrentNet - PreviousNet;
    public string? Explanation { get; set; }
}
