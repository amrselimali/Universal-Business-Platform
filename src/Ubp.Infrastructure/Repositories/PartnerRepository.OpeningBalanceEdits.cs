using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// التعديل المباشر للأرصدة الافتتاحية للعميل: قراءة البنود القابلة للتعديل وتحديثها
/// (أو إضافة/حذف بند) في معاملة واحدة، مع إعادة حساب reserved_qty وإجمالي الحجز
/// والمسدد. لا تُنشأ قيود ولا سندات ولا حركة مخزون — تمامًا مثل إنشاء الرصيد.
/// </summary>
public sealed partial class PartnerRepository
{
    private sealed class OpeningBalanceRow
    {
        public Guid BookingId { get; set; }
        public Guid BookingLineId { get; set; }
        public Guid BranchId { get; set; }
        public string? DocNo { get; set; }
        public DateTime BookingDate { get; set; }
        public string Status { get; set; } = "";
        public Guid ServiceId { get; set; }
        public string ServiceCode { get; set; } = "";
        public string ServiceName { get; set; } = "";
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal DeliveredQty { get; set; }
        public decimal InvoicedQty { get; set; }
        public decimal TransferredQty { get; set; }
        public decimal SettledQty { get; set; }
        public int PaymentCount { get; set; }
        public int SettlementCount { get; set; }
        public int RelatedCount { get; set; }
        public int LineCount { get; set; }
        public decimal ReceiptsAmount { get; set; }
    }

    private sealed class OpeningEditServiceRow
    {
        public Guid Id { get; set; }
        public Guid BaseUnitId { get; set; }
        public string ItemType { get; set; } = "";
        public bool IsActive { get; set; }
        public Guid? BranchId { get; set; }
    }

    private const string OpeningBalanceSelect = """
        SELECT b.id AS BookingId, l.id AS BookingLineId, b.branch_id AS BranchId,
               b.doc_no AS DocNo, b.booking_date AS BookingDate, b.status AS Status,
               l.item_id AS ServiceId, i.code AS ServiceCode, i.name_ar AS ServiceName,
               l.quantity AS Quantity, l.unit_price AS UnitPrice,
               b.deposit_amount AS PaidAmount,
               l.delivered_qty AS DeliveredQty, l.invoiced_qty AS InvoicedQty,
               l.transferred_qty AS TransferredQty, l.settled_qty AS SettledQty,
               (SELECT count(*)::int FROM booking_payments p WHERE p.booking_id = b.id)
                   AS PaymentCount,
               COALESCE((SELECT SUM(p.amount) FROM booking_payments p
                          WHERE p.booking_id = b.id), 0) AS ReceiptsAmount,
               (SELECT count(*)::int FROM customer_account_settlement_lines s
                 WHERE s.booking_id = b.id) AS SettlementCount,
               (SELECT count(*)::int FROM bookings x WHERE x.related_booking_id = b.id)
                   AS RelatedCount,
               (SELECT count(*)::int FROM booking_lines bl WHERE bl.booking_id = b.id)
                   AS LineCount
        FROM bookings b
        JOIN booking_lines l ON l.booking_id = b.id
        JOIN items i ON i.id = l.item_id
        WHERE b.customer_id = @customerId AND b.is_opening_balance
        """;

    /// <summary>
    /// سبب منع التعديل قبل أي عملية على البند: التنفيذ/التحصيل/التحويل/التسوية
    /// أو ارتباط بحجز آخر. البند الحر فقط هو القابل للتعديل والحذف.
    /// </summary>
    private static string? OpeningBalanceLockReason(OpeningBalanceRow row)
    {
        if (row.LineCount > 1) return "opening_balances.lock_multiline";
        if (Math.Max(row.DeliveredQty, row.InvoicedQty) > 0)
            return "opening_balances.lock_executed";
        if (row.SettledQty > 0 || row.SettlementCount > 0)
            return "opening_balances.lock_settled";
        if (row.TransferredQty != 0) return "opening_balances.lock_transferred";
        if (row.PaymentCount > 0) return "opening_balances.lock_collected";
        if (row.Status is not ("confirmed" or "partially_delivered" or "completed"))
            return "opening_balances.lock_status";
        if (row.RelatedCount > 0) return "opening_balances.lock_linked";
        return null;
    }

