using System.Text.Json;
using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Web.Services;

namespace Ubp.Web.Pages.Admin;

/// <summary>
/// استعراض بيانات جدول حقيقية للقراءة فقط: أسماء الأعمدة كما في قاعدة البيانات،
/// بحث خادمي، صفحات وحجم صفحة قابل للتحديد، وإجمالي السجلات. لا تعديل ولا حذف من هنا.
/// </summary>
public partial class TableRowsDialog
{
    [CascadingParameter] private IMudDialogInstance MudDialog { get; set; } = default!;
    [Parameter, EditorRequired] public string Table { get; set; } = "";
    [Inject] private DatabaseAdminService DatabaseService { get; set; } = default!;
    [Inject] private UserContext UserContext { get; set; } = default!;
    [Inject] private UiCulture T { get; set; } = default!;

    private static readonly int[] PageSizes = { 10, 25, 50, 100, 250 };

    private IReadOnlyList<ColumnInfo> _columns = Array.Empty<ColumnInfo>();
    private List<TableRow> _rows = new();
    private long _total;
    private int _page = 1;
    private int _pageSize = 25;
    private string? _search;
    private string? _error;
    private bool _loading = true;
    private int _version;

    private long TotalPages => Math.Max(1, (long)Math.Ceiling((double)_total / _pageSize));

    protected override Task OnInitializedAsync() => LoadAsync();

    private async Task OnSearchChangedAsync(string? value)
    {
        _search = value;
        _page = 1;
        await LoadAsync();
    }

    private async Task OnPageSizeChangedAsync(int size)
    {
        _pageSize = size is < 1 or > 500 ? 25 : size;
        _page = 1;
        await LoadAsync();
    }

    private async Task LoadAsync()
    {
        var version = ++_version;
        _loading = true;
        _error = null;
        try
        {
            var actor = await UserContext.RequireAsync();
            var data = await DatabaseService.GetRowsPageAsync(actor, Table, _page, _pageSize,
                _search);
            if (version != _version) return;
            _columns = data.Columns;
            _rows = ParseRows(data.RowsJson, data.Columns);
            _total = data.Total;
            _page = data.Page;
        }
        catch (AppException ex)
        {
            if (version == _version) _error = T.T(ex.Code);
        }
        catch (Exception)
        {
            if (version == _version) _error = T.T("error.generic");
        }
        finally
        {
            if (version == _version) _loading = false;
        }
    }

    private async Task FirstAsync()
    {
        if (_page <= 1) return;
        _page = 1;
        await LoadAsync();
    }

    private async Task PrevAsync()
    {
        if (_page <= 1) return;
        _page--;
        await LoadAsync();
    }

    private async Task NextAsync()
    {
        if (_page >= TotalPages) return;
        _page++;
        await LoadAsync();
    }

    private async Task LastAsync()
    {
        if (_page >= TotalPages) return;
        _page = (int)Math.Min(int.MaxValue, TotalPages);
        await LoadAsync();
    }

    private static List<TableRow> ParseRows(IReadOnlyList<string> rowsJson,
        IReadOnlyList<ColumnInfo> columns)
    {
        var rows = new List<TableRow>(rowsJson.Count);
        foreach (var json in rowsJson)
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var cells = new List<string>(columns.Count);
            foreach (var column in columns)
            {
                cells.Add(root.TryGetProperty(column.Name, out var value)
                    ? Format(value)
                    : string.Empty);
            }
            rows.Add(new TableRow(cells));
        }
        return rows;
    }

    private static string Format(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
        JsonValueKind.String => value.GetString() ?? string.Empty,
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        _ => value.GetRawText()
    };

    private void Close() => MudDialog.Close();

    private sealed record TableRow(IReadOnlyList<string> Cells);
}
