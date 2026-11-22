using Ubp.Core.Models;

namespace Ubp.Application.Services;

/// <summary>
/// حاسبة موظف واحد: تُجمّع بنود المرتب (المعادلات) مع محركات الضريبة والتأمينات والتأمين الصحي
/// وتُخرج تفصيلاً قابلاً للتفسير. لا تكتب أي شيء في قاعدة البيانات — التشغيل والمحاكاة يستخدمانها معاً
/// حتى لا تختلف نتيجة الشاشة عن نتيجة الدورة.
/// </summary>
public sealed class PayrollEmployeeCalculator
{
    private readonly PayrollCalculationOrchestrator _orchestrator;
    private readonly PayrollCalculationEngines _engines;
    private readonly PayrollExpressionEvaluator _evaluator;

    public PayrollEmployeeCalculator(PayrollCalculationOrchestrator orchestrator,
        PayrollCalculationEngines engines, PayrollExpressionEvaluator evaluator)
    {
        _orchestrator = orchestrator;
        _engines = engines;
        _evaluator = evaluator;
    }

    public PayrollCalculationBreakdown Calculate(PayrollEmployeeCalculationInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (string.IsNullOrWhiteSpace(input.CurrencyCode))
            throw new ArgumentException("Payroll currency is required.", nameof(input));

        var notes = new List<string>();
        var lines = new List<PayrollCalculationLine>();
        var gross = 0m;
        var taxable = 0m;
        var insurable = 0m;
        var deductions = 0m;
        var employerBorne = 0m;

        if (input.SalarySuspended)
        {
            notes.Add("PAYROLL_SALARY_SUSPENDED");
            return new PayrollCalculationBreakdown
            {
                EmployeeId = input.EmployeeId, CurrencyCode = input.CurrencyCode,
                Lines = Array.Empty<PayrollCalculationLine>(), Notes = notes
            };
        }

        var itemInputs = BuildItemInputs(input);
        if (input.Items.Count > 0)
        {
            var result = _orchestrator.Calculate(new PayrollCalculationRequest
            {
                EmployeeId = input.EmployeeId, CurrencyCode = input.CurrencyCode,
                Items = input.Items, Versions = input.Versions, Formulas = input.Formulas,
                Inputs = itemInputs, AsOfDate = input.AsOfDate,
                CalculationVersion = input.CalculationVersion
            });
            var byCode = input.Items.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
            foreach (var line in result.Lines)
            {
                if (!byCode.TryGetValue(line.ItemCode, out var item)) continue;
                var isEmployerCost = item.EmployerBorne || !item.AffectsNetSalary;
                var kind = item.EmployerBorne
                    ? PayrollLineKinds.Employer
                    : item.CategoryCode.Equals("earning", StringComparison.OrdinalIgnoreCase)
                        ? PayrollLineKinds.Earning
                        : PayrollLineKinds.Deduction;

                if (item.EmployerBorne)
                {
                    // تحمّل الشركة الجزئي: النسبة/المبلغ/الحد الأقصى — والباقي يُحمَّل على الموظف كخصم.
                    var employerShare = ApplyShoulder(line.Amount, item.Id, input);
                    var employeeShare = line.Amount - employerShare;
                    employerBorne += employerShare;
                    if (employeeShare > 0)
                    {
                        deductions += employeeShare;
                        lines.Add(new PayrollCalculationLine
                        {
                            Code = $"{item.Code}_EMPLOYEE_SHARE",
                            NameAr = $"{item.NameAr} — الجزء غير المتحمل",
                            Kind = PayrollLineKinds.Deduction, Amount = employeeShare,
                            Explanation = "gross-up-shoulder"
                        });
                    }
                }
                else if (kind == PayrollLineKinds.Earning) gross += line.Amount;
                else deductions += line.Amount;

                var taxableAmount = item.IsTaxable && !item.EmployerBorne ? line.Amount : 0m;
                var insurableAmount = item.IsInsurable && !item.EmployerBorne ? line.Amount : 0m;
                taxable += taxableAmount;
                insurable += insurableAmount;

                lines.Add(new PayrollCalculationLine
                {
                    Code = item.Code, NameAr = item.NameAr, Kind = kind, Amount = line.Amount,
                    TaxableAmount = taxableAmount, InsurableAmount = insurableAmount,
                    CostAmount = isEmployerCost ? line.Amount : 0m,
                    FormulaCode = line.FormulaCode,
                    Explanation = $"item:{item.Code};version:{item.Version}"
                });
            }
        }

        if (gross == 0m && input.ContractGross > 0)
        {
            gross = input.ContractGross;
            taxable = input.ContractGross;
            insurable = input.ContractInsurable ?? input.ContractGross;
            lines.Add(new PayrollCalculationLine
            {
                Code = "BASIC", NameAr = "الراتب الأساسي حسب العقد", Kind = PayrollLineKinds.Earning,
                Amount = input.ContractGross, TaxableAmount = taxable,
                InsurableAmount = insurable, Explanation = "contract"
            });
        }

        if (input.EmployerBorneAmount > 0) employerBorne += input.EmployerBorneAmount;

        var healthRule = input.HealthInsuranceApplicable ? input.HealthRule : null;
        var socialBasis = input.ContractInsurable ?? insurable;
        var social = _engines.CalculateInsurance(socialBasis, input.InsurancePolicy);
        if (input.InsurancePolicy is null) notes.Add("PAYROLL_INSURANCE_POLICY_MISSING");

        var healthBasis = gross;
        if (healthRule is not null)
        {
            healthBasis = _engines.EvaluateHealthBasis(healthRule.BasisExpression,
                BuildConditionVariables(input, gross, taxable, insurable), gross);
        }
        var healthCalc = _engines.CalculateHealthInsurance(healthBasis, healthRule);
        if (healthRule is null && input.HealthInsuranceApplicable) notes.Add("PAYROLL_HEALTH_RULE_MISSING");

        var conditionVariables = BuildConditionVariables(input, gross, taxable, insurable);
        PayrollTaxComputation tax;
        if (input.TaxPolicy is null)
        {
            tax = new PayrollTaxComputation();
            if (taxable > 0) notes.Add("PAYROLL_TAX_POLICY_MISSING");
        }
        else
        {
            tax = _engines.CalculateCumulativeTax(taxable, input.TaxPolicy, input.TaxExemptions,
                input.TaxableIncomeYtd, input.TaxWithheldYtd, input.TaxCreditBalance,
                conditionVariables, input.AsOfDate);
        }

        if (social.EmployeeShare != 0)
            lines.Add(new PayrollCalculationLine
            {
                Code = "SOCIAL_INSURANCE_EMPLOYEE", NameAr = "تأمينات اجتماعية — حصة الموظف",
                Kind = PayrollLineKinds.Insurance, Amount = social.EmployeeShare,
                Explanation = input.InsurancePolicy is null
                    ? null
                    : $"policy:{input.InsurancePolicy.Code};v{input.InsurancePolicy.Version}"
            });
        if (social.EmployerShare != 0)
            lines.Add(new PayrollCalculationLine
            {
                Code = "SOCIAL_INSURANCE_EMPLOYER", NameAr = "تأمينات اجتماعية — حصة صاحب العمل",
                Kind = PayrollLineKinds.Employer, Amount = social.EmployerShare,
                CostAmount = social.EmployerShare,
                Explanation = input.InsurancePolicy is null
                    ? null
                    : $"policy:{input.InsurancePolicy.Code};v{input.InsurancePolicy.Version}"
            });
        if (healthCalc.EmployeeShare != 0)
            lines.Add(new PayrollCalculationLine
            {
                Code = "HEALTH_INSURANCE_EMPLOYEE", NameAr = "تأمين صحي شامل — حصة الموظف",
                Kind = PayrollLineKinds.HealthInsurance, Amount = healthCalc.EmployeeShare,
                Explanation = healthRule is null ? null : $"rule:{healthRule.Code}"
            });
        if (healthCalc.EmployerShare != 0)
            lines.Add(new PayrollCalculationLine
            {
                Code = "HEALTH_INSURANCE_EMPLOYER", NameAr = "تأمين صحي شامل — حصة صاحب العمل",
                Kind = PayrollLineKinds.Employer, Amount = healthCalc.EmployerShare,
                CostAmount = healthCalc.EmployerShare,
                Explanation = healthRule is null ? null : $"rule:{healthRule.Code}"
            });
        if (tax.CurrentDue != 0)
            lines.Add(new PayrollCalculationLine
            {
                Code = "INCOME_TAX", NameAr = "ضريبة الدخل",
                Kind = PayrollLineKinds.Tax, Amount = tax.CurrentDue,
                Explanation = input.TaxPolicy is null
                    ? null
                    : $"policy:{input.TaxPolicy.Code};v{input.TaxPolicy.Version};ytd:{tax.PreviouslyWithheld}"
            });
        if (tax.CreditBalance > 0)
            lines.Add(new PayrollCalculationLine
            {
                Code = "INCOME_TAX_CREDIT", NameAr = "رصيد ضريبي دائن مُرحّل",
                Kind = PayrollLineKinds.Informational, Amount = tax.CreditBalance,
                Explanation = "carried-forward-inside-tax-year"
            });

        var employeeDeductions = deductions + social.EmployeeShare + healthCalc.EmployeeShare + tax.CurrentDue;
        var net = gross - employeeDeductions;
        if (net < 0) notes.Add("PAYROLL_NET_NEGATIVE");
        var employerCost = gross + social.EmployerShare + healthCalc.EmployerShare + employerBorne;

        return new PayrollCalculationBreakdown
        {
            EmployeeId = input.EmployeeId,
            CurrencyCode = input.CurrencyCode,
            GrossAmount = decimal.Round(gross, 2),
            DeductionsAmount = decimal.Round(employeeDeductions, 2),
            NetAmount = decimal.Round(net, 2),
            EmployerCost = decimal.Round(employerCost, 2),
            TaxableIncome = taxable,
            TaxExemptAmount = tax.ExemptAmount,
            TaxableIncomeYtd = input.TaxableIncomeYtd + tax.TaxableIncome,
            TaxCumulativeDue = tax.CumulativeDue,
            TaxPreviouslyWithheld = tax.PreviouslyWithheld,
            TaxCurrent = tax.CurrentDue,
            TaxCreditBalance = tax.CreditBalance,
            InsurableBase = social.Basis,
            HealthInsuranceBasis = healthCalc.Basis,
            EmployeeInsurance = social.EmployeeShare,
            EmployerInsurance = social.EmployerShare,
            EmployeeHealthInsurance = healthCalc.EmployeeShare,
            EmployerHealthInsurance = healthCalc.EmployerShare,
            TaxPolicyCode = input.TaxPolicy?.Code,
            InsurancePolicyCode = input.InsurancePolicy?.Code,
            HealthRuleCode = healthRule?.Code,
            Lines = lines,
            Notes = notes
        };
    }

