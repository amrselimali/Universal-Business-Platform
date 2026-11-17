using Microsoft.JSInterop;
using MudBlazor;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Manual;

public partial class UserManual
{
    private IReadOnlyList<ManualDialogDoc> DialogsFor(ManualScreenDoc screen) =>
        _dialogs.Where(dialog => screen.Buttons.Any(button =>
                button.DialogNames.Contains(dialog.Name, StringComparer.OrdinalIgnoreCase) ||
                button.Appears.Contains($"**{dialog.Name}**", StringComparison.Ordinal) ||
                button.Appears.Contains($"**{DialogTitle(dialog)}**", StringComparison.Ordinal)))
            .Take(8)
            .ToList();

    private static string? TriggerFor(ManualScreenDoc screen, ManualDialogDoc dialog)
    {
        var triggers = screen.Buttons.Where(button =>
            button.DialogNames.Contains(dialog.Name, StringComparer.OrdinalIgnoreCase) ||
            button.Appears.Contains($"**{dialog.Name}**", StringComparison.Ordinal) ||
            button.Appears.Contains($"**{DialogTitle(dialog)}**", StringComparison.Ordinal)).ToList();
        var preferred = triggers.FirstOrDefault(button =>
            button.Label.Contains("إضافة") || button.Label.Contains("جديد") ||
            button.Label.Contains("Add", StringComparison.OrdinalIgnoreCase) ||
            button.Label.Contains("Create", StringComparison.OrdinalIgnoreCase));
        return (preferred ?? triggers.FirstOrDefault())?.Label;
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
        var trigger = TriggerFor(screen, dialog);
        if (string.IsNullOrWhiteSpace(trigger))
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
                route = screen.Route,
                annotations = ManualScreenshotAnnotations.ToJsPayload(
                    ManualDialogAnnotations.Build(dialog))
            };
            var result = await JS.InvokeAsync<ManualShotSaveResult>(
                "ubpManual.captureDialogAndSave", code, screen.Route, trigger, payload);
            if (result is { Ok: true } && !string.IsNullOrWhiteSpace(result.Url))
            {
                _shotUrls[code] = result.Url!;
                ShowSuccess("user_manual.dialog_captured");
            }
            else
            {
                Logger.LogWarning("Dialog screenshot failed for {Code}: {Error}", code, result?.Error);
                Snackbar.Add(T.T(result?.Error == "trigger_not_found"
                        ? "user_manual.dialog_trigger_missing"
                        : "user_manual.capture_failed"),
                    result?.Error == "trigger_not_found" ? Severity.Warning : Severity.Error);
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
