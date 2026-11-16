using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Admin;

public partial class Database
{
    [Inject] private DatabaseAdminService DatabaseService { get; set; } = default!;
    [Inject] private IDialogService DialogService { get; set; } = default!;
    [Inject] private IJSRuntime JS { get; set; } = default!;
    [Inject] private DatabaseExportFileStore ExportFiles { get; set; } = default!;

    private DatabaseStatus? _status;
    private string? _tableSearch;
    private bool _busy;
    private bool _exporting;
    private TableExportProgress? _exportProgress;

    protected override string ScreenCode => ScreenCodes.DatabaseAdmin;

    private IEnumerable<TableInfo> FilteredTables =>
        (_status?.Tables ?? Array.Empty<TableInfo>())
        .Where(t => string.IsNullOrWhiteSpace(_tableSearch) ||
                    t.Name.Contains(_tableSearch, StringComparison.OrdinalIgnoreCase))
        .OrderBy(t => t.Name);

    private string ExportStatusText => _exportProgress?.Status switch
    {
        TableExportProgress.Completed => T.T("database.export_completed"),
        TableExportProgress.Failed => T.T("database.export_failed"),
        _ => T.T("database.export_running")
    };

    private Color ExportStatusColor => _exportProgress?.Status switch
    {
        TableExportProgress.Completed => Color.Success,
        TableExportProgress.Failed => Color.Error,
        _ => Color.Info
    };


    protected override async Task OnLoadAsync()
    {
        if (!Actor!.IsSuperAdmin) return;
        _status = await DatabaseService.GetStatusAsync(Actor);
    }

    private async Task RunMigrationsAsync()
    {
        var confirmed = await DialogService.ShowMessageBoxAsync(T.T("database.run_confirm_title"),
            T.T("database.run_confirm"), yesText: T.T("database.run_migrations"),
            cancelText: T.T("common.cancel"));
        if (confirmed != true) return;

        _busy = true;
        await RunAsync(async () =>
        {
            var outcome = await DatabaseService.RunMigrationsAsync(Actor!);
            if (outcome.Success)
            {
                ShowSuccess("database.migrations_done");
                _status = await DatabaseService.GetStatusAsync(Actor!);
            }
            else
            {
                Snackbar.Add(outcome.Error ?? T.T("error.generic"), Severity.Error);
            }
        });
        _busy = false;
    }

    private async Task OpenTableAsync(TableInfo table)
    {
        var dialog = await DialogService.ShowAsync<TableRowsDialog>(table.Name,
            new DialogParameters { ["Table"] = table.Name },
            new DialogOptions { MaxWidth = MaxWidth.ExtraLarge, FullWidth = true });
        await dialog.Result;
        _status = await DatabaseService.GetStatusAsync(Actor!);
    }

    /// <summary>تصدير جدول منفرد إلى Excel بكامل أعمدته وبياناته (بلا الأعمدة الحساسة).</summary>
    private Task ExportTableAsync(TableInfo table) =>
        RunExportAsync((stream, progress) =>
                DatabaseService.ExportTableAsync(Actor!, table.Name, stream, progress),
            ActionCodes.ExportTable, 1);

    /// <summary>تصدير كل جداول قاعدة البيانات في ملف Excel واحد بورقة لكل جدول.</summary>
    private Task ExportDatabaseAsync() =>
        RunExportAsync((stream, progress) =>
                DatabaseService.ExportDatabaseAsync(Actor!, stream, progress),
            ActionCodes.ExportDatabase, _status?.Tables.Count ?? 0);

    private async Task RunExportAsync(
        Func<Stream, Func<TableExportProgress, Task>, Task<TableExportResult>> export,
        string permissionAction, int tablesTotal)
    {
        if (_exporting) return;
        _exporting = true;
        _busy = true;
        _exportProgress = new TableExportProgress(0, 0, tablesTotal, string.Empty,
            TableExportProgress.Running);
        var path = ExportFiles.NewFilePath();

        try
        {
            TableExportResult result;
            await using (var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write,
                             FileShare.None, 64 * 1024, FileOptions.Asynchronous))
            {
                result = await export(stream, ReportExportProgressAsync);
            }

            var token = ExportFiles.Register(path, result.FileName, Actor!.UserId,
                permissionAction);
            await JS.InvokeVoidAsync("ubpExports.download",
                $"/api/v1/admin/database/export/download/{token}", result.FileName);
            _exportProgress = _exportProgress with
            {
                Percent = 100,
                TablesDone = result.TablesExported,
                TablesTotal = result.TablesExported,
                CurrentTable = string.Empty,
                Status = TableExportProgress.Completed
            };
            ShowSuccess("database.export_ready");
            if (result.TruncatedTables.Count > 0)
                Snackbar.Add(T.T("database.export_truncated"), Severity.Warning);
        }
        catch (OperationCanceledException)
        {
            TryDelete(path);
            _exportProgress = _exportProgress with { Status = TableExportProgress.Failed };
            Snackbar.Add(T.T("database.export_failed"), Severity.Warning);
        }
        catch (AppException ex)
        {
            TryDelete(path);
            _exportProgress = _exportProgress with { Status = TableExportProgress.Failed };
            ShowError(ex);
        }
        catch (Exception)
        {
            TryDelete(path);
            _exportProgress = _exportProgress with { Status = TableExportProgress.Failed };
            Snackbar.Add(T.T("error.generic"), Severity.Error);
        }
        finally
        {
            _exporting = false;
            _busy = false;
        }
    }

    private async Task ReportExportProgressAsync(TableExportProgress progress)
    {
        _exportProgress = progress;
        await InvokeAsync(StateHasChanged);
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    /// <summary>فتح نافذة اختيار جداول ومسح بيانات المحدد فقط.</summary>
    private async Task ClearTablesAsync()
    {
        if (_status is null) return;
        var dialog = await DialogService.ShowAsync<ClearTablesDialog>("مسح بيانات جداول مُحددة",
            new DialogParameters { ["Tables"] = _status.Tables },
            new DialogOptions { MaxWidth = MaxWidth.Large, FullWidth = true });
        var result = await dialog.Result;
        if (result is { Canceled: false })
        {
            _status = await DatabaseService.GetStatusAsync(Actor!);
            ShowSuccess("common.saved");
        }
    }
}
