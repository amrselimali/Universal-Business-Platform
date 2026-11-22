using Ubp.Core.Models;

namespace Ubp.Core.Security;

/// <summary>
/// توحيد أسماء صلاحيات المرتبات مع المواصفة (payroll.view … payroll.export) بلا كسر الصلاحيات القائمة.
/// القبول: صلاحية على مستوى الشاشة (PAYROLL_RUNS/VIEW) أو على مستوى الوحدة (payroll/view أو payroll.view/*).
/// </summary>
public static class PermissionAliases
{
    /// <summary>كود الوحدة كما تطلبه المواصفة (payroll.&lt;action&gt;).</summary>
    public const string PayrollModule = "payroll";

    private static readonly Dictionary<string, string> ActionMap = new(StringComparer.OrdinalIgnoreCase)
    {
        [ActionCodes.View] = "view",
        [ActionCodes.ViewBasic] = "view",
        [ActionCodes.ViewDetail] = "view",
        [ActionCodes.Create] = "create",
        [ActionCodes.Add] = "create",
        [ActionCodes.Register] = "create",
        [ActionCodes.Edit] = "edit",
        [ActionCodes.CompleteData] = "edit",
        [ActionCodes.SensitiveEdit] = "edit",
        [ActionCodes.FieldsManage] = "edit",
        [ActionCodes.Approve] = "approve",
        [ActionCodes.Post] = "post",
        [ActionCodes.Pay] = "pay",
        [ActionCodes.Export] = "export",
        [ActionCodes.ExportCsv] = "export",
        [ActionCodes.ExportXlsx] = "export",
        [ActionCodes.Print] = "export",
        [ActionCodes.Calculate] = "calculate",
        [ActionCodes.Simulate] = "calculate",
        [ActionCodes.Override] = "override",
        [ActionCodes.Reopen] = "override"
    };

    /// <summary>أسماء الصلاحيات المعلنة في المواصفة — تُستخدم للتحقق والاختبارات وللعرض.</summary>
    public static IReadOnlyList<string> Catalog { get; } = new[]
    {
        "payroll.view", "payroll.create", "payroll.edit", "payroll.approve",
        "payroll.post", "payroll.pay", "payroll.export", "payroll.calculate", "payroll.override"
    };

    /// <summary>
    /// أقسام إدارة الصلاحيات على مستوى الوحدة (`payroll/view` …) لتظهر في شاشة الأدوار
    /// وتُحفَظ في role_permissions بنفس أعمدة الصلاحيات العادية.
    /// </summary>
    public static IReadOnlyList<ScreenDefinition> ModuleScreens { get; } = new[]
    {
        new ScreenDefinition(PayrollModule, "", "Shield", "screen.payroll_module",
            AppRegistry.GroupEmployeeManagement,
            Catalog.Select(alias => new ScreenAction(
                alias[(PayrollModule.Length + 1)..], $"permission.{alias}")).ToArray(),
            PayrollModule)
    };

    public static bool IsPayrollScreen(string? screenCode) =>
        !string.IsNullOrWhiteSpace(screenCode)
        && screenCode.StartsWith("PAYROLL_", StringComparison.OrdinalIgnoreCase);

    /// <summary>الاسم الموحّد لصلاحية شاشة/فعل، أو null إذا لم تكن للشاشة صلاحية موحّدة.</summary>
    public static string? ForScreenAction(string? screenCode, string? actionCode)
    {
        if (!IsPayrollScreen(screenCode)) return null;
        if (string.IsNullOrWhiteSpace(actionCode)) return null;
        return ActionMap.TryGetValue(actionCode, out var moduleAction)
            ? $"{PayrollModule}.{moduleAction}"
            : null;
    }

    /// <summary>
    /// هل الصلاحية المخزَّنة تمنح الصلاحية المطلوبة عبر التسمية الموحّدة؟
    /// تقبل الشكلين: (payroll, view) و(payroll.view, *) أو (payroll.view, view).
    /// </summary>
    public static bool Matches(PermissionEntry entry, string screenCode, string actionCode)
    {
        var alias = ForScreenAction(screenCode, actionCode);
        if (alias is null) return false;

        var entryScreen = entry.ScreenCode?.Trim() ?? "";
        var entryAction = entry.ActionCode?.Trim() ?? "";

        if (entryScreen.Equals(PayrollModule, StringComparison.OrdinalIgnoreCase))
            return entryAction.Equals("*", StringComparison.Ordinal)
                   || entryAction.Equals(alias[(PayrollModule.Length + 1)..], StringComparison.OrdinalIgnoreCase);

        if (entryScreen.Equals(alias, StringComparison.OrdinalIgnoreCase))
            return entryAction.Length == 0
                   || entryAction.Equals("*", StringComparison.Ordinal)
                   || entryAction.Equals("view", StringComparison.OrdinalIgnoreCase);

        return false;
    }
}
