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
    private readonly IPayrollFoundationRepository? _payrollFoundation;

    public MasterDataService(IEmployeeRepository employees, ITaxRepository taxes,
        IPaymentTermRepository terms, IPriceListRepository priceLists, IRoleRepository roles,
        PermissionService permissions, AuditService audit,
        IPayrollFoundationRepository? payrollFoundation = null)
    {
        _employees = employees; _taxes = taxes; _terms = terms; _priceLists = priceLists;
        _roles = roles; _permissions = permissions; _audit = audit;
        _payrollFoundation = payrollFoundation;
    }

    // ---------------- الموظفون (D8/D9) ----------------
    public async Task<PagedResult<Employee>> ListEmployeesAsync(ActorContext actor,
        PageRequest request, bool includeInactive, IReadOnlyCollection<Guid>? branchIds = null,
        CancellationToken ct = default)
    {
        var canView = await _permissions.HasAsync(actor, ScreenCodes.Employees, ActionCodes.View, ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.Employees,
                          ActionCodes.ViewBasic, ct);
        if (!canView) throw new ForbiddenException();
        var scope = actor.IsSuperAdmin
            ? (branchIds is { Count: > 0 } ? branchIds.ToArray() : Array.Empty<Guid>())
            : (branchIds is { Count: > 0 }
                ? branchIds.Where(actor.AllowedBranchIds.Contains).ToArray()
                : actor.AllowedBranchIds.ToArray());
        var page = await _employees.ListAsync(request, includeInactive, scope, ct);
        // عرض أساسي فقط: تُقصّ البيانات قبل خروجها من الخادم (اسم/هاتف/تاريخ تعيين فقط).
        if (!await _permissions.HasAsync(actor, ScreenCodes.Employees, ActionCodes.View, ct))
            page = new PagedResult<Employee>
            {
                Items = page.Items.Select(ToBasicView).ToList(),
                Total = page.Total, Page = page.Page, PageSize = page.PageSize
            };
        return page;
    }

    /// <summary>إسقاط الحد الأدنى للبيانات: يمنع تسريب الرواتب/الأدوار/الحسابات لمن لديه عرض أساسي فقط.</summary>
    private static Employee ToBasicView(Employee employee) => new()
    {
        Id = employee.Id,
        NameAr = employee.NameAr,
        Phone = employee.Phone,
        HireDate = employee.HireDate,
        BranchId = employee.BranchId,
        IsActive = employee.IsActive,
        Version = employee.Version,
        PayrollProfileStatus = employee.PayrollProfileStatus
    };

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
        // المدير الأعلى: الفروع المطلوبة كما هي (أو كل الموظفين عند عدم تحديد فرع).
        if (actor.IsSuperAdmin)
            return branchIds is { Count: > 0 }
                ? await _employees.ListOptionsAsync(branchIds.Distinct().ToArray(), false, ct)
                : await _employees.ListOptionsAsync(ct);

        var scope = branchIds is { Count: > 0 }
            ? branchIds.Where(actor.CanAccessBranch).Distinct().ToArray()
            : actor.AllowedBranchIds.ToArray();
        // لا تقاطع مع فروع المستخدم ⇒ نستخدم فرعه الحالي بدل إسقاط كل موظفي الفروع
        // (الاستعلام يضم موظفي الشركة بلا فرع دائمًا).
        if (scope.Length == 0 && actor.CurrentBranchId is { } current) scope = new[] { current };
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

    /// <summary>
    /// تسجيل مبدئي: اسم عربي + هاتف + تاريخ تعيين فقط، بصلاحية REGISTER_BASIC المنفصلة عن CREATE.
    /// لا يفرض أي حقل إلزامي، ويفتح ملف مرتبات بحالة draft ليظهر الموظف بحالة «تسجيل مبدئي».
    /// </summary>
    public async Task<Employee> RegisterBasicEmployeeAsync(ActorContext actor, EmployeeBasicInput input,
        CancellationToken ct = default)
    {
        var allowed = await _permissions.HasAsync(actor, ScreenCodes.Employees,
                          ActionCodes.RegisterBasic, ct)
                      || await _permissions.HasAsync(actor, ScreenCodes.Employees, ActionCodes.Create, ct);
        if (!allowed) throw new ForbiddenException();

        var payload = new EmployeeInput
        {
            NameAr = input.NameAr ?? "",
            Phone = input.Phone,
            HireDate = input.HireDate,
            BranchId = input.BranchId,
            IsActive = true,
            IsBookingReceiver = false, IsSeller = false, IsServiceExecutor = false
        };
        return await SaveEmployeeAsync(actor, null, 0, payload, ct, auditAction: "REGISTER_BASIC");
    }

    public async Task<Employee> SaveEmployeeAsync(ActorContext actor, Guid? id, int version,
        EmployeeInput input, CancellationToken ct = default, string auditAction = "INSERT")
    {
        if (id is null)
        {
            // الإضافة الكاملة أو التسجيل المبدئي — صلاحيتان منفصلتان.
            var canCreate = await _permissions.HasAsync(actor, ScreenCodes.Employees, ActionCodes.Create, ct);
            var canRegisterBasic = await _permissions.HasAsync(actor, ScreenCodes.Employees,
                ActionCodes.RegisterBasic, ct);
            if (!canCreate && !canRegisterBasic) throw new ForbiddenException();
        }
        else
        {
            await _permissions.RequireAsync(actor, ScreenCodes.Employees, ActionCodes.Edit, ct: ct);
        }

        input.Code = (input.Code ?? "").Trim().ToUpperInvariant();
        input.NameAr = (input.NameAr ?? "").Trim();
        input.NameEn = string.IsNullOrWhiteSpace(input.NameEn) ? null : input.NameEn.Trim();
        input.Phone = string.IsNullOrWhiteSpace(input.Phone) ? null : input.Phone.Trim();
        input.JobTitle = string.IsNullOrWhiteSpace(input.JobTitle) ? null : input.JobTitle.Trim();
        // لا قيود إلزامية على التسجيل (اسم/هاتف/تاريخ تعيين فقط ويجوز تركها) — تُفرض حدود طول فقط.
        if (input.NameAr.Length > 200) throw new ValidationAppException("validation.name_too_long");
        if (input.Phone is { Length: > 50 }) throw new ValidationAppException("validation.phone_too_long");
        if (input.JobTitle is { Length: > 200 }) throw new ValidationAppException("validation.job_title_too_long");
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
                // فتح ملف مرتبات بحالة «تسجيل مبدئي» حتى يظهر الموظف في شاشة مرتبات الموظفين.
                if (_payrollFoundation is not null)
                    await _payrollFoundation.EnsureProfileAsync(newId, ct);
                var created = await _employees.GetAsync(newId, ct) ?? throw new NotFoundAppException();
                await _audit.WriteAsync(actor, "employees", newId.ToString(), "INSERT", null,
                    string.Equals(auditAction, "INSERT", StringComparison.OrdinalIgnoreCase)
                        ? created
                        : new { audit_action = auditAction.ToUpperInvariant(), created }, ct);
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
