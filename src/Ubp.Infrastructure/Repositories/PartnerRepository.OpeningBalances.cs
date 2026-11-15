using System.Text.Json;
using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// تكويد العميل مع أرصدته الافتتاحية للخدمات: كل رصيد يصبح حجز خدمة مؤكدًا في
/// نفس المعاملة، فلا يُنشأ عميل بلا أرصدته ولا أرصدة بلا عميل — 0104.
/// </summary>
public sealed partial class PartnerRepository
{
    private const string OpeningBalanceNote = "رصيد افتتاحي للخدمات";

    private sealed class OpeningServiceRow
    {
        public Guid Id { get; set; }
        public Guid BaseUnitId { get; set; }
        public string ItemType { get; set; } = "";
        public bool IsActive { get; set; }
    }

    /// <summary>إدراج طرف داخل اتصال/معاملة قائمة (يُستخدم في التكويد المفرد والمتكامل).</summary>
    private static async Task<Guid> InsertPartnerAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, PartnerKind kind, PartnerInput input, CancellationToken ct)
    {
        var sql = $"""
            INSERT INTO {Table(kind)}
                (code, name_ar, name_en, category_id, scope_type, branch_id, phone, phone2,
                 whatsapp_phone, email, address, tax_number, credit_limit, notes, is_active,
                 custom_fields)
            VALUES
                (@Code, @NameAr, @NameEn, @CategoryId, @ScopeType, @BranchId, @Phone, @Phone2,
                 @WhatsAppPhone, @Email, @Address, @TaxNumber, @CreditLimit, @Notes, @IsActive,
                  CAST(@CustomFields AS jsonb))
            RETURNING id
            """;
        return await connection.ExecuteScalarAsync<Guid>(new CommandDefinition(sql, new
        {
            input.Code, input.NameAr, input.NameEn, input.CategoryId, input.ScopeType,
            input.BranchId, input.Phone, input.Phone2, input.WhatsAppPhone, input.Email,
            input.Address, input.TaxNumber,
            input.CreditLimit, input.Notes, input.IsActive,
            CustomFields = JsonSerializer.Serialize(input.CustomFields)
        }, tx, cancellationToken: ct));
    }

    public async Task<Partner> CreateWithOpeningBalancesAsync(PartnerInput input,
        IReadOnlyList<ServiceOpeningBalanceInput> balances, Guid branchId, Guid userId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var customerId = await InsertPartnerAsync(connection, tx, PartnerKind.Customer, input, ct);

        var warehouseId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT w.id FROM warehouses w
            JOIN warehouse_branches wb ON wb.warehouse_id = w.id
            WHERE wb.branch_id = @branchId AND w.is_active
            ORDER BY w.code LIMIT 1
            """, new { branchId }, tx, cancellationToken: ct))
            ?? throw new ValidationAppException("validation.warehouse_required");

        var serviceIds = balances.Select(b => b.ServiceId).Distinct().ToArray();
        var services = (await connection.QueryAsync<OpeningServiceRow>(new CommandDefinition("""
            SELECT id AS Id, base_unit_id AS BaseUnitId, item_type AS ItemType, is_active AS IsActive
            FROM items WHERE id = ANY(@serviceIds)
            """, new { serviceIds }, tx, cancellationToken: ct))).ToDictionary(s => s.Id);
        if (services.Count != serviceIds.Length)
            throw new ValidationAppException("validation.item_not_found");

        var docDate = DateTime.UtcNow.Date;
        foreach (var balance in balances)
        {
            var service = services[balance.ServiceId];
            if (!service.IsActive) throw new ValidationAppException("validation.item_inactive");
            if (!string.Equals(service.ItemType, "SERVICE", StringComparison.OrdinalIgnoreCase))
                throw new ValidationAppException("validation.item_not_service");
            if (balance.Quantity <= 0)
                throw new ValidationAppException("validation.quantity_invalid");
            if (balance.UnitPrice < 0)
                throw new ValidationAppException("validation.price_invalid");
            var total = balance.TotalAmount;
            if (balance.PaidAmount < 0 || balance.PaidAmount > total)
                throw new ValidationAppException("validation.paid_exceeds_total");

            var bookingId = Guid.CreateVersion7();
            var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
                SELECT next_document_number('BOOK'::varchar, @branchId::uuid, @docDate::date,
                                            'BK'::varchar, 6::smallint)
                """, new { branchId, docDate }, tx, cancellationToken: ct));
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO bookings (id, branch_id, doc_no, booking_date, status, customer_id,
                    source, total_amount, deposit_amount, notes, created_by)
                VALUES (@bookingId, @branchId, @docNo, @docDate, 'confirmed', @customerId,
                        'manual', @total, @paid, @notes, @userId)
                """, new { bookingId, branchId, docNo, docDate, customerId, total,
                    paid = balance.PaidAmount, notes = OpeningBalanceNote, userId }, tx,
                cancellationToken: ct));

            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO booking_lines (booking_id, line_no, item_id, unit_id, warehouse_id,
                    quantity, unit_price, net_amount, tax_amount, total_amount, reserved_qty)
                VALUES (@bookingId, 1, @itemId, @unitId, @warehouseId, @quantity, @unitPrice,
                        @total, 0, @total, @quantity)
                """, new { bookingId, itemId = balance.ServiceId, unitId = service.BaseUnitId,
                    warehouseId, quantity = balance.Quantity, unitPrice = balance.UnitPrice,
                    total }, tx, cancellationToken: ct));
        }

        await tx.CommitAsync(ct);
        return (await GetAsync(PartnerKind.Customer, customerId, ct))!;
    }
}
