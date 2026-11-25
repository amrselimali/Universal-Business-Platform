using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Partners;

public partial class PartnerList
{
    [Parameter] public PartnerKind Kind { get; set; } = PartnerKind.Customer;
    [Inject] private PartnerService Partners { get; set; } = default!;
    [Inject] private CustomFieldService CustomFields { get; set; } = default!;
    [Inject] private BranchService Branches { get; set; } = default!;
    [Inject] private IDialogService DialogService { get; set; } = default!;

    private MudTable<Partner> _table = default!;
    private string? _search;
    private Guid? _categoryId;
    private bool _includeInactive;
    private IReadOnlyList<PartnerCategory> _categories = Array.Empty<PartnerCategory>();
    private IReadOnlyList<Branch> _branches = Array.Empty<Branch>();
    /// <summary>فروع فلتر شاشة العملاء — الافتراضي الفروع المصرح بها (المربوطة) للمستخدم.</summary>
    private HashSet<Guid> _branchIds = new();
    /// <summary>حقل «الكود الورقي» المخصص للعميل — يُعرض عمودًا بجوار الكود عند تعريفه.</summary>
    private CustomFieldDefinition? _paperCodeField;

    protected override string ScreenCode => Kind == PartnerKind.Customer ? ScreenCodes.Customers : ScreenCodes.Suppliers;
    private string ScreenTitleKey => Kind == PartnerKind.Customer ? "screen.customers" : "screen.suppliers";

    protected override async Task OnLoadAsync()
    {
        _categories = await Partners.ListCategoriesAsync(Actor!, Kind, false);
        _branches = await Branches.OptionsAsync(Actor!);
        // الافتراضي: الفروع المصرح بها/المربوطة للمستخدم؛ لو لا توجد قيود يبدأ بالمتاح كله.
        var allowed = Actor!.AllowedBranchIds;
        _branchIds = _branches
            .Where(b => Actor.IsSuperAdmin || allowed.Contains(b.Id))
            .Select(b => b.Id).ToHashSet();
        if (_branchIds.Count == 0) _branchIds = _branches.Select(b => b.Id).ToHashSet();
        _paperCodeField = Kind == PartnerKind.Customer
            ? PartnerCustomFieldRules.FindPaperCode(await CustomFields.ListActiveAsync("customers"))
            : null;
    }

    /// <summary>قيمة الكود الورقي المحفوظة في الحقول المخصصة للطرف.</summary>
    private string? PaperCode(Partner partner)
    {
        if (_paperCodeField is null) return null;
        var pair = partner.CustomFields.FirstOrDefault(field =>
            string.Equals(field.Key, _paperCodeField.FieldKey, StringComparison.OrdinalIgnoreCase));
        return CustomFieldText(pair.Value);
    }

