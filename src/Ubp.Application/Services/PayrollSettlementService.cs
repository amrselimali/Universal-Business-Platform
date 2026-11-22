using Ubp.Core.Models;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed class PayrollSettlementComputation
{
    public Guid EmployeeId { get; init; }
    public DateOnly TerminationDate { get; init; }
    public decimal NetSalary { get; init; }
    public decimal Tax { get; init; }
    public decimal Insurance { get; init; }
    public decimal LeaveDays { get; init; }
    public decimal LeavePayment { get; init; }
    public decimal Gratuity { get; init; }
    public decimal LoansOutstanding { get; init; }
    public decimal TotalEntitlements { get; init; }
    public decimal TotalDeductions { get; init; }
    public decimal NetSettlement { get; init; }
    public IReadOnlyList<PayrollCalculationLine> Lines { get; init; } = Array.Empty<PayrollCalculationLine>();
}

/// <summary>
/// التسوية النهائية عند انتهاء الخدمة (بند 13.3): تُحسب بنفس محرك المرتبات وبضوابط
/// الاعتماد نفسها، وتُحفظ في payroll_final_settlements + السطور التفصيلية.
/// </summary>
public sealed class PayrollSettlementService
{
    private readonly PayrollNetCalculationService _netCalculation;
    private readonly IPayrollOperationsRepository _operations;
    private readonly IPayrollSettlementRepository _settlements;
    private readonly IPayrollStatutoryRepository _statutory;
    private readonly PayrollAuditWriter _audit;

    public PayrollSettlementService(PayrollNetCalculationService netCalculation,
        IPayrollOperationsRepository operations, IPayrollSettlementRepository settlements,
        IPayrollStatutoryRepository statutory, PayrollAuditWriter audit)
    {
        _netCalculation = netCalculation;
        _operations = operations;
        _settlements = settlements;
        _statutory = statutory;
        _audit = audit;
    }

    public async Task<PayrollSettlementComputation> CalculateAsync(Guid employeeId,
        DateOnly terminationDate, decimal leaveDays, decimal gratuity = 0m,
        CancellationToken ct = default)
    {
        if (terminationDate == default) terminationDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var simulation = await _netCalculation.SimulateAsync(new PayrollSimulationRequest
        {
            EmployeeId = employeeId, Mode = "historical", AsOfDate = terminationDate
        }, ct);

        var breakdown = simulation.Breakdown;
        var loans = await _operations.ListLoansAsync(employeeId, ct);
        var loansOutstanding = loans.Where(x => x.Status is "approved" or "active")
            .Sum(x => x.OutstandingBalance);

        var daysInMonth = DateTime.DaysInMonth(terminationDate.Year, terminationDate.Month);
        var dailyRate = daysInMonth == 0 ? 0m : breakdown.NetAmount / daysInMonth;
        var leavePayment = decimal.Round(dailyRate * Math.Max(0, leaveDays), 2);
        var entitlements = breakdown.NetAmount + leavePayment + Math.Max(0, gratuity);
        var deductions = loansOutstanding + breakdown.TaxCurrent + breakdown.EmployeeInsurance;

        var lines = breakdown.Lines
            .Where(x => x.Kind is not PayrollLineKinds.Informational)
            .Concat(new[]
            {
                new PayrollCalculationLine
                {
                    Code = "LEAVE_PAYMENT", NameAr = "بدل رصيد الإجازات",
                    Kind = PayrollLineKinds.Earning, Amount = leavePayment,
                    Explanation = $"days:{leaveDays};daily:{dailyRate:0.00}"
                },
                new PayrollCalculationLine
                {
                    Code = "GRATUITY", NameAr = "مكافأة نهاية الخدمة",
                    Kind = PayrollLineKinds.Earning, Amount = Math.Max(0, gratuity),
                    Explanation = "configured"
                },
                new PayrollCalculationLine
                {
                    Code = "LOAN_OUTSTANDING", NameAr = "رصيد السلف المتبقي",
                    Kind = PayrollLineKinds.Deduction, Amount = loansOutstanding,
                    Explanation = "employee_loans"
                }
            }).ToArray();

        return new PayrollSettlementComputation
        {
            EmployeeId = employeeId,
            TerminationDate = terminationDate,
            NetSalary = breakdown.NetAmount,
            Tax = breakdown.TaxCurrent,
            Insurance = breakdown.EmployeeInsurance,
            LeaveDays = Math.Max(0, leaveDays),
            LeavePayment = leavePayment,
            Gratuity = Math.Max(0, gratuity),
            LoansOutstanding = loansOutstanding,
            TotalEntitlements = decimal.Round(entitlements, 2),
            TotalDeductions = decimal.Round(deductions, 2),
            NetSettlement = decimal.Round(entitlements - deductions, 2),
            Lines = lines
        };
    }

    public async Task<Guid> SaveAsync(PayrollSettlementComputation computation, ActorContext actor,
        bool approve, string? note = null, CancellationToken ct = default)
    {
        var companyId = await _statutory.GetCompanyIdAsync(ct);
        var status = approve ? "approved" : "calculated";
        var lines = computation.Lines.Select(line => new PayrollSettlementLineInput
        {
            LineType = line.Kind switch
            {
                PayrollLineKinds.Deduction => "DEDUCTION",
                PayrollLineKinds.Tax => "TAX",
                PayrollLineKinds.Insurance or PayrollLineKinds.HealthInsurance => "INSURANCE",
                _ => "EARNING"
            },
            Description = line.NameAr, Amount = line.Amount, CalculationBasis = line.Explanation
        }).ToArray();

        var id = await _settlements.SaveAsync(companyId, new PayrollSettlementSave
        {
            EmployeeId = computation.EmployeeId,
            TerminationDate = computation.TerminationDate,
            SettlementDate = DateOnly.FromDateTime(DateTime.UtcNow),
            SettlementType = "END_OF_SERVICE",
            TotalEntitlements = computation.TotalEntitlements,
            TotalDeductions = computation.TotalDeductions,
            NetSettlement = computation.NetSettlement,
            LeavePayment = computation.LeavePayment,
            GratuityAmount = computation.Gratuity,
            TaxAmount = computation.Tax,
            InsuranceAmount = computation.Insurance,
            Note = note,
            ApprovedBy = approve ? actor.UserId : null,
            Lines = lines
        }, status, ct);

        await _audit.WriteAsync(actor, "payroll_final_settlements", id.ToString(),
            approve ? "APPROVE" : "CALCULATE", null,
            new { employee_id = computation.EmployeeId, net = computation.NetSettlement, status }, ct);
        return id;
    }

    public Task<IReadOnlyList<PayrollSettlementSummary>> ListAsync(Guid? employeeId,
        CancellationToken ct = default) => _settlements.ListAsync(employeeId, ct);
}
