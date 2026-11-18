using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    private static async Task<Guid> NeedPostingAccountAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, string key, string module, CancellationToken ct)
    {
        var id = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition(
            "SELECT account_id FROM posting_defaults WHERE setting_key = @key",
            new { key }, tx, cancellationToken: ct));
        return id ?? throw new ValidationAppException("validation.posting_account_missing",
            new Dictionary<string, string> { ["key"] = key, ["module"] = module });
    }

    private static async Task<Guid> InsertSettlementVoucherAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, ShiftRow shift, Guid customerId, Guid treasuryId,
        decimal treasuryPart, decimal absolute, bool isReceipt, Guid userId,
        CancellationToken ct)
    {
        var voucherId = Guid.CreateVersion7();
        var docType = isReceipt ? "RCV" : "PAY";
        var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
            SELECT next_document_number(@docType::varchar, @branchId::uuid, current_date,
                                        @docType::varchar, 6::smallint)
            """, new { docType, branchId = shift.BranchId }, tx, cancellationToken: ct));
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO vouchers
                (id, branch_id, doc_date, doc_no, status, voucher_type, party_type, party_id,
                 party_name, treasury_id, total_amount, fee_total, notes, created_by,
                 is_shift_settlement, settlement_treasury_amount)
            VALUES (@id, @branchId, current_date, @docNo, 'draft', @voucherType, 'C',
                    @customerId, @customerName, @treasuryId, @amount, 0, @notes, @userId,
                    true, @treasuryPart)
            """, new
        {
            id = voucherId, branchId = shift.BranchId, docNo,
            voucherType = isReceipt ? VoucherTypes.Receipt : VoucherTypes.Payment,
            customerId, customerName = shift.ExternalDoctorCustomerName ?? "",
            treasuryId, amount = absolute, notes = "تسوية شفت دكتور خارجى", userId,
            treasuryPart
        }, tx, cancellationToken: ct));

        if (treasuryPart > 0)
        {
            var methodId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
                SELECT id FROM treasury_methods
                WHERE treasury_id = @treasuryId AND is_active
                ORDER BY (code = 'DEFAULT') DESC, code LIMIT 1
                """, new { treasuryId }, tx, cancellationToken: ct))
                ?? throw new ValidationAppException("validation.treasury_method_not_found");
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO voucher_lines
                    (voucher_id, line_no, treasury_method_id, amount, fee_amount)
                VALUES (@voucherId, 1, @methodId, @amount, 0)
                """, new { voucherId, methodId, amount = treasuryPart }, tx,
                cancellationToken: ct));
        }
        return voucherId;
    }
}