    /// <summary>القيمة المخصصة تصل من JSON كـ JsonElement؛ تُحوَّل لنص للعرض فقط.</summary>
    private static string? CustomFieldText(object? value)
    {
        var text = value switch
        {
            null => null,
            System.Text.Json.JsonElement element => element.ValueKind switch
            {
                System.Text.Json.JsonValueKind.String => element.GetString(),
                System.Text.Json.JsonValueKind.Null or System.Text.Json.JsonValueKind.Undefined => null,
                _ => element.ToString()
            },
            _ => value.ToString()
        };
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    private string Name(Partner partner) =>
        T.Language == "en" && !string.IsNullOrWhiteSpace(partner.NameEn) ? partner.NameEn! : partner.NameAr;
    private string CategoryName(PartnerCategory category) =>
        T.Language == "en" && !string.IsNullOrWhiteSpace(category.NameEn) ? category.NameEn! : category.NameAr;

    private async Task<TableData<Partner>> LoadServerData(TableState state, CancellationToken ct)
    {
        var result = await Partners.ListAsync(Actor!, Kind, new PageRequest
        {
            Page = state.Page + 1, PageSize = 25, Search = _search, IncludeInactive = _includeInactive,
            SortBy = state.SortLabel ?? "code", Descending = state.SortDirection == SortDirection.Descending
        }, _categoryId, Kind == PartnerKind.Customer ? _branchIds.ToArray() : null, ct);
        return new TableData<Partner> { Items = result.Items, TotalItems = result.Total };
    }

    private string BranchLabel(Guid id) =>
        _branches.FirstOrDefault(b => b.Id == id)?.NameAr ?? "—";

    private Task OnBranchFilterChanged(IEnumerable<Guid> values)
    {
        _branchIds = values.ToHashSet();
        // حد أدنى فرع واحد: عند إلغاء الكل نعود للفروع المتاحة للمستخدم.
        if (_branchIds.Count == 0) _branchIds = _branches.Select(b => b.Id).ToHashSet();
        return ReloadAsync();
    }

    private async Task ReloadAsync() => await _table.ReloadServerData();
    private async Task OnFilterChanged(bool value) { _includeInactive = value; await ReloadAsync(); }

    private async Task AddAsync()
    {
        var dialog = await DialogService.ShowAsync<PartnerDialog>(T.T("common.add"),
            new DialogParameters { ["Kind"] = Kind });
        if ((await dialog.Result) is { Canceled: false }) { await ReloadAsync(); ShowSuccess("common.saved"); }
    }

    private async Task EditAsync(Partner partner)
    {
        var dialog = await DialogService.ShowAsync<PartnerDialog>(T.T("common.edit"),
            new DialogParameters { ["Kind"] = Kind, ["Model"] = partner });
        if ((await dialog.Result) is { Canceled: false }) { await ReloadAsync(); ShowSuccess("common.saved"); }
    }

    private async Task EditContactAsync(Partner partner)
    {
        var dialog = await DialogService.ShowAsync<PartnerContactDialog>("تعديل بيانات الاتصال",
            new DialogParameters { ["Model"] = partner });
        if ((await dialog.Result) is { Canceled: false }) { await ReloadAsync(); ShowSuccess("common.saved"); }
    }

    /// <summary>
    /// تعديل مباشر لأرصدة العميل الافتتاحية بصلاحية مستقلة: بلا أي أثر محاسبي،
    /// وبمنع البنود التي نُفّذت أو حُصّلت أو حُوّلت أو سُوّيت.
    /// </summary>
    private async Task EditOpeningBalancesAsync(Partner partner)
    {
        var dialog = await DialogService.ShowAsync<PartnerOpeningBalancesDialog>(
            T.T("opening_balances.menu"),
            new DialogParameters { ["Customer"] = partner },
            new DialogOptions { MaxWidth = MaxWidth.ExtraLarge, FullWidth = true });
        await dialog.Result;
    }

    private async Task ManageCategoriesAsync()
    {
        var dialog = await DialogService.ShowAsync<PartnerCategoryDialog>(T.T("partners.categories"),
            new DialogParameters { ["Kind"] = Kind });
        await dialog.Result;
        _categories = await Partners.ListCategoriesAsync(Actor!, Kind, false);
        await ReloadAsync();
    }

    private async Task ToggleAsync(Partner partner, bool value) => await RunAsync(async () =>
    {
        await Partners.SetActiveAsync(Actor!, Kind, partner.Id, value);
        await ReloadAsync();
        ShowSuccess("common.saved");
    });

    private async Task DeleteAsync(Partner partner)
    {
        var confirmed = await DialogService.ShowMessageBoxAsync(T.T("common.confirm_delete"), partner.NameAr,
            yesText: T.T("common.delete"), cancelText: T.T("common.cancel"));
        if (confirmed != true) return;
        await RunAsync(async () =>
        {
            await Partners.DeleteAsync(Actor!, Kind, partner.Id);
            await ReloadAsync();
            ShowSuccess("common.deleted");
        });
    }
}
