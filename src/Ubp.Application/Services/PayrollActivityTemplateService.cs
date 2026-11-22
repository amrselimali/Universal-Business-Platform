using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>نتيجة معاينة/تطبيق قالب نشاط: ما سيُنشأ وما سيُتجاهل لأنه موجود.</summary>
public sealed class PayrollTemplateApplyResult
{
    public string TemplateCode { get; init; } = "";
    public IReadOnlyList<string> CreatedCodes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> SkippedCodes { get; init; } = Array.Empty<string>();
    public int CreatedCount => CreatedCodes.Count;
    public int SkippedCount => SkippedCodes.Count;
}

/// <summary>
/// قوالب الأنشطة: تُنشئ البنود الناقصة فقط (idempotent بمطابقة الكود)، وكل بند بإصدار غير معتمد للمراجعة.
/// لا تُلمس أي بنود قائمة ولا تُغيَّر خصائصها.
/// </summary>
public sealed class PayrollActivityTemplateService
{
    private readonly IPayrollConfigurationRepository _configuration;
    private readonly PermissionService _permissions;
    private readonly PayrollAuditWriter _audit;

    public PayrollActivityTemplateService(IPayrollConfigurationRepository configuration,
        PermissionService permissions, PayrollAuditWriter audit)
    {
        _configuration = configuration;
        _permissions = permissions;
        _audit = audit;
    }

    public IReadOnlyList<PayrollActivityTemplate> Templates() => PayrollActivityTemplates.All;

    public async Task<PayrollTemplateApplyResult> PreviewAsync(string templateCode,
        CancellationToken ct = default)
    {
        var template = Require(templateCode);
        var existing = (await _configuration.ListItemsAsync(true, ct))
            .Select(x => x.Code)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return new PayrollTemplateApplyResult
        {
            TemplateCode = template.Code,
            CreatedCodes = template.Items.Where(x => !existing.Contains(x.Code)).Select(x => x.Code).ToList(),
            SkippedCodes = template.Items.Where(x => existing.Contains(x.Code)).Select(x => x.Code).ToList()
        };
    }

    public async Task<PayrollTemplateApplyResult> ApplyAsync(string templateCode, DateOnly effectiveFrom,
        ActorContext actor, CancellationToken ct = default)
    {
        if (!await _permissions.HasAsync(actor, ScreenCodes.PayrollItems, ActionCodes.Edit, ct))
            throw new ForbiddenException();

        var template = Require(templateCode);
        if (effectiveFrom == default)
            throw new ValidationAppException("validation.payroll_template_effective_date_required");

        var existing = (await _configuration.ListItemsAsync(true, ct))
            .Select(x => x.Code)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var created = new List<string>();
        var skipped = new List<string>();
        foreach (var item in template.Items)
        {
            if (existing.Contains(item.Code))
            {
                skipped.Add(item.Code);
                continue;
            }

            var itemId = await _configuration.CreateItemAsync(new PayrollItem
            {
                Id = Guid.NewGuid(), Code = item.Code, NameAr = item.NameAr, NameEn = item.NameEn,
                CategoryCode = item.CategoryCode, IsVariable = item.IsVariable,
                IsTaxable = item.IsTaxable, IsInsurable = item.IsInsurable,
                EmployerBorne = item.EmployerBorne, AllowNegative = item.AllowNegative,
                AffectsNetSalary = true
            }, ct);

            await _configuration.AddItemVersionAsync(new PayrollItemVersion
            {
                Id = Guid.NewGuid(), PayrollItemId = itemId, EffectiveFrom = effectiveFrom,
                CalculationType = item.CalculationType, RoundingMode = "none", IsApproved = false
            }, ct);
            created.Add(item.Code);
        }

        await _audit.WriteAsync(actor, "payroll_items", template.Code, "TEMPLATE_APPLY", null,
            new { template = template.Code, created, skipped, effective_from = effectiveFrom }, ct);

        return new PayrollTemplateApplyResult
        {
            TemplateCode = template.Code, CreatedCodes = created, SkippedCodes = skipped
        };
    }

    private static PayrollActivityTemplate Require(string templateCode) =>
        PayrollActivityTemplates.Get(templateCode)
        ?? throw new ValidationAppException("validation.payroll_template_unknown");
}
