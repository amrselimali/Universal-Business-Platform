using Ubp.Core.Models;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed class PayrollSimulationRequest
{
    public Guid EmployeeId { get; init; }
    /// <summary>current | historical | temporary</summary>
    public string Mode { get; init; } = "current";
    public DateOnly AsOfDate { get; init; }
    public Guid? RunId { get; init; }
    public decimal? ContractGrossOverride { get; init; }
    public decimal? DeductionOverride { get; init; }
    public IReadOnlyDictionary<string, decimal>? ItemOverrides { get; init; }
}

public sealed class PayrollSimulationDifference
{
    public string Code { get; init; } = "";
    public decimal Original { get; init; }
    public decimal Simulated { get; init; }
    public decimal Difference => Simulated - Original;
}

public sealed class PayrollSimulationResult
{
    public string Mode { get; init; } = "current";
    public PayrollCalculationBreakdown Breakdown { get; init; } = new();
    public PayrollCalculationBreakdown? Original { get; init; }
    public IReadOnlyList<PayrollSimulationDifference> Differences { get; init; } =
        Array.Empty<PayrollSimulationDifference>();
    public IReadOnlyList<string> Notes { get; init; } = Array.Empty<string>();
}

/// <summary>
/// شاشة احتساب صافي المرتب: ثلاثة أوضاع (حالي/مستقبلي، إعادة حساب تاريخي، محاكاة تعديل مؤقت)
/// تستخدم نفس محرك التشغيل ولا تكتب أي شيء — لا نتائج ولا أرصدة ولا أقساط ولا إعفاءات مستهلكة.
/// </summary>
public sealed partial class PayrollNetCalculationService
{
    private readonly IPayrollFoundationRepository _foundation;
    private readonly IPayrollConfigurationRepository _configuration;
    private readonly IPayrollOperationsRepository _operations;
    private readonly IPayrollStatutoryRepository _statutory;
    private readonly IPayrollRunRepository _runs;
    private readonly IEmployeeRepository _employees;
    private readonly PayrollEmployeeCalculator _calculator;
    private readonly IPayrollSimulationRepository _simulations;

    public PayrollNetCalculationService(IPayrollFoundationRepository foundation,
        IPayrollConfigurationRepository configuration, IPayrollOperationsRepository operations,
        IPayrollStatutoryRepository statutory, IPayrollRunRepository runs,
        IEmployeeRepository employees, PayrollEmployeeCalculator calculator,
        IPayrollSimulationRepository simulations)
    {
        _foundation = foundation;
        _configuration = configuration;
        _operations = operations;
        _statutory = statutory;
        _runs = runs;
        _employees = employees;
        _calculator = calculator;
        _simulations = simulations;
    }

