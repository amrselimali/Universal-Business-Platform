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
    [Inject] private IDialogService DialogService { get; set; } = default!;

    private IReadOnlyList<QaMatrixRow> _matrix = Array.Empty<QaMatrixRow>();
    private IReadOnlyList<QaRunSummary> _runs = Array.Empty<QaRunSummary>();
    private readonly HashSet<string> _selected = new(StringComparer.OrdinalIgnoreCase);
    private QaAuditReport? _report;
    private bool _running;

    protected override string ScreenCode => ScreenCodes.QaCenter;

    protected override async Task OnLoadAsync()
    {
        _matrix = await Qa.GetMatrixAsync(Actor!);
        _runs = await Qa.GetRunsAsync(Actor!);
    }

    private void Toggle(string code, bool selected)
    {
        if (selected) _selected.Add(code); else _selected.Remove(code);
    }

    private async Task RunAllAsync() => await ExecuteRunAsync(Array.Empty<string>());
    private async Task RunSelectedAsync() => await ExecuteRunAsync(_selected.ToList());

    private async Task ExecuteRunAsync(IReadOnlyList<string> codes)
    {
        _running = true;
        StateHasChanged();
        await RunAsync(async () =>
        {
            var summary = await Qa.RunAsync(Actor!, codes);
            _matrix = await Qa.GetMatrixAsync(Actor!);
            _runs = await Qa.GetRunsAsync(Actor!);
            _selected.Clear();
            Snackbar.Add($"{T.T("qa.run_done")}: {summary.PassedCount} / {summary.TotalCount}",
                summary.FailedCount == 0 ? Severity.Success : Severity.Warning);
        });
        _running = false;
        StateHasChanged();
    }

    /// <summary>الفحص الشامل: اختبارات أساسية + فحص مباشر على قاعدة البيانات الحقيقية.</summary>
    private async Task RunFullAsync()
    {
        _running = true;
        StateHasChanged();
        try
        {
            _report = await Qa.RunFullAuditAsync(Actor!);
            _matrix = await Qa.GetMatrixAsync(Actor!);
            _runs = await Qa.GetRunsAsync(Actor!);
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

    private async Task ShowResultsAsync(QaRunSummary run) =>
        await DialogService.ShowAsync<QaResultsDialog>(T.T("qa.results"),
            new DialogParameters { ["Run"] = run },
            new DialogOptions { MaxWidth = MaxWidth.Medium, FullWidth = true });
}