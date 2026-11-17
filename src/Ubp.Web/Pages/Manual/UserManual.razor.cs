using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Logging;
using Microsoft.JSInterop;
using MudBlazor;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Manual;

public partial class UserManual
{
    [Inject] private IJSRuntime JS { get; set; } = default!;
    [Inject] private UserManualSource Manual { get; set; } = default!;
    [Inject] private UserManualGenerator Generator { get; set; } = default!;
    [Inject] private ManualScreenshotStore Screenshots { get; set; } = default!;
    [Inject] private ILogger<UserManual> Logger { get; set; } = default!;

    private string _html = "";
    private bool _missing;
    private bool _busy;
    private bool _generated;
    private bool _schemaAvailable;
    private bool _sourceAvailable;
    private bool _capturing;
    private int _screenCount;
    private int _buttonCount;
    private int _tableCount;
    private int _tab;
    private string _group = "";
    private string? _search;
    private DateTimeOffset? _updatedAt;
    private List<ManualScreenDoc> _screens = [];
    private List<ManualDialogDoc> _dialogs = [];
    private List<KeyValuePair<string, string>> _groups = [];
    private readonly Dictionary<string, string> _shotUrls = new(StringComparer.OrdinalIgnoreCase);

    protected override string ScreenCode => ScreenCodes.UserManual;

    protected override async Task OnLoadAsync() => await GenerateAsync(force: false);

    private List<ManualScreenDoc> FilteredScreens
    {
        get
        {
            IEnumerable<ManualScreenDoc> query = _screens;
            var term = _search?.Trim();
            if (!string.IsNullOrWhiteSpace(term))
                query = query.Where(screen =>
                    screen.Title.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                    screen.Route.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                    screen.Purpose.Contains(term, StringComparison.OrdinalIgnoreCase));
            else if (!string.IsNullOrWhiteSpace(_group))
                query = query.Where(screen => screen.GroupKey == _group);
            return query.Take(60).ToList();
        }
    }

    private async Task GenerateAsync(bool force)
    {
        _busy = true;
        try
        {
            try
            {
                var generation = await Generator.GenerateAsync(Actor!, force);
                if (!string.IsNullOrWhiteSpace(generation.Markdown))
                {
                    _html = MarkdownRenderer.Render(generation.Markdown);
                    _updatedAt = generation.GeneratedAt;
                    _screenCount = generation.ScreenCount;
                    _buttonCount = generation.ButtonCount;
                    _tableCount = generation.TableCount;
                    _schemaAvailable = generation.SchemaAvailable;
                    _sourceAvailable = generation.SourceAvailable;
                    _screens = generation.Screens.ToList();
                    _dialogs = generation.Dialogs.ToList();
                    BuildGroups();
                    RefreshShots();
                    _generated = true;
                    _missing = false;
                    return;
                }
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "User manual generation failed; falling back to the static copy.");
            }

            var content = await Manual.LoadAsync();
            if (content.IsEmpty)
            {
                _missing = true;
                _html = "";
                _updatedAt = null;
                _screens = [];
                _dialogs = [];
                _groups = [];
                _shotUrls.Clear();
                return;
            }

            _html = MarkdownRenderer.Render(content.Markdown);
            _updatedAt = content.UpdatedAt;
            _generated = false;
            _schemaAvailable = false;
            _sourceAvailable = false;
            _screenCount = AppRegistry.Screens.Count;
            _buttonCount = 0;
            _tableCount = 0;
            _screens = [];
            _dialogs = [];
            _groups = [];
            _shotUrls.Clear();
            _missing = false;
        }
        finally
        {
            _busy = false;
        }
    }

    private void BuildGroups()
    {
        _groups = _screens
            .GroupBy(screen => new { screen.GroupKey, screen.GroupTitle })
            .Select(group => new KeyValuePair<string, string>(group.Key.GroupKey,
                group.Key.GroupTitle))
            .ToList();
        if (_groups.Count > 0 && _groups.All(group => group.Key != _group))
            _group = _groups[0].Key;
    }

    private void RefreshShots()
    {
        _shotUrls.Clear();
        foreach (var screen in _screens)
        {
            var url = Screenshots.UrlFor(Actor!.UserId, screen.Code);
            if (!string.IsNullOrWhiteSpace(url)) _shotUrls[screen.Code] = url;
            foreach (var dialog in DialogsFor(screen))
            {
                var code = DialogCode(screen, dialog);
                var dialogUrl = Screenshots.UrlFor(Actor.UserId, code);
                if (!string.IsNullOrWhiteSpace(dialogUrl)) _shotUrls[code] = dialogUrl;
            }
        }
    }

    private void OnGroupChanged(string value)
    {
        _group = value ?? "";
        StateHasChanged();
    }

    private void OnSearchChanged() => StateHasChanged();

    private async Task CaptureAsync(ManualScreenDoc screen)
    {
        if (_capturing) return;
        _capturing = true;
        StateHasChanged();
        try
        {
            var annotations = ManualScreenshotAnnotations.Build(screen);
            var payload = new
            {
                title = screen.Title,
                subtitle = screen.GroupTitle,
                route = screen.Route,
                annotations = ManualScreenshotAnnotations.ToJsPayload(annotations)
            };
            var result = await JS.InvokeAsync<ManualShotSaveResult>("ubpManual.captureAndSave",
                screen.Code, screen.Route, payload);
            if (result is { Ok: true } && !string.IsNullOrWhiteSpace(result.Url))
            {
                _shotUrls[screen.Code] = result.Url!;
                ShowSuccess("user_manual.captured");
            }
            else
            {
                Logger.LogWarning("Manual screenshot failed for {Code}: {Error}",
                    screen.Code, result?.Error);
                Snackbar.Add(T.T("user_manual.capture_failed"), Severity.Error);
            }
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Manual screenshot failed for {Code}", screen.Code);
            Snackbar.Add(T.T("user_manual.capture_failed"), Severity.Error);
        }
        finally
        {
            _capturing = false;
            StateHasChanged();
        }
    }


    private async Task RefreshAsync() =>
        await RunAsync(async () =>
        {
            await GenerateAsync(force: true);
            if (!_missing) ShowSuccess("user_manual.reloaded");
        });

    private async Task PrintAsync() => await JS.InvokeVoidAsync("print");
}
