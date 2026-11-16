using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Qa;

public partial class Index
{
    [Inject] private QaService Qa { get; set; } = default!;

    private IReadOnlyList<QaMatrixRow> _matrix = Array.Empty<QaMatrixRow>();
    private QaAuditReport? _report;
    private bool _running;

    protected override string ScreenCode => ScreenCodes.QaCenter;

    protected override async Task OnLoadAsync()
    {
        _matrix = await Qa.GetMatrixAsync(Actor!);
    }

    /// <summary>زر واحد: الفحص الشامل (اختبارات أساسية + فحص مباشر + فحوص ذكية).</summary>
    private async Task RunFullAsync()
    {
        _running = true;
        StateHasChanged();
        try
        {
            _report = await Qa.RunFullAuditAsync(Actor!);
            _matrix = await Qa.GetMatrixAsync(Actor!);
            Snackbar.Add($"{T.T("qa.run_done")}: {_report.PassedTests}/{_report.Tests.Count}",
                _report.FailedTests == 0 ? Severity.Success : Severity.Warning);
        }
        catch (AppException ex) { ShowError(ex); }
        catch (Exception) { Snackbar.Add(T.T("error.generic"), Severity.Error); }
        finally
        {
            _running = false;
            StateHasChanged();
        }
    }

    private static Color StatusColor(string status) => status switch
    {
        "Passed" or "Completed" or "ok" => Color.Success,
        "Failed" or "Error" or "critical" => Color.Error,
        "Blocked" or "attention" or "Skipped" => Color.Warning,
        "Running" => Color.Info,
        _ => Color.Default
    };

    private static Color CriticalityColor(string criticality) => criticality switch
    {
        "critical" => Color.Error,
        "high" => Color.Warning,
        "medium" => Color.Info,
        _ => Color.Default
    };
}
