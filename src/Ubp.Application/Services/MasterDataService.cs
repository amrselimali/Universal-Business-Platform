using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>البيانات الأساسية للمرحلة 4A-1: الموظفون، الضرائب، شروط الدفع، قوائم الأسعار.</summary>
public sealed partial class MasterDataService
{
    private readonly IEmployeeRepository _employees;
    private readonly ITaxRepository _taxes;
    private readonly IPaymentTermRepository _terms;
    private readonly IPriceListRepository _priceLists;
    private readonly IRoleRepository _roles;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;

    public MasterDataService(IEmployeeRepository employees, ITaxRepository taxes,
        IPaymentTermRepository terms, IPriceListRepository priceLists, IRoleRepository roles,
        PermissionService permissions, AuditService audit)
    {
        _employees = employees; _taxes = taxes; _terms = terms; _priceLists = priceLists;
        _roles = roles; _permissions = permissions; _audit = audit;
    }

    // ---------------- الموظفون (D8/D9) ----------------
    public async Task<PagedResult<Employee>> ListEmployeesAsync(ActorContext actor,
        PageRequest request, bool includeInactive, IReadOnlyCollection<Guid>? branchIds = null,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Employees, ActionCodes.View, ct: ct);
        var scope = actor.IsSuperAdmin
            ? (branchIds is { Count: > 0 } ? branchIds.ToArray() : Array.Empty<Guid>())
            : (branchIds is { Count: > 0 }
                ? branchIds.Where(actor.AllowedBranchIds.Contains).ToArray()
                : actor.AllowedBranchIds.ToArray());
        return await _employees.ListAsync(request, includeInactive, scope, ct);
    }

    public async Task<IReadOnlyList<Employee>> EmployeeOptionsAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        var allowed = await _permissions.HasAsync(actor, ScreenCodes.Employees, ActionCodes.View,
                          ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.SalesBookings,
                          ActionCodes.View, ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.SalesAppointments,
                          ActionCodes.View, ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.Reservations,
                          ActionCodes.View, ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.PosTerminal,
                          ActionCodes.View, ct);
        if (!allowed) throw new ForbiddenException();
        // موظفو الفروع المفعّلة للمستخدم + موظفو الشركة (branch_id NULL) — 0094.
        return await EmployeeOptionsForBranchesAsync(actor, null, ct);
    }

    /// <summary>
    /// موظفون للاختيار: فروع محددة (أو كل فروع المستخدم المعروضة عند عدم التحديد) + موظفو الشركة.
    /// المدير الأعلى يرى الجميع.
    /// </summary>
    public async Task<IReadOnlyList<Employee>> EmployeeOptionsForBranchesAsync(ActorContext actor,
        IReadOnlyCollection<Guid>? branchIds, CancellationToken ct = default)
    {
        if (actor.IsSuperAdmin && branchIds is not { Count: > 0 })
            return await _employees.ListOptionsAsync(ct);
        var scope = branchIds is { Count: > 0 }
            ? branchIds.Where(actor.AllowedBranchIds.Contains).Distinct().ToArray()
            : actor.AllowedBranchIds;
        return await _employees.ListOptionsAsync(scope, false, ct);
    }

    /// <summary>الأدوار المتاحة للموظف (دور إداري/استقبال حجوزات...).</summary>
    public async Task<IReadOnlyList<Role>> EmployeeRoleOptionsAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        var allowed = await _permissions.HasAsync(actor, ScreenCodes.Employees, ActionCodes.View,
                          ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.Users, ActionCodes.View, ct);
        if (!allowed) throw new ForbiddenException();
        return await _roles.ListOptionsAsync(ct);
    }

    public async Task<Employee> SaveEmployeeAsync(ActorContext actor, Guid? id, int version,
        EmployeeInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Employees,
            id is null ? ActionCodes.Create : ActionCodes.Edit, ct: ct);

        input.Code = (input.Code ?? "").Trim().ToUpperInvariant();
        input.NameAr = (input.NameAr ?? "").Trim();
        input.NameEn = string.IsNullOrWhiteSpace(input.NameEn) ? null : input.NameEn.Trim();
        input.Phone = string.IsNullOrWhiteSpace(input.Phone) ? null : input.Phone.Trim();
        input.JobTitle = string.IsNullOrWhiteSpace(input.JobTitle) ? null : input.JobTitle.Trim();
        // الهاتف والوظيفة من البيانات الإجبارية لتسجيل الموظف.
        if (input.Phone is null) throw new ValidationAppException("validation.employee_phone_required");
        if (input.JobTitle is null)
            throw new ValidationAppException("validation.employee_job_title_required");
        if (input.NameAr.Length is 0 or > 200) throw new ValidationAppException("validation.name_required");
        if (!input.IsBookingReceiver && !input.IsSeller && !input.IsServiceExecutor &&
            input.RoleId is null)
            throw new ValidationAppException("validation.employee_role_required");
        // فرع الموظف (أو null = الشركة): النطاق «الشركة» للسوبر أدمن فقط، وغيره داخل فروعه.
        if (input.BranchId is { } employeeBranch) BranchScope.Ensure(actor, employeeBranch);
        else if (!actor.IsSuperAdmin) input.BranchId = actor.CurrentBranchId ?? actor.AllowedBranchIds.FirstOrDefault();

        // الكود تسلسلي آلي لكل فرع بدءًا من 1 عند الإضافة، وغير قابل للتعديل — 0094.
        if (id is null)
            input.Code = await _employees.NextCodeAsync(input.BranchId, ct);
        else if (input.Code.Length is 0 or > 30)
            throw new ValidationAppException("validation.code_required");

        try
        {
            if (id is null)
            {
                var newId = Guid.CreateVersion7();
                await _employees.CreateAsync(newId, input, actor.UserId, ct);
                var created = await _employees.GetAsync(newId, ct) ?? throw new NotFoundAppException();
                await _audit.WriteAsync(actor, "employees", newId.ToString(), "INSERT", null, created, ct);
                return created;
            }

            var old = await _employees.GetAsync(id.Value, ct) ?? throw new NotFoundAppException();
            var updated = await _employees.UpdateAsync(id.Value, version, input, actor.UserId, ct)
                ?? throw new ConflictException("error.version_conflict");
            await _audit.WriteAsync(actor, "employees", id.ToString(), "UPDATE", old, updated, ct);
            return updated;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }

    /// <summary>
    /// الكود التالي للموظف داخل فرعه (بدءًا من 1) لعرضه للقراءة فقط في شاشة الإضافة — 0094.
    /// </summary>
    public async Task<string> NextEmployeeCodeAsync(ActorContext actor, Guid? branchId,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Employees, ActionCodes.View, ct: ct);
        if (branchId is { } id) BranchScope.Ensure(actor, id);
        return await _employees.NextCodeAsync(branchId, ct);
    }

    public async Task<Employee> SetEmployeeActiveAsync(ActorContext actor, Guid id, bool isActive,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Employees, ActionCodes.ToggleActive, ct: ct);
        var old = await _employees.GetAsync(id, ct) ?? throw new NotFoundAppException();
        var updated = await _employees.SetActiveAsync(id, isActive, actor.UserId, ct)
            ?? throw new NotFoundAppException();
        await _audit.WriteAsync(actor, "employees", id.ToString(), "UPDATE", old, updated, ct);
        return updated;
    }
}
