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
}
