using static Ubp.Core.Security.ActionCodes;

namespace Ubp.Core.Security;

/// <summary>شاشات موديول المرتبات وصلاحياتها التفصيلية (كل شاشة بصلاحيات منفصلة عن الأخرى).</summary>
public static partial class AppRegistry
{
    private static ScreenAction P(string code) => new(code, $"action.{code.ToLowerInvariant()}");

    private static IReadOnlyList<ScreenDefinition> PayrollScreens => new List<ScreenDefinition>
    {
        new(ScreenCodes.PayrollDashboard, "/payroll/dashboard", "Dashboard", "screen.payroll_dashboard",
            GroupEmployeeManagement, new[] { P(View) }, "payroll.dashboard"),

        new(ScreenCodes.PayrollCalendars, "/payroll/calendars", "Event", "screen.payroll_calendars",
            GroupEmployeeManagement, new[] { P(View) }, "payroll.calendars"),

        new(ScreenCodes.PayrollGroups, "/payroll/groups", "Groups", "screen.payroll_groups",
            GroupEmployeeManagement, new[] { P(View), P(Create), P(Edit) }, "payroll.groups"),

        new(ScreenCodes.PayrollEmployees, "/payroll/employees", "Badge", "screen.payroll_employees",
            GroupEmployeeManagement,
            new[] { P(ViewBasic), P(Register), P(CompleteData), P(Approve),
                    P(SensitiveEdit), P(FieldsManage), P(View) }, "payroll.employees"),


        new(ScreenCodes.PayrollFormulaRules, "/payroll/formula-rules", "Functions",
            "screen.payroll_formula_rules", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit), P(Approve) }, "payroll.formula_rules"),

        new(ScreenCodes.PayrollDataSourceMapping, "/payroll/data-mapping", "Schema",
            "screen.payroll_data_sources", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit) }, "payroll.data_sources"),

        new(ScreenCodes.PayrollDistributionRules, "/payroll/distribution-rules", "CallSplit",
            "screen.payroll_distribution", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit) }, "payroll.distribution"),

        new(ScreenCodes.PayrollTaxConfiguration, "/payroll/tax-config", "Percent",
            "screen.payroll_tax", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit), P(Approve) }, "payroll.tax"),

        new(ScreenCodes.PayrollInsuranceConfiguration, "/payroll/insurance", "Shield",
            "screen.payroll_insurance", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit), P(Approve) }, "payroll.insurance"),

        new(ScreenCodes.PayrollHealthInsurance, "/payroll/health-insurance", "HealthAndSafety",
            "screen.payroll_health_insurance", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit), P(Approve) }, "payroll.health_insurance"),

        new(ScreenCodes.PayrollRuns, "/payroll/runs", "Calculate", "screen.payroll_runs",
            GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Calculate), P(Edit), P(Approve), P(Post), P(Pay),
                    P(Reopen), P(Override), P(Export), P(ViewDetail) }, "payroll.runs"),

        new(ScreenCodes.PayrollNetCalculation, "/payroll/net-calculation", "Calculate",
            "screen.payroll_net_calculation", GroupEmployeeManagement,
            new[] { P(View), P(Simulate) }, "payroll.net_calculation"),

        new(ScreenCodes.PayrollReviewApproval, "/payroll/review-approval", "FactCheck",
            "screen.payroll_review_approval", GroupEmployeeManagement,
            new[] { P(View), P(Approve), P(Override) }, "payroll.approval"),

        new(ScreenCodes.PayrollAdjustments, "/payroll/adjustments", "Tune", "screen.payroll_adjustments",
            GroupEmployeeManagement, new[] { P(View), P(Create), P(Edit) }, "payroll.adjustments"),

        new(ScreenCodes.PayrollLoans, "/payroll/loans", "AccountBalance", "screen.payroll_loans",
            GroupEmployeeManagement, new[] { P(View), P(Create), P(Edit) }, "payroll.loans"),

        new(ScreenCodes.PayrollAttendance, "/payroll/attendance", "AccessTime",
            "screen.payroll_attendance", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit), P(Approve) }, "payroll.attendance"),

        new(ScreenCodes.PayrollLeaves, "/payroll/leaves", "EventAvailable", "screen.payroll_leaves",
            GroupEmployeeManagement, new[] { P(View), P(Create), P(Edit), P(Approve) }, "payroll.leaves"),

        new(ScreenCodes.PayrollFinalSettlement, "/payroll/final-settlement", "Handshake",
            "screen.payroll_settlement", GroupEmployeeManagement,
            new[] { P(View), P(Calculate), P(Approve) }, "payroll.settlement"),

        new(ScreenCodes.PayrollAudit, "/payroll/audit", "History", "screen.payroll_audit",
            GroupEmployeeManagement, new[] { P(View) }, "payroll.audit"),

        new(ScreenCodes.PayrollOpeningBalances, "/payroll/opening-balances", "AccountBalanceWallet",
            "screen.payroll_opening_balances", GroupEmployeeManagement,
            new[] { P(View), P(Create), P(Edit) }, "payroll.opening_balances"),

        new(ScreenCodes.PayrollReports, "/payroll/reports", "Assessment", "screen.payroll_reports",
            GroupEmployeeManagement, new[] { P(View), P(Export), P(Print) }, "payroll.reports")
    };
}
