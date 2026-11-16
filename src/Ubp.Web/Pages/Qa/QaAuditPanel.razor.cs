using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Qa;

/// <summary>لوحة الفحص المباشر: قراءة فقط على قاعدة البيانات الفعلية وعرض مرتب بالأولوية.</summary>
public partial class QaAuditPanel
{
    [Inject] private QaService Qa { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    private QaAuditReport? _report;
    private bool _running;

    private async Task RunAsync()
    {
        _running = true;
        try
        {
            var actor = await UserContext.RequireAsync();
            _report = await Qa.RunLiveAuditAsync(actor);
            var severity = _report.CriticalCount > 0 ? Severity.Error
                : _report.HighCount > 0 ? Severity.Warning : Severity.Success;
            Snackbar.Add($"{T.T("qa.live_score")}: {_report.HealthScore}/100 — " +
                         $"{_report.Findings.Count} {T.T("qa.live_findings")}", severity);
        }
        catch (AppException ex)
        {
            Snackbar.Add(T.T(ex.Code), Severity.Error);
        }
        catch (Exception)
        {
            Snackbar.Add(T.T("error.generic"), Severity.Error);
        }
        finally
        {
            _running = false;
            StateHasChanged();
        }
    }

    private static Color SeverityColor(string severity) => severity switch
    {
        QaSeverity.Critical => Color.Error,
        QaSeverity.High => Color.Warning,
        QaSeverity.Medium => Color.Info,
        QaSeverity.Low => Color.Default,
        _ => Color.Success
    };
}