    /// <summary>
    /// المسدد فقط يظل قابلًا للتعديل بعد التنفيذ أو التحصيل (بدون أي أثر محاسبي)،
    /// ويُمنع بعد التحويل أو التسوية أو في الحجز متعدد البنود أو غير الصالح.
    /// </summary>
    private static bool OpeningBalancePaidEditable(OpeningBalanceRow row) =>
        row.LineCount == 1 &&
        row.Status is "confirmed" or "partially_delivered" or "completed" &&
        row.TransferredQty == 0 &&
        row.SettledQty == 0 && row.SettlementCount == 0;

    private static decimal OpeningBalanceMaxPaid(OpeningBalanceRow row) => Math.Max(
        RoundAmount(row.Quantity * row.UnitPrice) - row.ReceiptsAmount, 0);

    private static PartnerOpeningBalanceLine MapOpeningBalance(OpeningBalanceRow row) => new()
    {
        BookingId = row.BookingId, BookingLineId = row.BookingLineId, BranchId = row.BranchId,
        DocNo = row.DocNo, BookingDate = row.BookingDate, Status = row.Status,
        ServiceId = row.ServiceId, ServiceCode = row.ServiceCode, ServiceName = row.ServiceName,
        Quantity = row.Quantity, UnitPrice = row.UnitPrice, PaidAmount = row.PaidAmount,
        DeliveredQty = row.DeliveredQty, InvoicedQty = row.InvoicedQty,
        TransferredQty = row.TransferredQty, SettledQty = row.SettledQty,
        PaymentCount = row.PaymentCount, SettlementCount = row.SettlementCount,
        RelatedCount = row.RelatedCount, LineCount = row.LineCount,
        ReceiptsAmount = row.ReceiptsAmount,
        LockReasonKey = OpeningBalanceLockReason(row),
        CanEditPaid = OpeningBalancePaidEditable(row)
    };

    public async Task<IReadOnlyList<PartnerOpeningBalanceLine>> ListOpeningBalancesAsync(
        Guid customerId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var rows = await connection.QueryAsync<OpeningBalanceRow>(new CommandDefinition(
            OpeningBalanceSelect +
            " ORDER BY b.booking_date, b.doc_no NULLS LAST, l.line_no",
            new { customerId }, cancellationToken: ct));
        return rows.Select(MapOpeningBalance).ToList();
    }

