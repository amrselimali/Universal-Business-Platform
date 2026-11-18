using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed partial class PartnerService
{
    /// <summary>تعديل جزئي لبيانات العميل: الهاتف والواتساب فقط بصلاحية EDIT_CONTACT.</summary>
    public async Task<Partner> UpdateContactAsync(ActorContext actor, Guid id, int version,
        string? phone, string? whatsapp, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Customers, ActionCodes.EditContact,
            ct: ct);
        var old = await _repository.GetAsync(PartnerKind.Customer, id, ct)
                  ?? throw new NotFoundAppException();
        EnsureAccess(actor, old);
        phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        whatsapp = string.IsNullOrWhiteSpace(whatsapp) ? null : whatsapp.Trim();
        if (phone is null) throw new ValidationAppException("validation.customer_phone_required");
        if (whatsapp is null)
            throw new ValidationAppException("validation.customer_whatsapp_required");
        if (await _repository.PhoneExistsInScopeAsync(PartnerKind.Customer, phone,
                old.ScopeType, old.BranchId, id, ct))
            throw new ValidationAppException("validation.customer_phone_duplicate");
        if (await _repository.WhatsAppExistsInScopeAsync(PartnerKind.Customer, whatsapp,
                old.ScopeType, old.BranchId, id, ct))
            throw new ValidationAppException("validation.customer_whatsapp_duplicate");
        try
        {
            var updated = await _repository.UpdateContactAsync(PartnerKind.Customer, id, version,
                phone, whatsapp, ct) ?? throw new ConflictException("error.version_conflict");
            await _audit.WriteAsync(actor, "customers", id.ToString(), "UPDATE", old, updated, ct);
            return updated;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }
}
