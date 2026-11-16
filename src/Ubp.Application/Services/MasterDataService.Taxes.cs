using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Paging;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

public sealed partial class MasterDataService
{
    // ---------------- الضرائب (D6) ----------------
    public async Task<PagedResult<Tax>> ListTaxesAsync(ActorContext actor, PageRequest request,
        bool includeInactive, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Taxes, ActionCodes.View, ct: ct);
        return await _taxes.ListAsync(request, includeInactive, ct);
    }

    public async Task<IReadOnlyList<Tax>> TaxOptionsAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        var allowed = await _permissions.HasAsync(actor, ScreenCodes.Taxes, ActionCodes.View, ct)
                   || await _permissions.HasAsync(actor, ScreenCodes.Items, ActionCodes.View, ct);
        if (!allowed) throw new ForbiddenException();
        return await _taxes.ListOptionsAsync(ct);
    }

    public async Task<Tax> SaveTaxAsync(ActorContext actor, Guid? id, int version, TaxInput input,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Taxes,
            id is null ? ActionCodes.Create : ActionCodes.Edit, ct: ct);

        input.Code = (input.Code ?? "").Trim().ToUpperInvariant();
        input.NameAr = (input.NameAr ?? "").Trim();
        if (input.Code.Length is 0 or > 20) throw new ValidationAppException("validation.code_required");
        if (input.NameAr.Length is 0 or > 100) throw new ValidationAppException("validation.name_required");
        if (input.Rate is < 0 or > 100) throw new ValidationAppException("validation.tax_rate");

        try
        {
            if (id is null)
            {
                var newId = Guid.CreateVersion7();
                await _taxes.CreateAsync(newId, input, actor.UserId, ct);
                var created = await _taxes.GetAsync(newId, ct) ?? throw new NotFoundAppException();
                await _audit.WriteAsync(actor, "taxes", newId.ToString(), "INSERT", null, created, ct);
                return created;
            }

            var old = await _taxes.GetAsync(id.Value, ct) ?? throw new NotFoundAppException();
            var updated = await _taxes.UpdateAsync(id.Value, version, input, actor.UserId, ct)
                ?? throw new ConflictException("error.version_conflict");
            await _audit.WriteAsync(actor, "taxes", id.ToString(), "UPDATE", old, updated, ct);
            return updated;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }

    public async Task<Tax> SetTaxActiveAsync(ActorContext actor, Guid id, bool isActive,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.Taxes, ActionCodes.ToggleActive, ct: ct);
        var old = await _taxes.GetAsync(id, ct) ?? throw new NotFoundAppException();
        var updated = await _taxes.SetActiveAsync(id, isActive, actor.UserId, ct)
            ?? throw new NotFoundAppException();
        await _audit.WriteAsync(actor, "taxes", id.ToString(), "UPDATE", old, updated, ct);
        return updated;
    }

    // ---------------- شروط الدفع ----------------
    public async Task<PagedResult<PaymentTerm>> ListPaymentTermsAsync(ActorContext actor,
        PageRequest request, bool includeInactive, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PaymentTerms, ActionCodes.View, ct: ct);
        return await _terms.ListAsync(request, includeInactive, ct);
    }

    public async Task<PaymentTerm> SavePaymentTermAsync(ActorContext actor, Guid? id, int version,
        PaymentTermInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PaymentTerms,
            id is null ? ActionCodes.Create : ActionCodes.Edit, ct: ct);

        input.Code = (input.Code ?? "").Trim().ToUpperInvariant();
        input.NameAr = (input.NameAr ?? "").Trim();
        if (input.Code.Length is 0 or > 20) throw new ValidationAppException("validation.code_required");
        if (input.NameAr.Length is 0 or > 150) throw new ValidationAppException("validation.name_required");
        if (input.NetDays is < 0 or > 365) throw new ValidationAppException("validation.net_days");

        try
        {
            if (id is null)
            {
                var newId = Guid.CreateVersion7();
                await _terms.CreateAsync(newId, input, actor.UserId, ct);
                var created = await _terms.GetAsync(newId, ct) ?? throw new NotFoundAppException();
                await _audit.WriteAsync(actor, "payment_terms", newId.ToString(), "INSERT", null, created, ct);
                return created;
            }

            var old = await _terms.GetAsync(id.Value, ct) ?? throw new NotFoundAppException();
            var updated = await _terms.UpdateAsync(id.Value, version, input, actor.UserId, ct)
                ?? throw new ConflictException("error.version_conflict");
            await _audit.WriteAsync(actor, "payment_terms", id.ToString(), "UPDATE", old, updated, ct);
            return updated;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }


    public async Task<PaymentTerm> SetPaymentTermActiveAsync(ActorContext actor, Guid id,
        bool isActive, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PaymentTerms, ActionCodes.ToggleActive, ct: ct);
        var old = await _terms.GetAsync(id, ct) ?? throw new NotFoundAppException();
        var updated = await _terms.SetActiveAsync(id, isActive, actor.UserId, ct)
            ?? throw new NotFoundAppException();
        await _audit.WriteAsync(actor, "payment_terms", id.ToString(), "UPDATE", old, updated, ct);
        return updated;
    }

    // ---------------- قوائم الأسعار ----------------
    public async Task<PagedResult<PriceList>> ListPriceListsAsync(ActorContext actor,
        PageRequest request, bool includeInactive, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PriceLists, ActionCodes.View, ct: ct);
        return await _priceLists.ListAsync(request, includeInactive, ct);
    }

    public async Task<IReadOnlyList<PriceList>> PriceListOptionsAsync(ActorContext actor,
        CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PriceLists, ActionCodes.View, ct: ct);
        return await _priceLists.ListOptionsAsync(ct);
    }

    public async Task<PriceList> SavePriceListAsync(ActorContext actor, Guid? id, int version,
        PriceListInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PriceLists,
            id is null ? ActionCodes.Create : ActionCodes.Edit, ct: ct);

        input.Code = (input.Code ?? "").Trim().ToUpperInvariant();
        input.NameAr = (input.NameAr ?? "").Trim();
        if (input.Code.Length is 0 or > 20) throw new ValidationAppException("validation.code_required");
        if (input.NameAr.Length is 0 or > 150) throw new ValidationAppException("validation.name_required");
        if (input.ValidTo.HasValue && input.ValidFrom.HasValue && input.ValidTo < input.ValidFrom)
            throw new ValidationAppException("validation.date_range");

        try
        {
            if (id is null)
            {
                var newId = Guid.CreateVersion7();
                await _priceLists.CreateAsync(newId, input, actor.UserId, ct);
                var created = await _priceLists.GetAsync(newId, ct) ?? throw new NotFoundAppException();
                await _audit.WriteAsync(actor, "price_lists", newId.ToString(), "INSERT", null, created, ct);
                return created;
            }

            var old = await _priceLists.GetAsync(id.Value, ct) ?? throw new NotFoundAppException();
            var updated = await _priceLists.UpdateAsync(id.Value, version, input, actor.UserId, ct)
                ?? throw new ConflictException("error.version_conflict");
            await _audit.WriteAsync(actor, "price_lists", id.ToString(), "UPDATE", old, updated, ct);
            return updated;
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }

    public async Task<IReadOnlyList<PriceListItem>> PriceListItemsAsync(ActorContext actor,
        Guid priceListId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PriceLists, ActionCodes.View, ct: ct);
        return await _priceLists.ListItemsAsync(priceListId, ct);
    }

    public async Task ReplacePriceListItemsAsync(ActorContext actor, Guid priceListId,
        IReadOnlyList<PriceListItemInput> items, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PriceLists, ActionCodes.ManageItems, ct: ct);
        foreach (var item in items)
        {
            if (item.ItemId == Guid.Empty) throw new ValidationAppException("validation.required_fields");
            if (item.Price < 0) throw new ValidationAppException("validation.price_negative");
            if (item.MinQty < 0) throw new ValidationAppException("validation.quantity_negative");
        }

        try
        {
            await _priceLists.ReplaceItemsAsync(priceListId, items, ct);
            await _audit.WriteAsync(actor, "price_list_items", priceListId.ToString(), "UPDATE", null,
                new { Count = items.Count }, ct);
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
    }
}