    private static decimal RoundAmount(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public async Task<PartnerOpeningBalanceEditResult> UpdateOpeningBalancesAsync(Guid customerId,
        Guid branchId, IReadOnlyList<PartnerOpeningBalanceEditLine> lines, Guid userId,
        CancellationToken ct = default)
    {
        if (branchId == Guid.Empty) throw new ValidationAppException("validation.branch_required");

        var submittedIds = lines.Where(l => l.BookingLineId.HasValue)
            .Select(l => l.BookingLineId!.Value).ToList();
        if (submittedIds.Count != submittedIds.Distinct().Count())
            throw new ValidationAppException("validation.duplicate_value");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        // قفل حجوزات العميل الافتتاحية ومنع التعديل بعد التنفيذ/التحصيل/التسوية.
        var existing = (await connection.QueryAsync<OpeningBalanceRow>(new CommandDefinition(
            OpeningBalanceSelect +
            " ORDER BY b.booking_date, b.doc_no NULLS LAST, l.line_no FOR UPDATE OF b, l",
            new { customerId }, tx, cancellationToken: ct))).ToDictionary(r => r.BookingLineId);

        if (submittedIds.Any(id => !existing.ContainsKey(id)))
            throw new ValidationAppException("validation.booking_not_found");

        // البنود المسحوبة من الشاشة تُحذف — أما المقفلة (استُخدمت) فتبقى كما هي.
        var omittedRows = existing.Values
            .Where(r => !submittedIds.Contains(r.BookingLineId)).ToList();
        var keptLocked = omittedRows
            .Where(r => OpeningBalanceLockReason(r) is not null).ToList();
        var removedRows = omittedRows.Except(keptLocked).ToList();

        // الخدمات المطلوبة (الجديدة أو المعدَّلة) تُفحص مرة واحدة.
        var serviceIds = lines.Select(l => l.ServiceId
                ?? (l.BookingLineId is { } id && existing.TryGetValue(id, out var row)
                    ? row.ServiceId : (Guid?)null))
            .Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();
        var services = (await connection.QueryAsync<OpeningEditServiceRow>(new CommandDefinition("""
            SELECT id AS Id, base_unit_id AS BaseUnitId, item_type AS ItemType,
                   is_active AS IsActive, branch_id AS BranchId
            FROM items WHERE id = ANY(@serviceIds)
            """, new { serviceIds }, tx, cancellationToken: ct))).ToDictionary(s => s.Id);

        Guid? warehouseId = null;
        var changes = new List<PartnerOpeningBalanceChange>();
        var result = new PartnerOpeningBalanceEditResult
        {
            OldTotal = existing.Values.Sum(r => RoundAmount(r.Quantity * r.UnitPrice)),
            OldPaid = existing.Values.Sum(r => r.PaidAmount),
            NewTotal = keptLocked.Sum(r => RoundAmount(r.Quantity * r.UnitPrice)),
            NewPaid = keptLocked.Sum(r => r.PaidAmount)
        };
        var docDate = DateTime.UtcNow.Date;

        foreach (var line in lines)
        {
            OpeningBalanceRow? current = null;
            var bookingBranch = branchId;
            Guid serviceId;
            if (line.BookingLineId is { } bookingLineId)
            {
                current = existing[bookingLineId];
                bookingBranch = current.BranchId;
                serviceId = line.ServiceId ?? current.ServiceId;
            }
            else
            {
                serviceId = line.ServiceId
                    ?? throw new ValidationAppException("validation.required_fields");
            }

            var service = services.GetValueOrDefault(serviceId)
                ?? throw new ValidationAppException("validation.item_not_found");
            if (!service.IsActive) throw new ValidationAppException("validation.item_inactive");
            if (!string.Equals(service.ItemType, "SERVICE", StringComparison.OrdinalIgnoreCase))
                throw new ValidationAppException("validation.item_not_service");
            if (service.BranchId is { } itemBranch && itemBranch != bookingBranch)
                throw new ValidationAppException("validation.item_not_found");

            var total = RoundAmount(line.Quantity * line.UnitPrice);
            if (current is not null)
            {
                var sameStructure = serviceId == current.ServiceId
                    && line.Quantity == current.Quantity && line.UnitPrice == current.UnitPrice;
                var paidChanged = line.PaidAmount != current.PaidAmount;
                var structuralLock = OpeningBalanceLockReason(current);

                // الكمية/السعر/الخدمة مقفولة بعد الاستخدام، أما المسدد فيبقى قابلًا للتعديل
                // بعد التنفيذ/التحصيل بحد أقصى قيمة الخدمة ناقص الإيصالات المسجلة.
                if ((structuralLock is not null && !sameStructure) ||
                    (paidChanged && !OpeningBalancePaidEditable(current)))
                    throw new ValidationAppException("validation.opening_balance_locked",
                        new Dictionary<string, string> { ["item"] = current.ServiceName });
                if (line.PaidAmount < 0 || line.PaidAmount > OpeningBalanceMaxPaid(current))
                    throw new ValidationAppException("validation.paid_exceeds_total");

                if (!sameStructure || paidChanged)
                {
                    if (structuralLock is null)
                    {
                        await connection.ExecuteAsync(new CommandDefinition("""
                            UPDATE booking_lines
                               SET item_id = @itemId, unit_id = @unitId, quantity = @quantity,
                                   unit_price = @unitPrice, net_amount = @total, total_amount = @total,
                                   reserved_qty = @quantity
                             WHERE id = @lineId
                            """, new
                        {
                            lineId = current.BookingLineId, itemId = serviceId,
                            unitId = service.BaseUnitId, quantity = line.Quantity,
                            unitPrice = line.UnitPrice, total
                        }, tx, cancellationToken: ct));

                        await connection.ExecuteAsync(new CommandDefinition("""
                            UPDATE bookings
                               SET total_amount = @total, deposit_amount = @paid, updated_by = @userId
                             WHERE id = @bookingId
                            """, new { total, paid = line.PaidAmount, userId, bookingId = current.BookingId },
                            tx, cancellationToken: ct));
                    }
                    else
                    {
                        // تعديل المسدد فقط: لا لمس للكميات ولا للحركات اللاحقة.
                        await connection.ExecuteAsync(new CommandDefinition("""
                            UPDATE bookings
                               SET deposit_amount = @paid, updated_by = @userId
                             WHERE id = @bookingId
                            """, new { paid = line.PaidAmount, userId, bookingId = current.BookingId },
                            tx, cancellationToken: ct));
                    }

                    changes.Add(new PartnerOpeningBalanceChange
                    {
                        BookingId = current.BookingId, Action = "UPDATE",
                        OldValues = new
                        {
                            current.DocNo, current.ServiceId, current.Quantity, current.UnitPrice,
                            current.PaidAmount, Total = RoundAmount(current.Quantity * current.UnitPrice)
                        },
                        NewValues = new
                        {
                            current.DocNo, ServiceId = serviceId, line.Quantity,
                            line.UnitPrice, line.PaidAmount, Total = total
                        }
                    });
                    result.Updated++;
                }

                result.NewTotal += total;
                result.NewPaid += line.PaidAmount;
                continue;
            }
            else
            {
                warehouseId ??= await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
                    SELECT w.id FROM warehouses w
                    JOIN warehouse_branches wb ON wb.warehouse_id = w.id
                    WHERE wb.branch_id = @branchId AND w.is_active
                    ORDER BY w.code LIMIT 1
                    """, new { branchId }, tx, cancellationToken: ct))
                    ?? throw new ValidationAppException("validation.warehouse_required");

                var bookingId = Guid.CreateVersion7();
                var docNo = await connection.ExecuteScalarAsync<string>(new CommandDefinition("""
                    SELECT next_document_number('BOOK'::varchar, @branchId::uuid, @docDate::date,
                                                'BK'::varchar, 6::smallint)
                    """, new { branchId, docDate }, tx, cancellationToken: ct));
                await connection.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO bookings (id, branch_id, doc_no, booking_date, status, customer_id,
                        source, total_amount, deposit_amount, notes, is_opening_balance, created_by)
                    VALUES (@bookingId, @branchId, @docNo, @docDate, 'confirmed', @customerId,
                            'manual', @total, @paid, @notes, true, @userId)
                    """, new { bookingId, branchId, docNo, docDate, customerId, total,
                        paid = line.PaidAmount, notes = OpeningBalanceNote, userId },
                    tx, cancellationToken: ct));
                await connection.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO booking_lines (booking_id, line_no, item_id, unit_id, warehouse_id,
                        quantity, unit_price, net_amount, tax_amount, total_amount, reserved_qty)
                    VALUES (@bookingId, 1, @itemId, @unitId, @warehouseId, @quantity, @unitPrice,
                            @total, 0, @total, @quantity)
                    """, new
                {
                    bookingId, itemId = serviceId, unitId = service.BaseUnitId,
                    warehouseId = warehouseId!.Value, quantity = line.Quantity,
                    unitPrice = line.UnitPrice, total
                }, tx, cancellationToken: ct));

                changes.Add(new PartnerOpeningBalanceChange
                {
                    BookingId = bookingId, Action = "INSERT",
                    NewValues = new
                    {
                        DocNo = docNo, ServiceId = serviceId, line.Quantity,
                        line.UnitPrice, line.PaidAmount, Total = total
                    }
                });
                result.Added++;
            }

            result.NewTotal += total;
            result.NewPaid += line.PaidAmount;
        }

        foreach (var row in removedRows)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "DELETE FROM bookings WHERE id = @id", new { id = row.BookingId }, tx,
                cancellationToken: ct));
            changes.Add(new PartnerOpeningBalanceChange
            {
                BookingId = row.BookingId, Action = "DELETE",
                OldValues = new
                {
                    row.DocNo, row.ServiceId, row.Quantity, row.UnitPrice,
                    row.PaidAmount, Total = RoundAmount(row.Quantity * row.UnitPrice)
                }
            });
            result.Removed++;
        }

        await tx.CommitAsync(ct);
        result.Changes = changes;
        return result;
    }
}
