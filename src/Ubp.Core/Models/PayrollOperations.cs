namespace Ubp.Core.Models;

public sealed class PayrollAttendanceDaily
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public DateOnly WorkDate { get; set; }
    public decimal WorkedHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal AbsenceHours { get; set; }
    public string Status { get; set; } = "raw";
    public int Version { get; set; }
}

public sealed class PayrollLeaveRequest
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string LeaveTypeCode { get; set; } = "";
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public decimal Days { get; set; }
    public string Status { get; set; } = "draft";
}

public sealed class PayrollAdjustment
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid? PayrollItemId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public bool IsTaxable { get; set; }
    public bool IsInsurable { get; set; }
    public string Status { get; set; } = "draft";
}

public sealed class EmployeeLoan
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public decimal Principal { get; set; }
    public decimal OutstandingBalance { get; set; }
    public int Installments { get; set; }
    public string Status { get; set; } = "draft";
}