    /// <summary>حصة الشركة من بند متحمَّل وفق قاعدته (كلي/نسبة/مبلغ) وبحد أقصى اختياري.</summary>
    private static decimal ApplyShoulder(decimal amount, Guid itemId, PayrollEmployeeCalculationInput input)
    {
        if (input.GrossUpRules is null || !input.GrossUpRules.TryGetValue(itemId, out var rule))
            return amount;
        var share = rule.ShoulderType.ToUpperInvariant() switch
        {
            PayrollGrossUpShoulders.Percent => amount * (rule.ShoulderValue ?? 0m),
            PayrollGrossUpShoulders.Amount => Math.Min(amount, rule.ShoulderValue ?? amount),
            _ => amount
        };
        if (rule.MaxAmount is { } max) share = Math.Min(share, max);
        return Math.Max(0, decimal.Round(share, 2, MidpointRounding.AwayFromZero));
    }

    private static Dictionary<string, decimal> BuildItemInputs(PayrollEmployeeCalculationInput input)
    {
        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in input.Inputs) values[pair.Key] = pair.Value;
        values["BASE"] = values.TryGetValue("BASE", out var baseValue) ? baseValue : input.ContractGross;
        values["GROSS"] = values.TryGetValue("GROSS", out var grossValue) ? grossValue : input.ContractGross;
        values["CONTRACT_GROSS"] = input.ContractGross;
        values["INSURABLE"] = input.ContractInsurable ?? input.ContractGross;
        values["DEPENDENTS"] = Math.Max(0, input.Dependents);
        values["NON_WORKING_WIVES"] = Math.Max(0, input.NonWorkingWives);
        values["MEMBER_COUNT"] = Math.Max(0, input.Dependents) + Math.Max(0, input.NonWorkingWives);
        return values;
    }

    private static Dictionary<string, decimal> BuildConditionVariables(PayrollEmployeeCalculationInput input,
        decimal gross, decimal taxable, decimal insurable)
    {
        var values = BuildItemInputs(input);
        values["GROSS"] = gross;
        values["BASIC"] = input.ContractGross;
        values["TAXABLE"] = taxable;
        values["INSURABLE"] = insurable;
        values["TAXABLE_INCOME"] = taxable;
        values["NATIONALITY_EG"] =
            string.Equals(input.NationalityCode, "EG", StringComparison.OrdinalIgnoreCase) ? 1m : 0m;
        return values;
    }
}
