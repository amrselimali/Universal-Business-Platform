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

    private QaAuditReport? _report;
    private bool _running;

    protected override string ScreenCode => ScreenCodes.QaCenter;

    protected override Task OnLoadAsync() => Task.CompletedTask;

    private async Task RunFullAsync()
    {
        _running = true;
        try
        {
            _report = await Qa.RunFullAuditAsync(Actor!);
            var severity = _report.FailedTests == 0 ? Severity.Success : Severity.Warning;
            Snackbar.Add($"{T.T("qa.run_done")}: {_report.PassedTests}/{_report.Tests.Count}",
                severity);
        }
        catch (AppException ex)
        {
            ShowError(ex);
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
}
