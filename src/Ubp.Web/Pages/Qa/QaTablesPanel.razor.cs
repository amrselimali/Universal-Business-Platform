using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Core.Models;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Qa;

public partial class QaTablesPanel
{
    [Parameter, EditorRequired] public QaAuditReport Report { get; set; } = new();
    [Inject] private UiCulture T { get; set; } = default!;

    private static Color HealthColor(string health) => health switch
    {
        "critical" => Color.Error,
        "attention" => Color.Warning,
        _ => Color.Success
    };

    private static Color StatusColor(string status) => status switch
    {
        "ok" => Color.Success,
        "critical" => Color.Error,
        _ => Color.Warning
    };

    private string HealthLabel(string health) => health switch
    {
        "critical" => T.T("qa.live_health_critical"),
        "attention" => T.T("qa.live_health_attention"),
        _ => T.T("qa.live_health_ok")
    };
}
