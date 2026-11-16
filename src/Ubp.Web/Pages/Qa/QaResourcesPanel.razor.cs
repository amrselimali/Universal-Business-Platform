using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Core.Models;

namespace Ubp.Web.Pages.Qa;

public partial class QaResourcesPanel
{
    [Parameter, EditorRequired] public QaAuditReport Report { get; set; } = new();

    private static Color BarColor(double percent) => percent switch
    {
        >= 90 => Color.Error,
        >= 75 => Color.Warning,
        _ => Color.Success
    };
}
