using Microsoft.JSInterop;
using MudBlazor;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Manual;

public partial class UserManual
{
    private IReadOnlyList<ManualDialogDoc> DialogsFor(ManualScreenDoc screen) =>
        _dialogs.Where(dialog => TriggerPathFor(screen, dialog).Count > 0)
            .Take(8)
            .ToList();

    private static List<ManualButtonDoc> DirectTriggers(ManualScreenDoc screen,
        ManualDialogDoc dialog) => screen.Buttons.Where(button =>
            button.DialogNames.Contains(dialog.Name, StringComparer.OrdinalIgnoreCase) ||
            button.Appears.Contains($"**{dialog.Name}**", StringComparison.Ordinal) ||
            button.Appears.Contains($"**{DialogTitle(dialog)}**", StringComparison.Ordinal)).ToList();

    private IReadOnlyList<string> TriggerPathFor(ManualScreenDoc screen, ManualDialogDoc dialog) =>
        TriggerPathFor(screen, dialog, new HashSet<string>(StringComparer.OrdinalIgnoreCase)) ?? [];

    private List<string>? TriggerPathFor(ManualScreenDoc screen, ManualDialogDoc dialog,
        HashSet<string> path)
    {
        if (!path.Add(dialog.Name)) return null;
        try
        {
            var direct = DirectTriggers(screen, dialog);
            if (direct.Count > 0)
            {
                var preferred = direct.FirstOrDefault(button =>
                    button.Label.Contains("إضافة") || button.Label.Contains("جديد") ||
                    button.Label.Contains("Add", StringComparison.OrdinalIgnoreCase) ||
                    button.Label.Contains("Create", StringComparison.OrdinalIgnoreCase))
                    ?? direct[0];
                return [preferred.Label];
            }

            foreach (var parent in _dialogs)
            {
                var childButton = parent.Buttons.FirstOrDefault(button =>
                    button.DialogNames.Contains(dialog.Name, StringComparer.OrdinalIgnoreCase));
                if (childButton is null) continue;
                var parentPath = TriggerPathFor(screen, parent, path);
                if (parentPath is null) continue;
                parentPath.Add(childButton.Label);
                return parentPath;
            }
            return null;
        }
        finally
        {
            path.Remove(dialog.Name);
        }
    }

    private static string DialogTitle(ManualDialogDoc dialog) =>
        string.IsNullOrWhiteSpace(dialog.DisplayName) ? dialog.Name : dialog.DisplayName;

    private static string DialogCode(ManualScreenDoc screen, ManualDialogDoc dialog)
    {
        var raw = $"{screen.Code}_{dialog.Name}".ToUpperInvariant();
        var chars = raw.Select(ch =>
            ch is >= 'A' and <= 'Z' or >= '0' and <= '9' ? ch : '_').ToArray();
        var code = new string(chars).Trim('_');
        return code.Length <= 80 ? code : code[..80];
    }


    private async Task CaptureDialogAsync(ManualScreenDoc screen, ManualDialogDoc dialog)
    {
        if (_capturing) return;
        var triggerPath = TriggerPathFor(screen, dialog);
        if (triggerPath.Count == 0)
        {
            Snackbar.Add(T.T("user_manual.dialog_trigger_missing"), Severity.Warning);
            return;
        }
        var code = DialogCode(screen, dialog);
        _capturing = true;
        StateHasChanged();
        try
        {
            var payload = new
            {
                title = $"{DialogTitle(dialog)} — {screen.Title}",
                subtitle = $"نافذة تفتح من شاشة {screen.Title}",
                route = screen.Route,
                annotations = ManualScreenshotAnnotations.ToJsPayload(
                    ManualDialogAnnotations.Build(dialog))
            };
            var result = await JS.InvokeAsync<ManualShotSaveResult>(
                "ubpManual.captureDialogAndSave", code, screen.Route, triggerPath, payload);
            if (result is { Ok: true } && !string.IsNullOrWhiteSpace(result.Url))
            {
                _shotUrls[code] = result.Url!;
                ShowSuccess("user_manual.dialog_captured");
            }
            else
            {
                var error = result?.Error ?? "";
                Logger.LogWarning("Dialog screenshot failed for {Code}: {Error}", code, error);
                var key = error.StartsWith("trigger_not_found", StringComparison.Ordinal)
                    ? "user_manual.dialog_trigger_missing"
                    : error == "dialog_not_found"
                        ? "user_manual.dialog_not_found"
                        : "user_manual.capture_failed";
                Snackbar.Add(T.T(key), key == "user_manual.capture_failed"
                    ? Severity.Error : Severity.Warning);
            }
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Dialog screenshot failed for {Code}", code);
            Snackbar.Add(T.T("user_manual.capture_failed"), Severity.Error);
        }
        finally
        {
            _capturing = false;
            StateHasChanged();
        }
    }

    private Task DeleteAsync(ManualScreenDoc screen) => DeleteShotAsync(screen.Code);

    private async Task DeleteShotAsync(string code)
    {
        if (_capturing) return;
        _capturing = true;
        StateHasChanged();
        try
        {
            var result = await JS.InvokeAsync<ManualShotSaveResult>("ubpManual.remove", code);
            if (result is { Ok: true })
            {
                _shotUrls.Remove(code);
                ShowSuccess("user_manual.shot_deleted");
            }
            else
            {
                Snackbar.Add(T.T("user_manual.capture_failed"), Severity.Error);
            }
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Manual screenshot delete failed for {Code}", code);
            Snackbar.Add(T.T("user_manual.capture_failed"), Severity.Error);
        }
        finally
        {
            _capturing = false;
            StateHasChanged();
        }
    }
}
