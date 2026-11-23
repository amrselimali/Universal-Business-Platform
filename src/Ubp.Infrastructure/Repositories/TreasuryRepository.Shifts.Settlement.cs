using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    /// <summary>معاينة تسوية شفت الدكتور الخارجي: إيرادات العميل − تحصيلاته خلال الشفت.</summary>
    public async Task<ExternalDoctorSettlementPreview> GetExternalDoctorSettlementAsync(
        Guid shiftId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var shift = await connection.QuerySingleOrDefaultAsync<ShiftRow>(new CommandDefinition(
            ShiftSelect + " WHERE s.id = @id", new { id = shiftId }, cancellationToken: ct))
            ?? throw new NotFoundAppException();
        if (shift.ShiftType != ShiftTypes.ExternalDoctor ||
            shift.ExternalDoctorCustomerId is not { } customerId)
            return new ExternalDoctorSettlementPreview { ShiftId = shiftId };
        var (revenues, collections) = await SettlementTotalsAsync(connection, null, shift,
            customerId, ct);
        return new ExternalDoctorSettlementPreview
        {
            ShiftId = shift.Id, CustomerId = customerId,
            CustomerName = shift.ExternalDoctorCustomerName ?? "",
            Revenues = revenues, Collections = collections,
            Amount = Math.Round(revenues - collections, 2, MidpointRounding.AwayFromZero)
        };
    }

    /// <summary>يُنشئ سند تسوية شفت الدكتور الخارجي (قبض للموجب/صرف للسالب) بقيد مخصص.</summary>
    private static async Task<Guid?> CreateExternalDoctorSettlementAsync(
        NpgsqlConnection connection, NpgsqlTransaction tx, ShiftRow shift,
        ShiftSettlementInput? input, Guid userId, bool autoClosed, CancellationToken ct)
    {
        if (shift.ShiftType != ShiftTypes.ExternalDoctor ||
            shift.ExternalDoctorCustomerId is not { } customerId) return null;
        var (revenues, collections) = await SettlementTotalsAsync(connection, tx, shift,
            customerId, ct);
        var amount = Math.Round(revenues - collections, 2, MidpointRounding.AwayFromZero);
        if (amount == 0)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "UPDATE cashier_shifts SET settlement_amount = 0 WHERE id = @id",
                new { id = shift.Id }, tx, cancellationToken: ct));
            return null;
        }

        var absolute = Math.Abs(amount);
        if (!autoClosed && input is null)
            throw new ValidationAppException("validation.shift_settlement_required");
        var mode = autoClosed || input is null ? ShiftSettlementModes.Doctor : input.Mode;
        if (mode is not (ShiftSettlementModes.Doctor or ShiftSettlementModes.Treasury
            or ShiftSettlementModes.Mixed))
            throw new ValidationAppException("validation.shift_settlement_required");
        var treasuryPart = mode switch
        {
            ShiftSettlementModes.Doctor => 0m,
            ShiftSettlementModes.Treasury => absolute,
            _ => Math.Round(input!.TreasuryAmount, 2, MidpointRounding.AwayFromZero)
        };
        if (treasuryPart < 0 || treasuryPart > absolute)
            throw new ValidationAppException("validation.shift_settlement_amount_invalid");

        Guid? treasuryId = input?.TreasuryId;
        if (treasuryId is null)
            treasuryId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
                -- خزينة التسوية الافتراضية: خزينة الفرع أولًا ثم خزينة الشركة (is_company_wide) — 0215.
                SELECT id FROM treasuries
                WHERE (is_company_wide OR branch_id = @branchId) AND is_active
                ORDER BY is_company_wide, code LIMIT 1
                """, new { branchId = shift.BranchId }, tx, cancellationToken: ct));
        if (treasuryId is null)
            throw new ValidationAppException("validation.treasury_required");
        var treasury = await connection.QuerySingleAsync<(Guid AccountId, Guid BranchId,
            bool Active, bool IsCompanyWide)>(new CommandDefinition("""
            SELECT account_id AS AccountId, branch_id AS BranchId, is_active AS Active,
                   is_company_wide AS IsCompanyWide
            FROM treasuries WHERE id = @id
            """, new { id = treasuryId }, tx, cancellationToken: ct));
        // خزينة الشركة مسموحة لأي فرع؛ خزينة الفرع يجب أن تتبع نفس فرع الشفت.
        if (!treasury.Active || (!treasury.IsCompanyWide && treasury.BranchId != shift.BranchId))
            throw new ValidationAppException("validation.treasury_not_found");

        var doctorAccount = await NeedPostingAccountAsync(connection, tx,
            PostingKeys.ExternalDoctor, "shift_settlement", ct);
        var advances = await NeedPostingAccountAsync(connection, tx,
            PostingKeys.CustomerAdvances, "shift_settlement", ct);
        var voucherId = await InsertSettlementVoucherAsync(connection, tx, shift, customerId,
            treasuryId.Value, treasuryPart, absolute, amount > 0, userId, ct);
        var entryId = await PostSettlementEntryAsync(connection, tx, shift, customerId,
            treasury.AccountId, doctorAccount, advances, treasuryPart, absolute,
            amount > 0, voucherId, userId, ct);
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE vouchers SET status = 'posted', posted_at = now(), posted_by = @userId,
                journal_entry_id = @entryId WHERE id = @voucherId
            """, new { userId, entryId, voucherId }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE cashier_shifts
            SET settlement_voucher_id = @voucherId, settlement_amount = @amount,
                settlement_treasury_amount = @treasuryPart, settlement_mode = @mode
            WHERE id = @shiftId
            """, new { voucherId, amount, treasuryPart, mode, shiftId = shift.Id }, tx,
            cancellationToken: ct));
        return voucherId;
    }

    // PART_TOTALS
}