    public async Task<PayrollSimulationResult> SimulateAsync(PayrollSimulationRequest request,
        CancellationToken ct = default)
    {
        var employee = await _employees.GetAsync(request.EmployeeId, ct)
            ?? throw new KeyNotFoundException("PAYROLL_EMPLOYEE_NOT_FOUND");
        var asOf = request.AsOfDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.AsOfDate;

        var contract = (await _foundation.ListContractsAsync(employee.Id, ct))
            .Where(x => x.EffectiveFrom <= asOf && (x.EffectiveTo is null || x.EffectiveTo >= asOf))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault()
            ?? throw new InvalidOperationException("PAYROLL_CONTRACT_MISSING");

        var profile = await _foundation.GetProfileAsync(employee.Id, ct);
        var items = await _configuration.ListItemsAsync(false, ct);
        var versions = new List<PayrollItemVersion>();
        foreach (var item in items) versions.AddRange(await _configuration.ListItemVersionsAsync(item.Id, ct));
        var formulas = await _configuration.ListFormulasAsync(ct);

        var from = new DateOnly(asOf.Year, asOf.Month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var attendance = await _operations.ListAttendanceAsync(from, to, employee.Id, ct);
        var adjustments = await _operations.ListAdjustmentsAsync(from, to, employee.Id, ct);
        var loans = await _operations.ListLoansAsync(employee.Id, ct);

        var taxPolicy = await _statutory.GetTaxPolicyAsync(asOf, ct);
        var exemptions = await _statutory.ListTaxExemptionsAsync(asOf, ct);
        var healthRule = await _statutory.GetHealthInsuranceRuleAsync(asOf, ct);
        var branchCode = employee.BranchId is { } branchId
            ? await _statutory.GetBranchCodeAsync(branchId, ct)
            : null;
        var insurancePolicy = await _statutory.GetInsurancePolicyAsync(branchCode, asOf, ct);

        var companyId = await _statutory.GetCompanyIdAsync(ct);
        var scopeType = employee.BranchId is null ? PayrollTaxScopes.Company : PayrollTaxScopes.Branch;
        var taxBranchId = scopeType == PayrollTaxScopes.Branch ? employee.BranchId : null;
        var period = PayrollStatutoryRepository.PeriodKey(companyId, asOf);
        var balance = await _statutory.GetTaxBalanceAsync(employee.Id, period.TaxPeriodId,
            scopeType, taxBranchId, ct);

        var grossBase = request.ContractGrossOverride ?? contract.GrossSalary;
        var inputs = BuildInputs(grossBase, items, attendance, adjustments, loans);
        if (request.DeductionOverride is { } extraDeduction && extraDeduction > 0)
            inputs["DEDUCTIONS"] = inputs.GetValueOrDefault("DEDUCTIONS") + extraDeduction;
        if (request.ItemOverrides is not null)
            foreach (var pair in request.ItemOverrides) inputs[pair.Key] = pair.Value;

        var healthApplicable = healthRule is not null && IsHealthSubject(profile);
        var breakdown = _calculator.Calculate(new PayrollEmployeeCalculationInput
        {
            EmployeeId = employee.Id, EmployeeName = employee.NameAr, BranchId = employee.BranchId,
            CurrencyCode = contract.CurrencyCode, PeriodFrom = from, PeriodTo = to, AsOfDate = asOf,
            CalculationVersion = "simulation", ContractGross = grossBase,
            ContractInsurable = contract.InsurableSalary,
            SalarySuspended = profile?.SalarySuspended ?? false,
            InsuranceStatusCode = profile?.InsuranceStatusCode, NationalityCode = profile?.NationalityCode,
            NonWorkingWives = profile?.NonWorkingWives ?? 0, Dependents = profile?.Dependents ?? 0,
            HealthInsuranceApplicable = healthApplicable, Items = items, Versions = versions,
            Formulas = formulas, Inputs = inputs, TaxPolicy = taxPolicy, TaxExemptions = exemptions,
            TaxableIncomeYtd = balance?.TaxableIncomeYtd ?? 0m,
            TaxWithheldYtd = balance?.TaxWithheldYtd ?? 0m,
            TaxCreditBalance = balance?.CreditBalance ?? 0m,
            InsurancePolicy = insurancePolicy, HealthRule = healthApplicable ? healthRule : null
        });

        var notes = new List<string> { "SIMULATION_ONLY_NO_WRITE" };
        PayrollCalculationBreakdown? original = null;
        var differences = new List<PayrollSimulationDifference>();
        if (request.RunId is { } runId)
        {
            original = await LoadOriginalAsync(runId, employee.Id, ct, notes);
            if (original is not null) differences.AddRange(BuildDifferences(original, breakdown));
        }

        return new PayrollSimulationResult
        {
            Mode = request.Mode, Breakdown = breakdown, Original = original,
            Differences = differences, Notes = notes
        };
    }

    /// <summary>
    /// يحفظ السيناريو كمرجع مع المستخدم والوقت والإعدادات المستخدمة (بند 14.2) —
    /// بلا ترحيل وبلا أي تأثير على النتائج المعتمدة أو الأرصدة.
    /// </summary>
    public async Task<Guid> SaveScenarioAsync(PayrollSimulationRequest request,
        PayrollSimulationResult result, Ubp.Core.Security.ActorContext actor, CancellationToken ct = default)
    {
        var companyId = await _statutory.GetCompanyIdAsync(ct);
        var overrides = new List<PayrollSimulationOverrideInput>();
        if (request.ContractGrossOverride is { } gross)
            overrides.Add(new PayrollSimulationOverrideInput("CONTRACT_GROSS", null,
                gross.ToString("0.00"), "temporary-simulation"));
        if (request.DeductionOverride is { } deduction)
            overrides.Add(new PayrollSimulationOverrideInput("DEDUCTIONS", null,
                deduction.ToString("0.00"), "temporary-simulation"));
        if (request.ItemOverrides is not null)
            foreach (var pair in request.ItemOverrides)
                overrides.Add(new PayrollSimulationOverrideInput(pair.Key, null,
                    pair.Value.ToString("0.00"), "item-override"));

        var breakdown = result.Breakdown;
        var components = new List<PayrollSimulationResultInput>
        {
            new("GROSS", breakdown.GrossAmount), new("DEDUCTIONS", breakdown.DeductionsAmount),
            new("TAX", breakdown.TaxCurrent), new("INSURANCE", breakdown.EmployeeInsurance),
            new("HEALTH_INSURANCE", breakdown.EmployeeHealthInsurance), new("NET", breakdown.NetAmount),
            new("EMPLOYER_COST", breakdown.EmployerCost)
        };

        return await _simulations.SaveAsync(companyId, new PayrollSimulationSave
        {
            EmployeeId = request.EmployeeId,
            RunId = request.RunId,
            SimulationType = request.Mode.ToUpperInvariant() switch
            {
                "HISTORICAL" => "HISTORICAL",
                "TEMPORARY" => "TEMPORARY",
                _ => "CURRENT"
            },
            OriginalNet = result.Original?.NetAmount,
            SimulatedNet = breakdown.NetAmount,
            ChangedBy = actor.UserId,
            Overrides = overrides,
            Results = components
        }, ct);
    }

    public Task<IReadOnlyList<PayrollSimulationSummary>> ListScenariosAsync(Guid? employeeId,
        CancellationToken ct = default) => _simulations.ListAsync(employeeId, ct);
}
