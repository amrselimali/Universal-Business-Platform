using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;
using Ubp.Core.Security;
using Ubp.Infrastructure.Repositories;

namespace Ubp.Application.Services;

/// <summary>
/// تحصيل قيمة الخدمات المحجوزة من نقطة البيع: يقرأ أرصدة الحجوزات (الإجمالي/المسدد/المستحق)
/// ويُنشئ سند قبض مرحّلًا يخصّص المبالغ على الحجوزات، مع تدقيق ونطاق فرع.
/// </summary>
public sealed class BookingCollectionService
{
    private readonly IBookingCollectionRepository _collections;
    private readonly ITreasuryRepository _treasury;
    private readonly IPartnerRepository _partners;
    private readonly PermissionService _permissions;
    private readonly AuditService _audit;
    private readonly IReceiptNotifier _notifier;
    private readonly IShiftGate? _shiftGate;

    public BookingCollectionService(IBookingCollectionRepository collections,
        ITreasuryRepository treasury, IPartnerRepository partners,
        PermissionService permissions, AuditService audit,
        IReceiptNotifier notifier, IShiftGate? shiftGate = null)
    {
        _collections = collections; _treasury = treasury; _partners = partners;
        _permissions = permissions; _audit = audit; _notifier = notifier;
        _shiftGate = shiftGate;
    }

    /// <summary>
    /// هل يوجد شفت مفتوح للفرع؟ تُستخدم قبل فتح نافذة التحصيل لإظهار رسالة
    /// «يجب فتح شفت أولاً» بدلاً من تعليق النافذة بلا بيانات.
    /// </summary>
    public async Task<bool> HasOpenShiftAsync(ActorContext actor, Guid branchId,
        CancellationToken ct = default)
    {
        if (!actor.RequiresShift) return true;
        if (_shiftGate is null) return true;
        return await _shiftGate.HasOpenShiftAsync(actor.UserId, branchId,
            actor.AllowedBranchIds, ct);
    }

    /// <summary>
    /// هل يمكن أخذ دفعة مقدمة بلا خدمة محجوزة؟ فقط داخل شفت دكتور خارجي
    /// والعميل المختار هو العميل المربوط بالشفت — 0112.
    /// </summary>
    public async Task<bool> CanTakeAdvanceAsync(ActorContext actor, Guid branchId,
        Guid customerId, CancellationToken ct = default)
    {
        if (!await _permissions.HasAsync(actor, ScreenCodes.PosTerminal, ActionCodes.Collect, ct))
            return false;
        if (!actor.CanAccessBranch(branchId) || customerId == Guid.Empty) return false;
        var shift = await _treasury.GetOpenShiftAsync(branchId, ct);
        return shift is { IsExternalDoctor: true } &&
               shift.ExternalDoctorCustomerId == customerId;
    }

    /// <summary>
    /// إنشاء سند قبض دفعة مقدمة (Customer advances) داخل شفت الدكتور الخارجي.
    /// الخزينة هي طريقة الدفع (تُستنتج طريقة الخزينة الافتراضية)، وعمولة التحصيل تُحسب
    /// تلقائيًا من نسبة الخزينة على إجمالي المدفوع وتُسجَّل على السند كما في الإيصال العادي.
    /// </summary>
    public async Task<AdvancePaymentResult> CollectAdvanceAsync(ActorContext actor,
        AdvancePaymentInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PosTerminal, ActionCodes.Collect,
            ct: ct);
        BranchScope.Ensure(actor, input.BranchId);
        if (input.Amount <= 0) throw new ValidationAppException("validation.voucher_amount");
        var shift = await _treasury.GetOpenShiftAsync(input.BranchId, ct);
        if (shift is not { IsExternalDoctor: true } ||
            shift.ExternalDoctorCustomerId != input.CustomerId)
            throw new ValidationAppException("validation.external_doctor_advance_not_allowed");
        if (input.TreasuryId == Guid.Empty)
            throw new ValidationAppException("validation.required_fields");
        var customer = (await _partners.GetAsync(PartnerKind.Customer, input.CustomerId, ct))
                       ?? throw new ValidationAppException("validation.customer_not_found");

