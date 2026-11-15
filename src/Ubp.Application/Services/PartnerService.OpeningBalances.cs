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
        if (input.OpeningBalances.Any(b => b.ServiceId == Guid.Empty))
            throw new ValidationAppException("validation.required_fields");

        // فرع الأرصدة الافتتاحية: فرع العميل إن كان مقيّدًا بفرع، وإلا الفرع الحالي للمستخدم.
        var branchId = input.BranchId ?? actor.CurrentBranchId ?? actor.AllowedBranchIds.FirstOrDefault();
        if (branchId == Guid.Empty)
            throw new ValidationAppException("validation.branch_required");
        BranchScope.Ensure(actor, branchId);

        try
        {
            var created = await _repository.CreateWithOpeningBalancesAsync(input,
                input.OpeningBalances, branchId, actor.UserId, ct);
            await _audit.WriteAsync(actor, "customers", created.Id.ToString(), "INSERT", null,
                new
                {
                    Partner = created,
                    OpeningBalances = input.OpeningBalances.Select(b => new
                    {
                        b.ServiceId, b.Quantity, b.UnitPrice, Total = b.TotalAmount,
                        b.PaidAmount, Remaining = b.RemainingAmount
                    }).ToArray()
                }, ct);
            return created;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }
}
