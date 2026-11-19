using Microsoft.AspNetCore.Components;
using MudBlazor;
using Ubp.Application.Services;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;

namespace Ubp.Web.Pages.Expenses;

public partial class OperatingExpenses
{
    [Inject] private BranchService BranchApi { get; set; } = default!;
    [Inject] private PurchaseReturnService PurchaseReturns { get; set; } = default!;

    private IReadOnlyList<OperatingExpense> _items = Array.Empty<OperatingExpense>();
    private IReadOnlyList<PurchaseReturn> _returns = Array.Empty<PurchaseReturn>();
    private IReadOnlyList<Branch> _branches = Array.Empty<Branch>();
    private Guid? _branchId;
    private DateTime? _from;
    private DateTime? _to;
    private string? _status;
    private bool _busy;

    protected override string ScreenCode => ScreenCodes.OperatingExpenses;

    protected override async Task OnLoadAsync()
    {
        _branches = await BranchApi.OptionsAsync(Actor!);
        _branchId = Actor!.CurrentBranchId ?? _branches.FirstOrDefault()?.Id;
        _items = await Expenses.ListAsync(Actor!, _branchId, null, _from, _to, _status);
        _returns = await PurchaseReturns.ListAsync(Actor!, _branchId, null, null);
    }

    private async Task ReloadAsync() =>
        await RunAsync(async () =>
        {
            _items = await Expenses.ListAsync(Actor!, _branchId, null, _from, _to, _status);
            _returns = await PurchaseReturns.ListAsync(Actor!, _branchId, null, null);
        });

    private async Task OnBranchChanged(Guid? branchId)
    {
        _branchId = branchId;
        await ReloadAsync();
    }

    private string BranchLabel(Guid? id) =>
        id is null ? "—" : _branches.FirstOrDefault(b => b.Id == id)?.NameAr ?? "—";

    private async Task OnStatusChanged(string? status)
    {
        _status = status;
        await ReloadAsync();
    }

    private async Task AddAsync() => await RunAsync(async () =>
    {
        if (_busy) return;
        _busy = true;
        try
        {
            var dialog = await Dialogs.ShowAsync<OperatingExpenseDialog>(
                T.T("expenses.new"), new DialogParameters
                {
                    ["BranchId"] = _branchId ?? Actor!.CurrentBranchId
                }, new DialogOptions { MaxWidth = MaxWidth.Large, FullWidth = true });

            if ((await dialog.Result) is { Canceled: false })
            {
                await ReloadAsync();
                ShowSuccess("expenses.saved");
            }
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    /// <summary>تسليم نقدية من خزينة إلى حساب وسيط لنقدية الفرع (0080).</summary>
    private async Task AddReturnAsync() => await RunAsync(async () =>
    {
        if (_busy) return;
        var branchId = _branchId ?? Actor!.CurrentBranchId;
        if (branchId is null) return;

        _busy = true;
        try
        {
            var dialog = await Dialogs.ShowAsync<PurchaseReturnDialog>("مرتجع مشتريات",
                new DialogParameters { ["BranchId"] = branchId.Value },
                new DialogOptions { MaxWidth = MaxWidth.Large, FullWidth = true });

            if ((await dialog.Result) is { Canceled: false })
            {
                await ReloadAsync();
                ShowSuccess("common.saved");
            }
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    private async Task HandoverAsync() => await RunAsync(async () =>
    {
        if (_busy) return;
        var branchId = _branchId ?? Actor!.CurrentBranchId;
        if (branchId is null) return;

        _busy = true;
        try
        {
            var dialog = await Dialogs.ShowAsync<CashHandoverDialog>(T.T("expenses.cash_handover"),
                new DialogParameters { ["BranchId"] = branchId.Value });

            if ((await dialog.Result) is { Canceled: false })
            {
                await ReloadAsync();
                ShowSuccess("common.saved");
            }
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    /// <summary>صرف سلفة لموظف على حساب مختار من المصروفات التشغيلية (0084).</summary>
    private async Task AdvanceAsync() => await RunAsync(async () =>
    {
        if (_busy) return;
        var branchId = _branchId ?? Actor!.CurrentBranchId;
        if (branchId is null) return;

        _busy = true;
        try
        {
            var dialog = await Dialogs.ShowAsync<EmployeeAdvanceDialog>("صرف سلفة لموظف",
                new DialogParameters { ["BranchId"] = branchId.Value });

            if ((await dialog.Result) is { Canceled: false })
            {
                await ReloadAsync();
                ShowSuccess("common.saved");
            }
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    /// <summary>
    /// تحويل صنف من الفرع المحدد إلى فرع آخر كمسودة مخزون، فتظهر حركته في
    /// كارت الصنف بفرع المصدر (صادر) وفرع الوجهة (داخل) قبل الترحيل.
    /// </summary>
    private async Task TransferAsync() => await RunAsync(async () =>
    {
        if (_busy) return;
        var branchId = _branchId ?? Actor!.CurrentBranchId;
        if (branchId is null) return;

        _busy = true;
        try
        {
            var dialog = await Dialogs.ShowAsync<BranchItemTransferDialog>(
                T.T("expenses.item_transfer"), new DialogParameters { ["BranchId"] = branchId.Value },
                new DialogOptions { MaxWidth = MaxWidth.Medium, FullWidth = true });

            if ((await dialog.Result) is { Canceled: false })
            {
                await ReloadAsync();
                ShowSuccess("expenses.transfer_saved");
            }
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    private async Task PostAsync(OperatingExpense expense) => await RunAsync(async () =>
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await Expenses.PostAsync(Actor!, expense.Id);
            await ReloadAsync();
            ShowSuccess("expenses.posted");
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    private async Task DeleteAsync(OperatingExpense expense) => await RunAsync(async () =>
    {
        if (_busy) return;
        _busy = true;
        try
        {
            var confirmed = await Dialogs.ShowMessageBoxAsync(T.T("common.confirm_delete"),
                $"{expense.DocNo ?? expense.DocDate.ToString("yyyy-MM-dd")} — {expense.TotalAmount:N2}",
                yesText: T.T("common.delete"), cancelText: T.T("common.cancel"));
            if (confirmed != true) return;

            await Expenses.DeleteAsync(Actor!, expense.Id);
            await ReloadAsync();
            ShowSuccess("common.deleted");
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });

    /// <summary>
    /// فتح حوار تعديل المصروف للمسودة فقط
    /// </summary>
    /// <param name="expenseId">معرف المصروف</param>
    private async Task EditAsync(Guid expenseId) => await RunAsync(async () =>
    {
        if (_busy) return;
        _busy = true;
        try
        {
            var expense = await Expenses.GetAsync(Actor!, expenseId);

            // TODO: هنا يمكنك إضافة فحص إن كان الشفت مفتوح من عدمه باستخدام ShiftService
            // مثال: var isShiftOpen = await _shiftService.IsShiftOpenAsync(expense.BranchId);

            var dialog = await Dialogs.ShowAsync<OperatingExpenseDialog>("تعديل مصروف تشغيلي",
                new DialogParameters { ["BranchId"] = expense.BranchId, ["ExpenseId"] = expenseId },
                new DialogOptions { MaxWidth = MaxWidth.Large, FullWidth = true });

            if ((await dialog.Result) is { Canceled: false })
            {
                await ReloadAsync();
                ShowSuccess("expenses.saved");
            }
        }
        finally
        {
            _busy = false;
            await InvokeAsync(StateHasChanged);
        }
    });
}