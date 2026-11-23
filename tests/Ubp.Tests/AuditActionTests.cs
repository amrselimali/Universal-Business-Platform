using Ubp.Application.Services;
using Ubp.Core.Security;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// حراسة قيد audit_log.action (23514): كل فعل يُترجَم إلى قيمة مسموحة قبل الكتابة،
/// فلا تُرفض عمليات التسجيل/الاستحقاق/النسخ بسبب قيمة فعل جديدة.
/// </summary>
public sealed class AuditActionTests
{
    [Theory]
    [InlineData("INSERT")]
    [InlineData("update")]
    [InlineData("DELETE")]
    [InlineData("EXPORT")]
    [InlineData("PASSWORD_RESET")]
    public void AllowedActionsAreKeptAsIs(string action)
    {
        Assert.Equal(action.ToUpperInvariant(), AuditActions.Normalize(action));
        Assert.Contains(action, AuditActions.Allowed, StringComparer.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("REGISTER_BASIC", "INSERT")]
    [InlineData("REGISTER", "INSERT")]
    [InlineData("ACCRUE", "INSERT")]
    [InlineData("COPY", "INSERT")]
    [InlineData("TEMPLATE_APPLY", "INSERT")]
    [InlineData("CALCULATE", "INSERT")]
    [InlineData("CANCEL", "DELETE")]
    [InlineData("REVERSE", "DELETE")]
    [InlineData("APPROVE", "UPDATE")]
    [InlineData("POST", "UPDATE")]
    [InlineData("PAY", "UPDATE")]
    [InlineData("", "UPDATE")]
    public void UnknownActionsMapToAllowedDatabaseValues(string input, string expected)
    {
        Assert.Equal(expected, AuditActions.Normalize(input));
        Assert.Contains(expected, AuditActions.Allowed);
    }

    [Fact]
    public void PayrollWriterMappingNeverProducesUnlistedValues()
    {
        var payrollActions = new[]
        {
            "CALCULATE", "SIMULATE", "IMPORT", "APPROVE", "POST", "PAY", "REOPEN",
            "OVERRIDE", "CLOSE", "COPY", "ACCRUE", "TEMPLATE_APPLY", "REGISTER",
            "REGISTER_BASIC", "ADJUSTMENT_CALCULATE", "DELETE", "INSERT", "CREATE"
        };

        foreach (var action in payrollActions)
        {
            var mapped = PayrollAuditWriter.MapAction(action);
            Assert.Contains(mapped, AuditActions.Allowed);
        }
    }

    [Fact]
    public void DatabaseConstraintValuesMatchTheAllowedSet()
    {
        // القيم أدناه هي نفسها المعلنة في 0095_audit_export_action.sql.
        var constraint = new[]
        {
            "INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "LOGIN_FAILED",
            "PERMISSION_CHANGE", "PASSWORD_RESET", "MIGRATION", "EXPORT"
        };

        Assert.Equal(constraint.OrderBy(x => x), AuditActions.Allowed.OrderBy(x => x));
    }
}
