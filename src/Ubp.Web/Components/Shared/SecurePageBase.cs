using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Web.Services;

namespace Ubp.Web.Components.Shared;

public abstract class SecurePageBase : ComponentBase
{
    [Inject] protected UserContext UserContext { get; set; } = default!;
    [Inject] protected PermissionService PermissionService { get; set; } = default!;
    [Inject] protected UiCulture T { get; set; } = default!;
    [Inject] protected NavigationManager Navigation { get; set; } = default!;
    [Inject] protected ISnackbar Snackbar { get; set; } = default!;
    /// <summary>عرض/تكوين التواريخ بتوقيت الإعدادات (الحاوية تعمل UTC) — لا تستخدم DateTime.Today.</summary>
    [Inject] protected IDisplayFormatter Fmt { get; set; } = default!;

    protected ActorContext? Actor { get; private set; }
    protected bool Denied { get; private set; }
    protected bool Loading { get; private set; } = true;
    private IReadOnlyDictionary<string, EffectivePermission>? _snapshot;

    protected abstract string ScreenCode { get; }
    protected virtual string RequiredAction => ActionCodes.View;

    /// <summary>أفعال الدخول المقبولة: الافتراضي فعل واحد، ويمكن لصفحة أن تقبل فعلاً بديلاً (مثل VIEW_BASIC).</summary>
    protected virtual IReadOnlyList<string> RequiredActions => new[] { RequiredAction };

    protected override async Task OnInitializedAsync()
    {
        try
        {
            Actor = await UserContext.GetAsync();
            if (Actor is null)
            {
                Navigation.NavigateTo("/login?expired=1", forceLoad: true);
                return;
            }

            _snapshot = await PermissionService.GetSnapshotAsync(Actor.UserId, Actor.IsAdmin);
            if (!RequiredActions.Any(Can))
            {
                Denied = true;
                return;
            }

            await OnLoadAsync();
        }
        catch (AppException ex)
        {
            ShowError(ex);
        }
        catch (Exception ex)
        {
            var msg = string.IsNullOrWhiteSpace(ex.Message) ? T.T("error.generic") : ex.Message;
            Snackbar.Add(msg, Severity.Error);
        }
        finally
        {
            Loading = false;
            StateHasChanged();
        }
    }

    protected abstract Task OnLoadAsync();

    protected bool Can(string action) =>
        _snapshot is not null &&
        _snapshot.TryGetValue($"{ScreenCode}/{action}", out var permission) &&
        permission.Allowed;

    protected short ScopeOf(string action) =>
        _snapshot is not null &&
        _snapshot.TryGetValue($"{ScreenCode}/{action}", out var permission) && permission.Allowed
            ? permission.Scope
            : (short)-1;

    protected async Task RunAsync(Func<Task> action)
    {
        try
        {
            await action();
            StateHasChanged();
        }
        catch (AppException ex)
        {
            ShowError(ex);
        }
        catch (Exception ex)
        {
            var msg = string.IsNullOrWhiteSpace(ex.Message) ? T.T("error.generic") : ex.Message;
            Snackbar.Add(msg, Severity.Error);
        }
    }

    protected void ShowSuccess(string key) => Snackbar.Add(T.T(key), Severity.Success);

    protected void ShowError(AppException ex)
    {
        var text = T.T(ex.Code);
        foreach (var arg in ex.Args)
            text = text.Replace("{" + arg.Key + "}", arg.Value);
        if (ex is ConflictException) text += " — " + T.T("error.reload_hint");
        Snackbar.Add(text, Severity.Error);
    }
}