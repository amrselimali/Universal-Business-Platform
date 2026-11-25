using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// تكويد العميل مع أرصدة افتتاحية لخدماته في حفظ واحد متكامل: كل رصيد يُسجَّل
/// كحجز خدمة مؤكد يظهر في «الخدمات المحجوزة» و«تحصيلات الخدمات المحجوزة» — 0104.
/// </summary>
public sealed partial class PartnerService
{
    private async Task<Partner> CreateWithOpeningBalancesAsync(ActorContext actor,
        PartnerInput input, CancellationToken ct)
    {
        // صلاحية مستقلة عن إضافة العميل: بدونها يُرفض الحفظ من الخادم — 0104.
        await _permissions.RequireAsync(actor, ScreenCodes.Customers,
            ActionCodes.AddOpeningBalances, ct: ct);
        if (input.OpeningBalances.Any(b => b.ServiceId == Guid.Empty))
            throw new ValidationAppException("validation.required_fields");

        // فرع الأرصدة الافتتاحية: فرع العميل إن كان مقيّدًا بفرع، وإلا الفرع الحالي للمستخدم.
        var branchId = input.BranchId ?? actor.CurrentBranchId ?? actor.AllowedBranchIds.FirstOrDefault();
        if (branchId == Guid.Empty)
            throw new ValidationAppException("validation.branch_required");
        BranchScope.Ensure(actor, branchId);

        PartnerOpeningBalancesResult result;
        try
        {
            result = await _repository.CreateWithOpeningBalancesAsync(input,
                input.OpeningBalances, branchId, actor.UserId, ct);
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }

        // كل رصيد افتتاحي حجز خدمة مستقل: يُسجَّل فى المراجعة بسجل العميل وبسجل الحجز — 0104.
        foreach (var booking in result.Bookings)
            await _audit.WriteAsync(actor, "bookings", booking.BookingId.ToString(), "INSERT", null,
                new
                {
                    CustomerId = result.Partner.Id, booking.DocNo, booking.ServiceId,
                    booking.Quantity, booking.UnitPrice, booking.TotalAmount, booking.PaidAmount,
                    Remaining = Math.Max(booking.TotalAmount - booking.PaidAmount, 0),
                    Source = "opening_balance"
                }, ct);

        await _audit.WriteAsync(actor, "customers", result.Partner.Id.ToString(), "INSERT", null,
            new
            {
                Partner = result.Partner,
                OpeningBalances = result.Bookings.Select(b => new
                {
                    b.BookingId, b.DocNo, b.ServiceId, b.Quantity, b.UnitPrice,
                    b.TotalAmount, b.PaidAmount,
                    Remaining = Math.Max(b.TotalAmount - b.PaidAmount, 0)
                }).ToArray()
            }, ct);

        return result.Partner;
    }

    /// <summary>
    /// بنود الأرصدة الافتتاحية للعميل مع سبب منع التعديل (تنفيذ/تحصيل/تحويل/تسوية).
    /// تحتاج صلاحية مستقلة «تعديل الأرصدة الافتتاحية» ولا تمس بيانات العميل.
    /// </summary>
    public async Task<IReadOnlyList<PartnerOpeningBalanceLine>> ListOpeningBalancesAsync(
        ActorContext actor, PartnerKind kind, Guid customerId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, Screen(kind), ActionCodes.EditOpeningBalances,
            ct: ct);
        var partner = await _repository.GetAsync(kind, customerId, ct)
            ?? throw new NotFoundAppException();
        EnsureAccess(actor, partner);
        return await _repository.ListOpeningBalancesAsync(customerId, ct);
    }

    /// <summary>
    /// تعديل مباشر للأرصدة الافتتاحية (تحديث/إضافة/حذف بنود) بنفس قواعد التكويد:
    /// بلا أي أثر محاسبي، ومع إعادة حساب reserved_qty وإجمالي الحجز والمسدد حتى
    /// تنعكس القيم في الخدمات المحجوزة والتحصيلات والتسوية فورًا.
    /// </summary>
    public async Task<PartnerOpeningBalanceEditResult> UpdateOpeningBalancesAsync(
        ActorContext actor, PartnerKind kind, Guid customerId,
        IReadOnlyList<PartnerOpeningBalanceEditLine> lines, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, Screen(kind), ActionCodes.EditOpeningBalances,
            ct: ct);
        var partner = await _repository.GetAsync(kind, customerId, ct)
            ?? throw new NotFoundAppException();
        EnsureAccess(actor, partner);

        foreach (var line in lines)
        {
            var error = PartnerOpeningBalanceRules.ValidateLine(line.Quantity, line.UnitPrice,
                line.PaidAmount);
            if (error is not null) throw new ValidationAppException(error);
            if (line.BookingLineId is null && line.ServiceId is null)
                throw new ValidationAppException("validation.required_fields");
        }

        // فرع البنود الجديدة: فرع العميل، ثم فرع أرصدته الحالية، ثم الفرع الحالي للمستخدم.
        var currentLines = await _repository.ListOpeningBalancesAsync(customerId, ct);
        var branchId = partner.BranchId ?? currentLines.FirstOrDefault()?.BranchId
            ?? actor.CurrentBranchId ?? (Guid?)actor.AllowedBranchIds.FirstOrDefault();
        if (branchId is null || branchId.Value == Guid.Empty)
            throw new ValidationAppException("validation.branch_required");
        BranchScope.Ensure(actor, branchId.Value);

        PartnerOpeningBalanceEditResult result;
        try
        {
            result = await _repository.UpdateOpeningBalancesAsync(customerId, branchId.Value,
                lines, actor.UserId, ct);
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }

        // سجل المراجعة: سطر لكل بند (إضافة/تعديل/حذف) يحمل الفروق النقدية والقيمية.
        if (result.Changes.Count == 0) return result;
        foreach (var change in result.Changes)
            await _audit.WriteAsync(actor, "bookings", change.BookingId.ToString(),
                change.Action, change.OldValues, change.NewValues, ct);

        // ملخص العملية على العميل: فروق القيمة والمسدد (نقد/تسوية) بلا أي قيد محاسبي.
        await _audit.WriteAsync(actor, "customers", customerId.ToString(), "UPDATE",
            new { OpeningBalances = true, Total = result.OldTotal, Paid = result.OldPaid },
            new
            {
                OpeningBalances = true, Total = result.NewTotal, Paid = result.NewPaid,
                result.Added, result.Updated, result.Removed,
                result.ValueDifference, result.CashDifference
            }, ct);

        return result;
    }
}
