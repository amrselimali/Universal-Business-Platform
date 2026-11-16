using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Core.Models;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Qa;

public partial class QaAuditPanel
{
    [Parameter] public QaAuditReport? Report { get; set; }
    [Parameter] public bool Running { get; set; }
    [Inject] private UiCulture T { get; set; } = default!;

    private Severity IsolationSeverity =>
        Report?.IsolationVerified == true ? Severity.Success : Severity.Warning;

    private string ScoreIcon => Report is null || Report.HealthScore >= 85
        ? Icons.Material.Filled.Verified : Report.HealthScore >= 60
            ? Icons.Material.Filled.Warning
            : Icons.Material.Filled.Dangerous;

    private static Color SeverityColor(string severity) => severity switch
    {
        QaSeverity.Critical => Color.Error,
        QaSeverity.High => Color.Warning,
        QaSeverity.Medium => Color.Info,
        QaSeverity.Low => Color.Default,
        _ => Color.Success
    };

    private static Color StatusColor(string status) => status switch
    {
        "Passed" or "ok" => Color.Success,
        "Failed" or "critical" => Color.Error,
        "attention" or "Skipped" => Color.Warning,
        _ => Color.Default
    };
}
