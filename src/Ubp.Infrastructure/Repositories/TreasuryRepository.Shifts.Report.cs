using Dapper;
using Ubp.Core.Models;
using Ubp.Core.Results;

namespace Ubp.Infrastructure.Repositories;

public sealed partial class TreasuryRepository
{
    /// <summary>
    /// تقرير الشفت (0077): جدول واحد للتحصيلات والإيرادات مرتب بالعميل، عدّ نقدية كل خزينة
    /// (بالمتوقع الحالي للشفت المفتوحة)، حركة عدادات الأجهزة، والملاحظات — ثم عملاء بلا
    /// متابعة وحجوزات/مواعيد الغد في نهاية التقرير.
    /// </summary>
    public async Task<ShiftReport> GetShiftReportAsync(Guid shiftId, CancellationToken ct = default)
    {
        var shift = await GetShiftAsync(shiftId, ct) ?? throw new NotFoundAppException();
        await using var connection = await _factory.OpenAsync(ct);
        var args = new
        {
            shiftId, branchId = shift.BranchId, openedAt = shift.OpenedAt, until = shift.ClosedAt,
            // يوم الشفت: تُربط به ملاحظات التقرير (عملاء بلا متابعة/حجوزات الغد/مواعيد الغد)
            // بدلًا من تاريخ فتح التقرير، فلا تتغير ملاحظات الشفتات المقفولة — 0220.
            shiftDate = shift.OpenedAt.Date
        };

        var report = new ShiftReport { Shift = shift, Notes = shift.Notes };

        report.Lines = (await connection.QueryAsync<ShiftCollectionRow>(new CommandDefinition("""
            WITH receipts AS (
                -- إيصال تسوية حساب العميل لا يُعرض هنا؛ يُجمَّع في سطر التسوية الواحد لكل عميل أدناه.
                SELECT v.party_name AS CustomerName, t.treasury_type AS TreasuryType,
                       t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                       v.total_amount AS Collected,
                       0::numeric AS Revenue, 0::numeric AS Quantity, 0::numeric AS MeterUnits,
                       NULL::text AS EmployeeName,
                       (SELECT string_agg(i.name_ar || ' × ' ||
                                   trim(to_char(bl.quantity, 'FM999999990.##')), ' • ')
                        FROM booking_payments bp
                        JOIN booking_lines bl ON bl.booking_id = bp.booking_id
                        JOIN items i ON i.id = bl.item_id
                        WHERE bp.voucher_id = v.id) AS ItemName,
                       0::numeric AS UnitPrice,
                       CASE WHEN v.is_shift_settlement THEN 'تسوية دكتور خارجى'::varchar
                            WHEN v.receipt_type = 'ADVANCE' THEN 'دفعة مقدمة'::varchar
                            ELSE 'تحصيل/قبض'::varchar END AS Source,
                       NULL::text AS ComplaintEmployeeName
                FROM vouchers v
                JOIN treasuries t ON t.id = v.treasury_id
                WHERE v.branch_id = @branchId AND v.voucher_type = 'receipt'
                  AND v.status <> 'cancelled' AND v.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR v.created_at <= @until::timestamptz)
                  AND NOT EXISTS (SELECT 1 FROM customer_account_settlements bs
                                  WHERE bs.voucher_id = v.id)
            ), revenues AS (
                SELECT COALESCE(c.name_ar, d.party_name) AS CustomerName, NULL::varchar AS TreasuryType,
                       NULL::varchar AS TreasuryCode, NULL::varchar AS TreasuryName,
                       0::numeric AS Collected,
                       d.total AS Revenue, 0::numeric AS Quantity, 0::numeric AS MeterUnits,
                       NULL::text AS EmployeeName, NULL::text AS ItemName, 0::numeric AS UnitPrice,
                       'فاتورة بيع'::varchar AS Source, NULL::text AS ComplaintEmployeeName
                FROM commercial_documents d
                LEFT JOIN customers c ON c.id = d.customer_id
                WHERE d.branch_id = @branchId AND d.doc_type = 'sales_invoice'
                  AND d.status <> 'cancelled' AND d.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR d.created_at <= @until::timestamptz)
            ), executions AS (
                SELECT c.name_ar AS CustomerName, NULL::varchar AS TreasuryType,
                       NULL::varchar AS TreasuryCode, NULL::varchar AS TreasuryName,
                       0::numeric AS Collected,
                       -- إيراد التنفيذ المحفوظ على السطر (سالب للعكس)، والهدية بلا إيراد.
                       CASE WHEN bl.operation_type = 'gift' THEN 0::numeric
                            ELSE el.net_amount END AS Revenue,
                       el.quantity AS Quantity, el.meter_units AS MeterUnits,
                       exe.name_ar AS EmployeeName, i.name_ar AS ItemName,
                       el.unit_price AS UnitPrice,
                       CASE WHEN bl.operation_type = 'treatment' THEN 'خدمة علاجية'
                            WHEN bl.operation_type = 'gift' THEN 'جلسة هدية'
                            ELSE 'تنفيذ خدمة محجوزة' END AS Source,
                       CASE WHEN bl.operation_type = 'treatment' THEN cause.name_ar END
                           AS ComplaintEmployeeName
                FROM booking_executions be
                JOIN booking_execution_lines el ON el.execution_id = be.id
                JOIN booking_lines bl ON bl.id = el.booking_line_id
                JOIN items i ON i.id = el.item_id
                JOIN bookings b ON b.id = be.booking_id
                JOIN customers c ON c.id = b.customer_id
                -- منفّذ الجلسة: الموظف المختار من نافذة تنفيذ الخدمة (el.employee_id) فقط.
                LEFT JOIN employees exe ON exe.id = el.employee_id
                -- متسبب الشكوى: الموظف المسجّل على بند الحجز عند تسجيل الخدمة العلاجية.
                LEFT JOIN employees cause ON cause.id = bl.employee_id
                WHERE be.branch_id = @branchId AND be.status IN ('draft', 'posted')
                  AND be.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR be.created_at <= @until::timestamptz)
            ), transfers AS (
                -- المحوَّل منه: كمية وقيمة بالسالب (خصم) في سطر مستقل.
                SELECT fc.name_ar AS CustomerName, NULL::varchar AS TreasuryType,
                       NULL::varchar AS TreasuryCode, NULL::varchar AS TreasuryName,
                       0::numeric AS Collected, (-stl.amount) AS Revenue,
                       (-stl.quantity) AS Quantity, 0::numeric AS MeterUnits,
                       NULL::text AS EmployeeName, i.name_ar AS ItemName,
                       stl.unit_price AS UnitPrice, 'خدمات محولة'::varchar AS Source,
                       NULL::text AS ComplaintEmployeeName
                FROM service_transfers st
                JOIN service_transfer_lines stl ON stl.transfer_id = st.id
                JOIN items i ON i.id = stl.item_id
                JOIN customers fc ON fc.id = st.from_customer_id
                WHERE st.branch_id = @branchId AND st.status IN ('draft', 'posted')
                  AND st.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR st.created_at <= @until::timestamptz)
                UNION ALL
                -- المحوَّل إليه: كمية وقيمة بالموجب (إضافة) في سطر مستقل — الصافي = صفر.
                SELECT tc.name_ar, NULL::varchar, NULL::varchar, NULL::varchar, 0::numeric, stl.amount,
                       stl.quantity, 0::numeric, NULL::text, i.name_ar, stl.unit_price,
                       'خدمات محولة'::varchar, NULL::text
                FROM service_transfers st
                JOIN service_transfer_lines stl ON stl.transfer_id = st.id
                JOIN items i ON i.id = stl.item_id
                JOIN customers tc ON tc.id = st.to_customer_id
                WHERE st.branch_id = @branchId AND st.status IN ('draft', 'posted')
                  AND st.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR st.created_at <= @until::timestamptz)
            ), settlement_cash AS (
                -- كل تسويات العميل في الشفت: صافي المبلغ (استرداد سالب/تحصيل موجب) مع خزينتها.
                SELECT s.customer_id,
                       ROUND(SUM(CASE WHEN cl.direction = 'collect' THEN cl.amount
                                      WHEN cl.direction = 'refund' THEN -cl.amount
                                      WHEN v.id IS NOT NULL THEN -v.total_amount
                                      ELSE 0 END), 2) AS collected,
                       MAX(t.treasury_type) AS treasury_type,
                       MAX(t.code) AS treasury_code, MAX(t.name_ar) AS treasury_name
                FROM customer_account_settlements s
                LEFT JOIN customer_account_settlement_cash_lines cl ON cl.settlement_id = s.id
                LEFT JOIN vouchers v ON v.id = s.voucher_id
                LEFT JOIN treasuries t ON t.id = s.treasury_id
                WHERE s.branch_id = @branchId AND s.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR s.created_at <= @until::timestamptz)
                GROUP BY s.customer_id
            ), settlement_totals AS (
                -- صافي الإيراد (فروق أسعار التسوية) ومجموع الكميات المسوّاة لكل عميل.
                SELECT s.customer_id,
                       COALESCE(SUM(l.settled_qty), 0) AS quantity,
                       ROUND(COALESCE(SUM(l.revenue_adjustment), 0), 2) AS revenue
                FROM customer_account_settlements s
                LEFT JOIN customer_account_settlement_lines l ON l.settlement_id = s.id
                WHERE s.branch_id = @branchId AND s.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR s.created_at <= @until::timestamptz)
                GROUP BY s.customer_id
            ), settlement_items AS (
                -- الخدمات المسوّاة مجمّعة لكل عميل مرة واحدة: «الصنف × مجموع الكمية».
                SELECT g.customer_id, string_agg(g.label, ' • ' ORDER BY g.label) AS item_name
                FROM (
                    SELECT s.customer_id,
                           i.name_ar || ' × ' ||
                           trim(to_char(SUM(l.settled_qty), 'FM999999990.##')) AS label
                    FROM customer_account_settlements s
                    JOIN customer_account_settlement_lines l ON l.settlement_id = s.id
                    JOIN items i ON i.id = l.item_id
                    WHERE s.branch_id = @branchId AND s.created_at >= @openedAt
                      AND (@until::timestamptz IS NULL OR s.created_at <= @until::timestamptz)
                    GROUP BY s.customer_id, i.id, i.name_ar
                ) g
                GROUP BY g.customer_id
            ), settlements AS (
                -- تسوية حساب العميل في سطر واحد لكل عميل: تُجمع حركات كل عمود ويظهر الصافي.
                SELECT c.name_ar AS CustomerName, cash.treasury_type AS TreasuryType,
                       cash.treasury_code AS TreasuryCode, cash.treasury_name AS TreasuryName,
                       cash.collected AS Collected, COALESCE(tot.revenue, 0) AS Revenue,
                       COALESCE(tot.quantity, 0) AS Quantity, 0::numeric AS MeterUnits,
                       NULL::text AS EmployeeName, items.item_name AS ItemName,
                       0::numeric AS UnitPrice, 'تسوية حساب عميل'::varchar AS Source,
                       NULL::text AS ComplaintEmployeeName
                FROM settlement_cash cash
                JOIN customers c ON c.id = cash.customer_id
                LEFT JOIN settlement_totals tot ON tot.customer_id = cash.customer_id
                LEFT JOIN settlement_items items ON items.customer_id = cash.customer_id
            ), doctor_refunds AS (
                -- تسوية دكتور خارجي سالبة: تُعرض كتحصيل سالب حتى يتساوى الإيراد والتحصيل.
                SELECT v.party_name AS CustomerName, t.treasury_type AS TreasuryType,
                       t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                       (-v.total_amount) AS Collected, 0::numeric AS Revenue,
                       0::numeric AS Quantity, 0::numeric AS MeterUnits,
                       NULL::text AS EmployeeName, NULL::text AS ItemName,
                       0::numeric AS UnitPrice, 'تسوية دكتور خارجى'::varchar AS Source,
                       NULL::text AS ComplaintEmployeeName
                FROM vouchers v
                JOIN treasuries t ON t.id = v.treasury_id
                WHERE v.branch_id = @branchId AND v.voucher_type = 'payment'
                  AND v.is_shift_settlement AND v.status <> 'cancelled'
                  AND v.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR v.created_at <= @until::timestamptz)
            )
            SELECT * FROM receipts
            UNION ALL SELECT * FROM revenues
            UNION ALL SELECT * FROM executions
            UNION ALL SELECT * FROM transfers
            UNION ALL SELECT * FROM settlements
            UNION ALL SELECT * FROM doctor_refunds
            ORDER BY CustomerName
            """, args, cancellationToken: ct))).ToList();

        // ضمان ظهور كل خزائن الفرع المتابَعة حتى للشفتات المفتوحة قبل الترحيل 0076.
        await connection.ExecuteAsync(new CommandDefinition("""
            INSERT INTO shift_cash_counts (id, shift_id, treasury_id, opening_cash, expected_cash, status)
            SELECT gen_random_uuid(), @shiftId, t.id,
                   COALESCE(prev.closing, gl.balance, 0),
                   COALESCE(prev.closing, gl.balance, 0),
                   CASE WHEN @isOpen THEN 'open' ELSE 'draft' END
            FROM treasuries t
            LEFT JOIN LATERAL (
                SELECT c2.counted_cash AS closing
                FROM shift_cash_counts c2
                JOIN cashier_shifts s2 ON s2.id = c2.shift_id
                WHERE c2.treasury_id = t.id AND s2.status = 'closed'
                  AND c2.counted_cash IS NOT NULL
                  AND s2.closed_at < @openedAt
                  AND (NOT t.is_company_wide OR s2.branch_id = @branchId)
                ORDER BY s2.closed_at DESC NULLS LAST
                LIMIT 1
            ) prev ON true
            LEFT JOIN LATERAL (
                SELECT COALESCE((SELECT SUM(l.debit - l.credit)
                                 FROM journal_entry_lines l
                                 JOIN journal_entries e ON e.id = l.entry_id
                                                        AND e.branch_id = CASE
                                                            WHEN t.is_company_wide THEN @branchId
                                                            ELSE t.branch_id END
                                 WHERE e.status = 'posted' AND e.created_at < @openedAt AND l.account_id = t.account_id), 0)
                       AS balance
            ) gl ON true
            WHERE (t.is_company_wide OR t.branch_id = @branchId) AND t.is_active
            ON CONFLICT (shift_id, treasury_id) DO NOTHING
            """, new { shiftId, branchId = shift.BranchId, isOpen = shift.IsOpen,
                openedAt = shift.OpenedAt },
            cancellationToken: ct));

        // تصحيح «أول المدة» لكل شفت: الرصيد المرحّل بالحسابات وقت الفتح
        // (= الرصيد الآن − الحركات المرحّلة منذ الفتح) + إيصالات (مسودات) الشفتات غير المرحّلة.
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE shift_cash_counts c
            SET opening_cash = x.opening
            FROM (
                SELECT t.id AS treasury_id,
                       COALESCE(prev.closing, gl.balance, 0) AS opening
                FROM treasuries t
                LEFT JOIN LATERAL (
                    SELECT c2.counted_cash AS closing
                    FROM shift_cash_counts c2
                    JOIN cashier_shifts s2 ON s2.id = c2.shift_id
                    WHERE c2.treasury_id = t.id AND s2.status = 'closed'
                      AND c2.counted_cash IS NOT NULL
                      AND s2.closed_at < @openedAt
                      AND (NOT t.is_company_wide OR s2.branch_id = @branchId)
                    ORDER BY s2.closed_at DESC NULLS LAST
                    LIMIT 1
                ) prev ON true
                LEFT JOIN LATERAL (
                    SELECT COALESCE((SELECT SUM(l.debit - l.credit)
                                     FROM journal_entry_lines l
                                     JOIN journal_entries e ON e.id = l.entry_id
                                                            AND e.branch_id = CASE
                                                                WHEN t.is_company_wide THEN @branchId
                                                                ELSE t.branch_id END
                                     WHERE e.status = 'posted' AND e.created_at < @openedAt AND l.account_id = t.account_id), 0)
                           AS balance
                ) gl ON true
                WHERE (t.is_company_wide OR t.branch_id = @branchId) AND t.is_active
            ) x
            WHERE c.shift_id = @shiftId AND c.treasury_id = x.treasury_id
            """, new { shiftId, branchId = shift.BranchId, openedAt = shift.OpenedAt },
            cancellationToken: ct));

        report.CashCounts = (await QueryCashCountsAsync(connection, shiftId, null, ct)).ToList();
        decimal expectedTotal = 0;
        foreach (var count in report.CashCounts)
        {
            // «حركة اليوم» هي نفس صافي الحركة المستخدم في «النقد المتوقع» (بعد كل تعديلات
            // الشفت الإيصالات/المصروفات/السلف/التسليمات)، فيتحقق دائمًا:
            // النقد المتوقع = أول المدة + حركة اليوم — للشفت المفتوحة والمغلقة.
            var movement = await TreasuryMovementAsync(connection, null, count.TreasuryId,
                shift.BranchId, shiftId, shift.OpenedAt, shift.ClosedAt, ct,
                includeDraftExpenses: true);
            count.Movement = Math.Round(movement, 2, MidpointRounding.AwayFromZero);
            count.ExpectedCash = Math.Round(count.OpeningCash + movement, 2,
                MidpointRounding.AwayFromZero);
            count.Variance = count.CountedCash is { } counted
                ? Math.Round(counted - count.ExpectedCash, 2, MidpointRounding.AwayFromZero)
                : null;
            expectedTotal += count.ExpectedCash;

            // تُحفظ القيم المحسوبة للشفت المفتوحة حتى يُبنى أي عدّ/فرق لاحق على المتوقع
            // الحالي؛ الشفت المغلقة سجل تاريخي يُعاد حساب عرضه فقط.
            if (!shift.IsOpen) continue;
            await connection.ExecuteAsync(new CommandDefinition("""
                UPDATE shift_cash_counts SET expected_cash = @expected, variance = @variance
                WHERE id = @id
                """, new { expected = count.ExpectedCash, variance = count.Variance,
                    id = count.Id }, cancellationToken: ct));
        }
        shift.ExpectedCash = Math.Round(expectedTotal, 2, MidpointRounding.AwayFromZero);

        report.Meters = (await connection.QueryAsync<ShiftMeterMovementRow>(new CommandDefinition("""
            SELECT fa.id AS AssetId, fa.code AS Code, fa.name_ar AS NameAr,
                   -- أول المدة = القراءة الفعلية المسجَّلة في آخر شفت سابق (أياً كانت حالته)،
                   -- وليس القراءة المسجَّلة داخل الشفت الحالي — 0095.
                   COALESCE((SELECT r.value FROM asset_meter_readings r
                             WHERE r.asset_id = fa.id AND r.created_at < @openedAt
                             ORDER BY r.created_at DESC, r.value DESC LIMIT 1), 0) AS Opening,
                   COALESCE(cons.consumed, 0) AS Consumed,
                   COALESCE((SELECT r.value FROM asset_meter_readings r
                             WHERE r.asset_id = fa.id AND r.created_at < @openedAt
                             ORDER BY r.created_at DESC, r.value DESC LIMIT 1), 0)
                       + COALESCE(cons.consumed, 0) AS Closing,
                   fa.current_meter_value AS Actual
            FROM fixed_assets fa
            LEFT JOIN LATERAL (
                SELECT SUM(el.meter_units) AS consumed
                FROM booking_execution_lines el
                JOIN booking_executions be ON be.id = el.execution_id
                WHERE el.metered_asset_id = fa.id AND be.status IN ('draft', 'posted')
                  AND be.created_at >= @openedAt
                  AND (@until::timestamptz IS NULL OR be.created_at <= @until::timestamptz)
            ) cons ON true
            WHERE fa.branch_id = @branchId AND fa.status <> 'DISPOSED'
              AND (fa.is_metered OR EXISTS (SELECT 1 FROM asset_meter_readings r
                                            WHERE r.asset_id = fa.id))
            ORDER BY fa.code
            """, args, cancellationToken: ct))).ToList();

        report.Expenses = (await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   el.amount AS Amount, i.name_ar AS ItemName, el.quantity AS Quantity,
                   el.unit_price AS UnitPrice, COALESCE(el.description, o.notes) AS Description,
                   o.status AS Status
            FROM operating_expenses o
            JOIN operating_expense_lines el ON el.expense_id = o.id
            LEFT JOIN treasuries t ON t.id = o.treasury_id
            LEFT JOIN items i ON i.id = el.item_id
            WHERE o.branch_id = @branchId AND o.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR o.created_at <= @until::timestamptz)
            ORDER BY o.doc_date, o.doc_no, el.line_no
            """, args, cancellationToken: ct))).ToList();

        // مرتجعات المشتريات: تُطرح من مصروفات الشفت (قيمة سالبة) وتظهر مسودة/مرحّلة.
        report.Expenses.AddRange(await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   -prl.amount AS Amount, i.name_ar AS ItemName, prl.quantity AS Quantity,
                   prl.unit_price AS UnitPrice,
                   ('مرتجع مشتريات ' || COALESCE(pr.doc_no, '')) AS Description,
                   pr.status AS Status
            FROM purchase_returns pr
            JOIN purchase_return_lines prl ON prl.return_id = pr.id
            LEFT JOIN treasuries t ON t.id = pr.treasury_id
            LEFT JOIN items i ON i.id = prl.item_id
            WHERE pr.branch_id = @branchId AND pr.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR pr.created_at <= @until::timestamptz)
            ORDER BY pr.doc_date, pr.doc_no, prl.line_no
            """, args, cancellationToken: ct)));

        // تسليمات النقدية للحساب الوسيط تظهر كمصروف في الشفت (0080).
        report.Expenses.AddRange(await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   h.amount AS Amount, NULL::text AS ItemName, 0::numeric AS Quantity,
                   0::numeric AS UnitPrice,
                   COALESCE(h.notes, 'تسليم نقدية إلى ' || a.name_ar) AS Description,
                   'POSTED'::varchar AS Status
            FROM cash_handovers h
            JOIN treasuries t ON t.id = h.treasury_id
            JOIN accounts a ON a.id = h.clearing_account_id
            WHERE h.branch_id = @branchId AND h.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR h.created_at <= @until::timestamptz)
            ORDER BY h.created_at
            """, args, cancellationToken: ct)));

        // عمولتا التحصيل لخزينة واحدة في سطر واحد: المحمَّلة على العميل (تُضاف) مع المحمَّلة
        // من مزود الخدمة (تُخصم) — صافي الأثر يُحسب ديناميكيًا من السندات، ولا يظهر سطر عند صفر.
        report.Expenses.AddRange(await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   ROUND(SUM(v.provider_fee_total) - SUM(v.fee_total), 2) AS Amount,
                   NULL::text AS ItemName, 0::numeric AS Quantity, 0::numeric AS UnitPrice,
                   'عمولة التحصيل (عمولة العميل + عمولة مزود الخدمة)' AS Description,
                   'POSTED'::varchar AS Status
            FROM vouchers v
            JOIN treasuries t ON t.id = v.treasury_id
            WHERE v.branch_id = @branchId AND v.voucher_type = 'receipt'
              AND v.status <> 'cancelled'
              AND NOT v.is_shift_settlement
              AND NOT EXISTS (SELECT 1 FROM customer_account_settlements bs WHERE bs.voucher_id = v.id)
              AND v.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR v.created_at <= @until::timestamptz)
            GROUP BY t.id, t.treasury_type, t.name_ar
            HAVING ROUND(SUM(v.provider_fee_total) - SUM(v.fee_total), 2) <> 0
            ORDER BY t.name_ar
            """, args, cancellationToken: ct)));

        // عمولة تسليم النقدية (0082): مصروف إضافي في الشفت.
        report.Expenses.AddRange(await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   h.commission_amount AS Amount, NULL::text AS ItemName, 0::numeric AS Quantity,
                   0::numeric AS UnitPrice, 'عمولة تسليم نقدية' AS Description,
                   'POSTED'::varchar AS Status
            FROM cash_handovers h
            JOIN treasuries t ON t.id = h.treasury_id
            WHERE h.branch_id = @branchId AND h.commission_amount > 0
              AND h.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR h.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        // سلف الموظفين المصروفة خلال الشفت تظهر كمصروف (0084).
        report.Expenses.AddRange(await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   a.amount AS Amount, NULL::text AS ItemName, 0::numeric AS Quantity,
                   0::numeric AS UnitPrice, 'سلفة موظف ' || e.name_ar AS Description,
                   'POSTED'::varchar AS Status
            FROM employee_advances a
            JOIN treasuries t ON t.id = a.treasury_id
            JOIN employees e ON e.id = a.employee_id
            WHERE a.branch_id = @branchId AND a.created_at >= @openedAt
              AND (@until::timestamptz IS NULL OR a.created_at <= @until::timestamptz)
            """, args, cancellationToken: ct)));

        // عملاء بلا متابعة أو حجز مستقبلي: يُعرض العدد فقط (بلا بيان تفصيلي) — 0094.
        // عملاء بلا متابعة أو حجز مستقبلي — مربوطة بيوم الشفت نفسه لا بتاريخ فتح التقرير.
        report.IdleCustomersCount = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int
            FROM customers c
            WHERE c.is_active AND c.branch_id = @branchId
              AND NOT EXISTS (
                  SELECT 1 FROM bookings b
                  WHERE b.customer_id = c.id AND b.status NOT IN ('cancelled', 'reversed')
                    AND COALESCE(b.starts_at::date, b.booking_date) > @shiftDate::date)
              AND NOT EXISTS (
                  SELECT 1 FROM follow_ups f
                  WHERE f.customer_id = c.id AND f.status = 'pending'
                    AND f.due_at::date > @shiftDate::date)
            """, args, cancellationToken: ct));

        // حجوزات اليوم التالي للشفت = **حجوزات المواعيد** فقط (التي لها موعد starts_at)،
        // وليس حجوزات الخدمة التي بلا موعد — والتاريخ بتاريخ الموعد لا تاريخ المستند — 0094.
        report.TomorrowBookingsCount = await connection.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT count(*)::int
            FROM bookings b
            WHERE b.branch_id = @branchId
              AND b.starts_at IS NOT NULL
              AND b.starts_at::date = @shiftDate::date + 1
              AND b.status = 'confirmed'
            """, args, cancellationToken: ct));

        // حجوزات المواعيد غير المؤكدة في اليوم التالي (باستثناء الملغى والمنتهي) — 0095.
        report.TomorrowBookingsUnconfirmedCount = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition("""
            SELECT count(*)::int
            FROM bookings b
            WHERE b.branch_id = @branchId
              AND b.starts_at IS NOT NULL
              AND b.starts_at::date = @shiftDate::date + 1
              AND b.status NOT IN ('confirmed', 'cancelled', 'expired')
            """, args, cancellationToken: ct));

        report.TomorrowAppointments = (await connection.QueryAsync<ShiftAppointmentRow>(new CommandDefinition("""
            SELECT a.id AS Id, e.name_ar AS EmployeeName, c.name_ar AS CustomerName,
                   a.starts_at AS StartsAt, a.ends_at AS EndsAt, a.status AS Status
            FROM appointments a
            JOIN employees e ON e.id = a.employee_id
            LEFT JOIN customers c ON c.id = a.customer_id
            WHERE a.branch_id = @branchId AND a.starts_at::date = @shiftDate::date + 1
              AND a.status <> 'cancelled'
            ORDER BY a.starts_at
            """, args, cancellationToken: ct))).ToList();

        // تسوية حساب وسيط (بطاقة/محفظة/شيك): تظهر في جدول المصروفات بإشارة نقد الخزينة —
        // موجب = دخول نقد للخزينة (يُخصم من المصروفات)، سالب = خروج نقد (يضاف للمصروفات) — 0219.
        report.Expenses.AddRange(await connection.QueryAsync<ShiftExpenseRow>(new CommandDefinition("""
            SELECT t.treasury_type AS TreasuryType, t.code AS TreasuryCode, t.name_ar AS TreasuryName,
                   (-cs.amount) AS Amount, NULL::text AS ItemName, 0::numeric AS Quantity,
                   0::numeric AS UnitPrice,
                   ('تسوية حساب وسيط — ' || a.name_ar ||
                    COALESCE(' (' || cs.reference || ')', '')) AS Description,
                   CASE WHEN e.status = 'posted' THEN 'POSTED' ELSE 'DRAFT' END AS Status
            FROM treasury_clearing_settlements cs
            JOIN treasuries t ON t.id = cs.treasury_id
            JOIN accounts a ON a.id = cs.clearing_account_id
            LEFT JOIN journal_entries e ON e.id = cs.journal_entry_id
            WHERE cs.branch_id = @branchId
              AND (cs.shift_id = @shiftId
                   OR (cs.shift_id IS NULL AND cs.created_at >= @openedAt
                       AND (@until::timestamptz IS NULL
                            OR cs.created_at <= @until::timestamptz)))
            ORDER BY cs.created_at
            """, args, cancellationToken: ct)));

        return report;
    }

    /// <summary>حركة عدادات الأجهزة في الشفت (للجزء المستقل في شاشة الشفتات).</summary>
    public async Task<IReadOnlyList<ShiftMeterMovementRow>> ListShiftMetersAsync(Guid shiftId,
        CancellationToken ct = default)
    {
        var report = await GetShiftReportAsync(shiftId, ct);
        return report.Meters;
    }
}