        // الخزينة = طريقة الدفع: لا تُطلب طريقة من الشاشة، وتُستنتج الافتراضية إن لم تُحدَّد.
        var treasury = (await _treasury.ListTreasuriesAsync(input.BranchId, ct))
            .FirstOrDefault(t => t.Id == input.TreasuryId)
            ?? throw new ValidationAppException("validation.treasury_not_found");
        if (!treasury.IsCompanyWide && treasury.BranchId != input.BranchId)
            throw new ValidationAppException("validation.treasury_branch_mismatch");

        var methods = await _treasury.ListMethodsAsync(input.TreasuryId, ct);
        var method = (input.TreasuryMethodId == Guid.Empty
                ? null
                : methods.FirstOrDefault(m => m.Id == input.TreasuryMethodId))
            ?? methods.FirstOrDefault(m => m.Code == "DEFAULT")
            ?? methods.FirstOrDefault()
            ?? throw new ValidationAppException("validation.treasury_method_not_found");

        // عمولة العميل المحمَّلة على السند = نسبة الخزينة من إجمالي المدفوع (مثل إيصال POS).
        var fee = TreasuryFeeRules.CollectionFee(input.Amount, treasury.CollectionFeePercent);
        if (fee < 0 || fee >= input.Amount)
            throw new ValidationAppException("validation.invalid_fee");

        var voucherId = Guid.CreateVersion7();
        try
        {
            await _treasury.CreateVoucherAsync(voucherId, new VoucherInput
            {
                VoucherType = VoucherTypes.Receipt, ReceiptType = VoucherReceiptTypes.Advance,
                BranchId = input.BranchId,
                DocDate = DateTime.Today, PartyType = "C", PartyId = input.CustomerId,
                PartyName = customer.NameAr, TreasuryId = input.TreasuryId,
                Notes = string.IsNullOrWhiteSpace(input.Notes)
                    ? "دفعة مقدمة — شفت دكتور خارجى" : input.Notes.Trim(),
                Lines =
                {
                    new VoucherLineInput
                    {
                        TreasuryMethodId = method.Id, Amount = input.Amount, FeeAmount = fee
                    }
                }
            }, actor.UserId, ct);
            await _treasury.SetVoucherShiftAsync(voucherId, shift.Id, ct);
        }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }
        await _audit.WriteAsync(actor, "vouchers", voucherId.ToString(), "INSERT", null,
            new { input.CustomerId, input.Amount, Fee = fee, ShiftId = shift.Id,
                  TreasuryId = input.TreasuryId, TreasuryMethodId = method.Id }, ct);
        return new AdvancePaymentResult
        {
            VoucherId = voucherId, Amount = input.Amount, Fee = fee
        };
    }

    public async Task<IReadOnlyList<BookingCollectionRow>> ListOutstandingAsync(
        ActorContext actor, Guid branchId, Guid customerId, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PosTerminal, ActionCodes.Collect,
            ct: ct);
        BranchScope.Ensure(actor, branchId);
        return await _collections.ListOutstandingAsync(branchId, customerId, ct);
    }

    public async Task<BookingCollectionResult> CollectAsync(ActorContext actor,
        BookingCollectionInput input, CancellationToken ct = default)
    {
        await _permissions.RequireAsync(actor, ScreenCodes.PosTerminal, ActionCodes.Collect,
            ct: ct);
        BranchScope.Ensure(actor, input.BranchId);
        var id = Guid.CreateVersion7();
        BookingCollectionResult result;
        try { result = await _collections.CollectAsync(id, input, actor.UserId, ct); }
        catch (PostgresException ex) { throw DbErrorMapper.Map(ex); }

        await _audit.WriteAsync(actor, "booking_payments", id.ToString(), "INSERT", null,
            new
            {
                input.CustomerId, result.VoucherNo, result.Total, result.Fee,
                Lines = input.Lines.Select(l => new { l.BookingId, l.Amount }).ToArray()
            }, ct);

        if (!input.DraftOnly)
            await _notifier.NotifyAsync(input.BranchId, input.CustomerId,
                result.VoucherNo ?? "", result.Total, result.Total, null, ct);
        return result;
    }
}
