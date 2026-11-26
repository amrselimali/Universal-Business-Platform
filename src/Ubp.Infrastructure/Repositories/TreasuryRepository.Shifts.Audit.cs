using Dapper;
using Npgsql;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    public async Task<IReadOnlyList<ShiftReviewItem>> ListReviewItemsAsync(Guid shiftId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return (await QueryReviewItemsAsync(connection, shiftId, ct)).ToList();
    }

    private static async Task<IReadOnlyList<ShiftReviewItem>> QueryReviewItemsAsync(
        NpgsqlConnection connection, Guid shiftId, CancellationToken ct) =>
        (await connection.QueryAsync<ShiftReviewItem>(new CommandDefinition("""
            SELECT i.id AS Id, i.shift_id AS ShiftId, i.screen_code AS ScreenCode,
                   i.entity_type AS EntityType, i.entity_id AS EntityId, i.doc_no AS DocNo,
                   i.doc_date AS DocDate, i.party_name AS PartyName, i.amount AS Amount,
                   i.doc_status AS DocStatus, i.status AS Status, i.reviewed_at AS ReviewedAt,
                   u.username AS ReviewedBy
            FROM shift_review_items i
            LEFT JOIN users u ON u.id = i.reviewed_by
            WHERE i.shift_id = @shiftId
            ORDER BY i.doc_date, i.doc_no, i.entity_id
            """, new { shiftId }, cancellationToken: ct))).ToList();

    /// <summary>ترحيل الشفت للحسابات: تعليمها «تحت المراجعة» حتى لو بلا بيانات — 0079.</summary>
    public async Task<bool> PostShiftAsync(Guid shiftId, Guid userId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        var updated = await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE cashier_shifts SET review_status = 'pending', updated_by = @userId
            WHERE id = @shiftId AND status = 'closed'
            """, new { shiftId, userId }, tx, cancellationToken: ct)) > 0;
        if (!updated) return false;

        // ترحيل إيصالات تسوية حساب العميل المسودة مع الشفت (القيد المسودة يصبح مرحّلًا) — 0096.
        var settlements = await connection.QueryAsync<Guid>(new CommandDefinition("""
            SELECT v.id
            FROM vouchers v
            JOIN customer_account_settlements bs ON bs.voucher_id = v.id AND bs.status = 'draft'
            JOIN cashier_shifts s ON s.id = @shiftId
            WHERE v.status = 'draft' AND v.branch_id = s.branch_id
              AND v.created_at >= s.opened_at
              AND (s.closed_at IS NULL OR v.created_at <= s.closed_at)
            """, new { shiftId }, tx, cancellationToken: ct));
        foreach (var voucherId in settlements)
            await BookingSettlementRepository.PostCoreAsync(connection, tx, voucherId, userId, ct);

        await tx.CommitAsync(ct);
        return true;
    }

    /// <summary>
    /// الحركات المسودة المعلّقة على الشفت والتي ستُرحَّل عند «اعتماد المراجعة» (0220):
    /// قيود مسودة + إيصالات/تنفيذات مسودة بلا قيد بعد — تُعرض للمحاسب قبل التأكيد.
    /// </summary>
    public async Task<IReadOnlyList<ShiftDraftPosting>> ListDraftPostingsAsync(Guid shiftId,
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        return (await connection.QueryAsync<ShiftDraftPosting>(new CommandDefinition("""
            SELECT e.id AS EntryId, e.source_type AS SourceType,
                   CASE e.source_type
                       WHEN 'voucher' THEN 'سند/إيصال'
                       WHEN 'execution' THEN 'تنفيذ خدمة'
                       WHEN 'employee_advance' THEN 'سلفة موظف'
                       WHEN 'operating_expense' THEN 'مصروف تشغيلي'
                       WHEN 'clearing_settlement' THEN 'تسوية حساب وسيط'
                       WHEN 'cash_handover' THEN 'تسليم نقدية'
                       WHEN 'purchase_return' THEN 'مرتجع مشتريات'
                       WHEN 'invoice' THEN 'فاتورة'
                       WHEN 'service_transfer' THEN 'تحويل خدمات'
                       WHEN 'stock_document' THEN 'حركة مخزون'
                       WHEN 'cash_shift' THEN 'فرق شفت'
                       ELSE e.source_type END AS SourceLabel,
                   e.reference AS DocNo, e.entry_date AS EntryDate,
                   e.description AS Description, e.total_debit AS Amount,
                   NULL::text AS PartyName
            FROM journal_entries e
            WHERE e.shift_id = @shiftId AND e.status = 'draft'
            UNION ALL
            SELECT v.id, 'voucher', 'سند/إيصال', v.doc_no, v.doc_date,
                   COALESCE(v.notes, 'إيصال مسودة يُرحَّل مع الاعتماد'), v.total_amount,
                   v.party_name
            FROM vouchers v
            WHERE v.shift_id = @shiftId AND v.status = 'draft'
              AND NOT EXISTS (SELECT 1 FROM journal_entries e
                              WHERE e.source_type = 'voucher' AND e.source_id = v.id)
            UNION ALL
            SELECT be.id, 'execution', 'تنفيذ خدمة', be.doc_no, be.execution_date,
                   'تنفيذ خدمات مسودة يُرحَّل مع الاعتماد',
                   COALESCE((SELECT SUM(el.total_amount) FROM booking_execution_lines el
                             WHERE el.execution_id = be.id), 0),
                   c.name_ar
            FROM booking_executions be
            LEFT JOIN bookings b ON b.id = be.booking_id
            LEFT JOIN customers c ON c.id = b.customer_id
            WHERE be.shift_id = @shiftId AND be.status = 'draft'
            ORDER BY 4, 2
            """, new { shiftId }, cancellationToken: ct))).ToList();
    }

    /// <summary>
    /// اعتماد مراجعة الشفت بواسطة يوزر محاسب (صلاحية APPROVE على شاشة الشفتات):
    /// يُرحّل فرق كل خزينة (زيادة/عجز) على حساب الخزينة المخصص أو الافتراضي، ويحوّل
    /// مسودات عدّ النقدية إلى «posted»، ثم يغلق المراجعة — 0076.
    /// </summary>
    public async Task<Shift> ReviewShiftAsync(Guid shiftId, Guid userId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        var shift = await connection.QuerySingleOrDefaultAsync<ShiftRow>(new CommandDefinition(
            ShiftSelect + " WHERE s.id = @shiftId FOR UPDATE OF s", new { shiftId }, tx,
            cancellationToken: ct)) ?? throw new NotFoundAppException();
        if (shift.Status == ShiftStatuses.Open)
            throw new ValidationAppException("validation.shift_not_closed");

        // الترحيل الفعلي لكل قيود الشفت المسودة (0220): لا يصل أي قيد للأستاذ قبل الاعتماد.
        await ShiftPostingGate.PostDeferredAsync(connection, tx, shiftId, userId, ct);

        var defaults = (await connection.QueryAsync<(string Key, Guid? AccountId)>(
            new CommandDefinition("SELECT setting_key, account_id FROM posting_defaults",
                transaction: tx, cancellationToken: ct)))
            .Where(r => r.AccountId.HasValue)
            .ToDictionary(r => r.Key, r => r.AccountId!.Value, StringComparer.OrdinalIgnoreCase);

        var counts = await connection.QueryAsync<(Guid Id, Guid TreasuryId, Guid AccountId,
            Guid? OverShortAccountId, string TreasuryType, decimal? Variance)>(
            new CommandDefinition("""
                SELECT c.id, c.treasury_id, t.account_id, t.over_short_account_id, t.treasury_type,
                       c.variance
                FROM shift_cash_counts c
                JOIN treasuries t ON t.id = c.treasury_id
                WHERE c.shift_id = @shiftId AND c.status = 'draft'
                FOR UPDATE OF c
                """, new { shiftId }, tx, cancellationToken: ct));

        foreach (var row in counts)
        {
            var variance = Math.Round(row.Variance ?? 0, 2, MidpointRounding.AwayFromZero);
            Guid? entryId = null;
            if (variance != 0)
            {
                var overShort = row.OverShortAccountId
                    ?? (defaults.TryGetValue(PostingKeys.CashOverShort, out var fallback)
                        ? fallback
                        : throw new ValidationAppException("validation.posting_account_missing",
                            new Dictionary<string, string>
                            {
                                ["key"] = PostingKeys.CashOverShort, ["module"] = "treasury"
                            }));

                var amount = Math.Abs(variance);
                var gl = variance > 0
                    ? new List<JournalLine>
                    {
                        new(row.AccountId, amount, 0), new(overShort, 0, amount)
                    }
                    : new List<JournalLine>
                    {
                        new(overShort, amount, 0), new(row.AccountId, 0, amount)
                    };

                await CreateVoucherEntryAsync(connection, tx, Guid.CreateVersion7(),
                    row.TreasuryType, shift.BranchId, DateTime.Today, shift.Code,
                    $"{(variance > 0 ? "زيادة" : "عجز")} شفت {shift.Code}", gl, userId,
                    row.Id, ct, "cash_shift");

                entryId = await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
                    SELECT id FROM journal_entries
                    WHERE source_type = 'cash_shift' AND source_id = @countId
                    """, new { countId = row.Id }, tx, cancellationToken: ct));
            }

            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE shift_cash_counts
                SET status = 'posted', posted_at = now(), posted_by = @userId,
                    journal_entry_id = @entryId
                WHERE id = @id
                """, new { userId, entryId, id = row.Id }, tx, cancellationToken: ct));
        }

        // عمولة التحصيل المحمَّلة على العميل: دائن حساب العمولة (مصروف سالب) ومدين الخزينة.
        var customerFees = await connection.QueryAsync<(Guid TreasuryAccountId, Guid FeeAccountId,
            string TreasuryType, decimal Fee)>(new CommandDefinition("""
            SELECT t.account_id, t.collection_fee_account_id, t.treasury_type,
                   ROUND(SUM(v.fee_total), 2) AS fee
            FROM shift_cash_counts c
            JOIN cashier_shifts s ON s.id = c.shift_id
            JOIN treasuries t ON t.id = c.treasury_id
            JOIN vouchers v ON v.branch_id = s.branch_id AND v.treasury_id = t.id
                 AND v.voucher_type = 'receipt' AND v.status <> 'cancelled'
                 AND NOT v.is_shift_settlement
                 AND NOT EXISTS (SELECT 1 FROM customer_account_settlements bs WHERE bs.voucher_id = v.id)
                 AND v.created_at >= s.opened_at
                 AND (s.closed_at IS NULL OR v.created_at <= s.closed_at)
            WHERE c.shift_id = @shiftId AND t.collection_fee_account_id IS NOT NULL
            GROUP BY t.account_id, t.collection_fee_account_id, t.treasury_type
            HAVING ROUND(SUM(v.fee_total), 2) > 0
            """, new { shiftId }, tx, cancellationToken: ct));

        foreach (var fee in customerFees)
        {
            var feeGl = new List<JournalLine>
            {
                new(fee.TreasuryAccountId, fee.Fee, 0), new(fee.FeeAccountId, 0, fee.Fee)
            };
            await CreateVoucherEntryAsync(connection, tx, Guid.CreateVersion7(),
                fee.TreasuryType, shift.BranchId, DateTime.Today, shift.Code,
                $"عمولة تحصيل محملة على العميل {shift.Code}", feeGl, userId, null, ct,
                "cash_shift");
        }

        // عمولة مزود الخدمة: مدين حساب العمولة (مصروف موجب) ودائن الخزينة (تُخصم منها).
        var providerFees = await connection.QueryAsync<(Guid TreasuryAccountId, Guid FeeAccountId,
            string TreasuryType, decimal Fee)>(new CommandDefinition("""
            SELECT t.account_id, t.provider_fee_account_id, t.treasury_type,
                   ROUND(SUM(v.provider_fee_total), 2) AS fee
            FROM shift_cash_counts c
            JOIN cashier_shifts s ON s.id = c.shift_id
            JOIN treasuries t ON t.id = c.treasury_id
            JOIN vouchers v ON v.branch_id = s.branch_id AND v.treasury_id = t.id
                 AND v.voucher_type = 'receipt' AND v.status <> 'cancelled'
                 AND NOT v.is_shift_settlement
                 AND v.created_at >= s.opened_at
                 AND (s.closed_at IS NULL OR v.created_at <= s.closed_at)
            WHERE c.shift_id = @shiftId AND t.provider_fee_account_id IS NOT NULL
            GROUP BY t.account_id, t.provider_fee_account_id, t.treasury_type
            HAVING ROUND(SUM(v.provider_fee_total), 2) > 0
            """, new { shiftId }, tx, cancellationToken: ct));

        foreach (var fee in providerFees)
        {
            var feeGl = new List<JournalLine>
            {
                new(fee.FeeAccountId, fee.Fee, 0), new(fee.TreasuryAccountId, 0, fee.Fee)
            };
            await CreateVoucherEntryAsync(connection, tx, Guid.CreateVersion7(),
                fee.TreasuryType, shift.BranchId, DateTime.Today, shift.Code,
                $"عمولة مزود الخدمة {shift.Code}", feeGl, userId, null, ct, "cash_shift");
        }

        // تطبيق تعديلات المراجعة على المستندات الأصلية وإنشاء قيود الفرق (موجب/سالب) — 0084.
        await ReviewAdjustmentRepository.ApplyPendingCoreAsync(connection, tx, shiftId, userId, ct);

        // ترحيل تحويلات الخدمات المسودة داخل الشفت: نقل الكميات والقيد بين حسابَي العميلين (0083).
        var pendingTransfers = await connection.QueryAsync<Guid>(new CommandDefinition("""
            SELECT st.id
            FROM service_transfers st
            JOIN cashier_shifts s ON s.id = @shiftId
            WHERE st.branch_id = s.branch_id AND st.status = 'draft'
              AND st.created_at >= s.opened_at
              AND (s.closed_at IS NULL OR st.created_at <= s.closed_at)
            """, new { shiftId }, tx, cancellationToken: ct));
        foreach (var transferId in pendingTransfers)
            await ServiceTransferRepository.PostCoreAsync(connection, tx, transferId, userId, ct);

        // ترحيل إيصالات تسوية حساب العميل المسودة المتبقية داخل الشفت — 0096.
        var pendingSettlements = await connection.QueryAsync<Guid>(new CommandDefinition("""
            SELECT v.id
            FROM vouchers v
            JOIN customer_account_settlements bs ON bs.voucher_id = v.id AND bs.status = 'draft'
            JOIN cashier_shifts s ON s.id = @shiftId
            WHERE v.status = 'draft' AND v.branch_id = s.branch_id
              AND v.created_at >= s.opened_at
              AND (s.closed_at IS NULL OR v.created_at <= s.closed_at)
            """, new { shiftId }, tx, cancellationToken: ct));
        foreach (var voucherId in pendingSettlements)
            await BookingSettlementRepository.PostCoreAsync(connection, tx, voucherId, userId, ct);

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE shift_review_items
            SET status = 'reviewed', reviewed_at = now(), reviewed_by = @userId
            WHERE shift_id = @shiftId AND status = 'pending'
            """, new { shiftId, userId }, tx, cancellationToken: ct));

        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE cashier_shifts
            SET review_status = 'reviewed', reviewed_at = now(), reviewed_by = @userId,
                updated_by = @userId
            WHERE id = @shiftId
            """, new { shiftId, userId }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (await GetShiftAsync(shiftId, ct))!;
    }
}
