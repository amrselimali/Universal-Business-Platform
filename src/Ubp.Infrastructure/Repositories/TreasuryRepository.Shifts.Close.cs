using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    /// <summary>
    /// إغلاق شفت الفرع (0076): المتوقع لكل خزينة = لقطة افتتاحها + حركتها خلال الشفت،
    /// والنقد الفعلي يُدخل يدوياً لكل خزينة ويُحفظ **مسودة** (draft) مع الفرق — بلا أي
    /// ترحيل للحسابات؛ الترحيل يتم باعتماد المحاسب. counts = null يعني إغلاقاً آلياً.
    /// </summary>
    public async Task<Shift> CloseShiftAsync(Guid shiftId,
        IReadOnlyList<ShiftCashCountInput>? counts, ShiftSettlementInput? settlement,
        Guid userId, bool autoClosed, CancellationToken ct = default)
    {
        if (counts is not null && counts.Any(c => c.CountedCash < 0))
            throw new ValidationAppException("validation.shift_counted_cash");

        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var shift = await connection.QuerySingleOrDefaultAsync<ShiftRow>(new CommandDefinition(
            ShiftSelect + " WHERE s.id = @shiftId FOR UPDATE OF s", new { shiftId }, tx,
            cancellationToken: ct)) ?? throw new NotFoundAppException();
        if (shift.Status != ShiftStatuses.Open)
            throw new ValidationAppException("validation.shift_not_open");

        // إنشاء تسوية الدكتور قبل حساب النقد المتوقع حتى يدخل الجزء المسدد من الخزينة في الحركة.
        await CreateExternalDoctorSettlementAsync(connection, tx, shift, settlement, userId,
            autoClosed, ct);

        var rows = (await QueryCashCountsAsync(connection, shiftId, tx, ct)).ToList();
        decimal totalExpected = 0, totalCounted = 0, totalVariance = 0;

        foreach (var row in rows)
        {
            var movement = await TreasuryMovementAsync(connection, tx, row.TreasuryId,
                shift.BranchId, shiftId, shift.OpenedAt, null, ct);
            // النقد المتوقع = أول المدة + حركة اليوم (محصَّل شامل عمولة العميل − عمولة المزود) (0079).
            var expected = Math.Round(row.OpeningCash + movement, 2,
                MidpointRounding.AwayFromZero);
            var counted = counts?.FirstOrDefault(c => c.TreasuryId == row.TreasuryId)?.CountedCash
                          ?? expected;
            counted = Math.Round(counted, 2, MidpointRounding.AwayFromZero);
            var variance = Math.Round(counted - expected, 2, MidpointRounding.AwayFromZero);

            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE shift_cash_counts
                SET expected_cash = @expected, counted_cash = @counted, variance = @variance,
                    status = 'draft'
                WHERE id = @id
                """, new { expected, counted, variance, id = row.Id }, tx, cancellationToken: ct));

            totalExpected += expected; totalCounted += counted; totalVariance += variance;
        }

        // خزائن أُضيفت بعد فتح الشفت: تُسجَّل مسودة كذلك حتى تُراجَع.
        foreach (var input in (counts ?? Array.Empty<ShiftCashCountInput>())
                 .Where(c => rows.All(r => r.TreasuryId != c.TreasuryId)))
        {
            await connection.ExecuteAsync(new CommandDefinition("""
                INSERT INTO shift_cash_counts (id, shift_id, treasury_id, opening_cash,
                    expected_cash, counted_cash, variance, status)
                VALUES (@id, @shiftId, @treasuryId, 0, 0, @counted, @counted, 'draft')
                ON CONFLICT (shift_id, treasury_id) DO NOTHING
                """, new
            {
                id = Guid.CreateVersion7(), shiftId, treasuryId = input.TreasuryId,
                counted = Math.Round(input.CountedCash, 2, MidpointRounding.AwayFromZero)
            }, tx, cancellationToken: ct));
            totalCounted += input.CountedCash;
            totalVariance += input.CountedCash;
        }

        await CaptureReviewItemsAsync(connection, tx, shift, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE cashier_shifts SET expected_cash = @expected, counted_cash = @counted,
                variance = @variance, status = 'closed', closed_at = now(), closed_by = @userId,
                auto_closed = @autoClosed, review_status = 'pending', updated_by = @userId
            WHERE id = @shiftId
            """, new
        {
            expected = Math.Round(totalExpected, 2), counted = Math.Round(totalCounted, 2),
            variance = Math.Round(totalVariance, 2), userId, autoClosed, shiftId
        }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (await GetShiftAsync(shiftId, ct))!;
    }

    /// <summary>
    /// صافي حركة نقدية خزينة واحدة خلال الشفت (المرحّل + المسودات، أياً كانت طريقة الدفع):
    /// الإيصالات تُحسب بالإجمالي المحصَّل شاملاً عمولة العميل ومخصومًا منها عمولة مزود الخدمة،
    /// وتُخصم سندات الصرف والتحويلات الخارجة وتسليمات النقدية وسلف الموظفين المسددة نقدًا،
    /// وتُضاف تسويات الحسابات الوسيطة (بطاقة/محفظة/شيك) إلى الخزينة (0219).
    /// هذه هي نفس الحركة المستخدمة في «النقد المتوقع» = أول المدة + حركة اليوم.
    /// </summary>
    internal static async Task<decimal> TreasuryMovementAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid treasuryId, Guid branchId, Guid shiftId,
        DateTimeOffset openedAt, DateTimeOffset? until, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<decimal>(new CommandDefinition("""
            SELECT COALESCE(SUM(CASE
                       WHEN v.treasury_id = @treasuryId AND v.is_shift_settlement
                            AND v.voucher_type = 'receipt'
                           THEN v.settlement_treasury_amount
                       WHEN v.treasury_id = @treasuryId AND v.is_shift_settlement
                            AND v.voucher_type = 'payment'
                           THEN -v.settlement_treasury_amount
                       WHEN v.treasury_id = @treasuryId AND v.voucher_type = 'receipt'
                            AND EXISTS (SELECT 1 FROM customer_account_settlements bs
                                        WHERE bs.voucher_id = v.id)
                           -- الاسترداد للعميل يخفض النقد والتحصيل يرفعه (صافي حركة التسوية).
                           THEN COALESCE((SELECT SUM(CASE WHEN cl.direction = 'collect'
                                                         THEN cl.amount ELSE -cl.amount END)
                                          FROM customer_account_settlements bs
                                          JOIN customer_account_settlement_cash_lines cl
                                            ON cl.settlement_id = bs.id
                                          WHERE bs.voucher_id = v.id), -v.total_amount)
                       WHEN v.treasury_id = @treasuryId AND v.voucher_type = 'receipt'
                           THEN v.total_amount - v.provider_fee_total
                       WHEN v.treasury_id = @treasuryId AND v.voucher_type = 'payment'
                           THEN -v.total_amount
                       WHEN v.treasury_id = @treasuryId AND v.voucher_type = 'transfer'
                           THEN -(v.total_amount + v.fee_total)
                       WHEN v.to_treasury_id = @treasuryId AND v.voucher_type = 'transfer'
                           THEN v.total_amount
                       ELSE 0 END), 0)
                   -- تسليم النقدية للحساب الوسيط يخفض نقدية الخزينة في الشفت (0080)
                   - COALESCE((SELECT SUM(h.amount + h.commission_amount) FROM cash_handovers h
                               WHERE h.treasury_id = @treasuryId AND h.branch_id = @branchId
                                 AND h.created_at >= @openedAt
                                 AND (@until::timestamptz IS NULL
                                      OR h.created_at <= @until::timestamptz)), 0)
                   -- سلف الموظفين المسددة نقدًا من الخزينة (بلا حساب وسيط لطريقة الدفع).
                   - COALESCE((SELECT SUM(a.amount) FROM employee_advances a
                               WHERE a.treasury_id = @treasuryId AND a.branch_id = @branchId
                                 AND a.status = 'posted'
                                 AND NOT EXISTS (SELECT 1 FROM treasury_methods m
                                                 WHERE m.id = a.treasury_method_id
                                                   AND m.clearing_account_id IS NOT NULL)
                                 AND a.created_at >= @openedAt
                                 AND (@until::timestamptz IS NULL
                                      OR a.created_at <= @until::timestamptz)), 0)
                   -- تسوية حساب وسيط إلى الخزينة (بطاقة/محفظة/شيك): تزيد النقد أو تنقصه (0219).
                   -- التسوية المربوطة بالشفت تُحسب دائمًا حتى لو أُنشئت بعد إغلاقه (تسوية شفت أمس).
                   + COALESCE((SELECT SUM(cs.amount) FROM treasury_clearing_settlements cs
                               WHERE cs.treasury_id = @treasuryId
                                 AND cs.branch_id = @branchId
                                 AND (cs.shift_id = @shiftId
                                      OR (cs.shift_id IS NULL
                                          AND cs.created_at >= @openedAt
                                          AND (@until::timestamptz IS NULL
                                               OR cs.created_at <= @until::timestamptz)))), 0)
            FROM vouchers v
            -- الخزينة قد تكون خزينة شركة مشتركة: تُحسب حركة فرع الشفت فقط — 0216.
            WHERE v.branch_id = @branchId AND v.status <> 'cancelled'
              AND v.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR v.created_at <= @until::timestamptz)
              AND (v.treasury_id = @treasuryId OR v.to_treasury_id = @treasuryId)
            """, new { treasuryId, branchId, shiftId, openedAt, until }, tx, cancellationToken: ct));


    /// <summary>عدّ النقدية لكل خزينة في الشفت.</summary>
    private static async Task<IReadOnlyList<ShiftCashCount>> QueryCashCountsAsync(
        NpgsqlConnection connection, Guid shiftId, NpgsqlTransaction? tx,
        CancellationToken ct) =>
        (await connection.QueryAsync<ShiftCashCount>(new CommandDefinition("""
            SELECT c.id AS Id, c.shift_id AS ShiftId, c.treasury_id AS TreasuryId,
                   t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   t.treasury_type AS TreasuryType, c.opening_cash AS OpeningCash,
                   c.expected_cash AS ExpectedCash, c.counted_cash AS CountedCash,
                   c.variance AS Variance, c.status AS Status
            FROM shift_cash_counts c
            JOIN treasuries t ON t.id = c.treasury_id
            WHERE c.shift_id = @shiftId
            ORDER BY t.code
            """, new { shiftId }, tx, cancellationToken: ct))).ToList();

    /// <summary>تحديث القراءة الفعلية لعداد جهاز مع تسجيل قراءة في سجل العدّاد — 0078.</summary>
    public async Task<bool> SetMeterReadingAsync(Guid assetId, decimal value, Guid userId,
        CancellationToken ct = default)
    {
        if (value < 0) throw new ValidationAppException("validation.meter_units_required");
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var updated = await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE fixed_assets SET current_meter_value = @value, updated_by = @userId " +
            "WHERE id = @assetId AND is_metered", new { assetId, value, userId }, tx,
            cancellationToken: ct));
        if (updated == 0) { await tx.RollbackAsync(ct); return false; }
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO asset_meter_readings (asset_id, value, delta, source, created_by)
            VALUES (@assetId, @value, 0, 'MANUAL', @userId)
            """, new { assetId, value, userId }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        return true;
    }

    /// <summary>حفظ ملاحظات الشفت لتظهر في العرض والإغلاق كل مرة — 0078.</summary>
    public async Task<bool> SaveShiftNotesAsync(Guid shiftId, string? notes,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await connection.ExecuteAsync(new CommandDefinition(
            "UPDATE cashier_shifts SET notes = @notes WHERE id = @shiftId",
            new { shiftId, notes }, cancellationToken: ct)) > 0;
    }

    /// <summary>
    /// حفظ النقد المعدود لخزينة في الشفت المفتوح فور الكتابة (مسودة) مع حساب الفرق،
    /// حتى لا يضيع ما سجّله المستخدم عند إعادة فتح التقرير أو طباعته — 0095.
    /// </summary>
    public async Task<bool> SaveCashCountAsync(Guid shiftId, Guid treasuryId,
        decimal countedCash, CancellationToken ct = default)
    {
        if (countedCash < 0) throw new ValidationAppException("validation.shift_counted_cash");
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        // الشفت المفتوح فقط يقبل العدّ (مسودة قبل الإغلاق).
        var shift = await connection.QuerySingleOrDefaultAsync<(DateTimeOffset OpenedAt,
            DateTimeOffset? ClosedAt, Guid BranchId)>(new CommandDefinition("""
            SELECT opened_at AS OpenedAt, closed_at AS ClosedAt, branch_id AS BranchId
            FROM cashier_shifts WHERE id = @shiftId AND status = 'open'
            FOR UPDATE
            """, new { shiftId }, tx, cancellationToken: ct));
        if (shift.OpenedAt == default) { await tx.RollbackAsync(ct); return false; }

        var row = await connection.QuerySingleOrDefaultAsync<(Guid Id, decimal OpeningCash)>(
            new CommandDefinition("""
            SELECT id AS Id, opening_cash AS OpeningCash FROM shift_cash_counts
            WHERE shift_id = @shiftId AND treasury_id = @treasuryId
            FOR UPDATE
            """, new { shiftId, treasuryId }, tx, cancellationToken: ct));
        if (row.Id == Guid.Empty) { await tx.RollbackAsync(ct); return false; }

        // القيم تُحسب ديناميكيًا عند كل حفظ: أي إيصال/عمولة/تسليم جديد ينعكس فورًا
        // على حركة اليوم والنقد المتوقع والفرق بدون انتظار إغلاق الشفت.
        var movement = await TreasuryMovementAsync(connection, tx, treasuryId, shift.BranchId,
            shiftId, shift.OpenedAt, null, ct);
        var expected = Math.Round(row.OpeningCash + movement, 2,
            MidpointRounding.AwayFromZero);
        var counted = Math.Round(countedCash, 2, MidpointRounding.AwayFromZero);
        var variance = Math.Round(counted - expected, 2, MidpointRounding.AwayFromZero);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE shift_cash_counts
            SET expected_cash = @expected, counted_cash = @counted, variance = @variance
            WHERE id = @id
            """, new { expected, counted, variance, id = row.Id }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<ShiftCashCount>> ListCashCountsAsync(Guid shiftId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return await QueryCashCountsAsync(connection, shiftId, null, ct);
    }
}
