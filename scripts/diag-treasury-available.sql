-- تشخيص «لا يوجد رصيد للصرف من الخزينة»: تفكيك الرصيد المتاح بندًا بندًا + نقد الشفت المفتوح.
-- الاستخدام:
--   psql -h 127.0.0.1 -U postgres -d ubp -f scripts/diag-treasury-available.sql -v treasury= '<TREASURY_UUID>'
-- (بدون تمرير المعامل يطبع أول 5 خزائن نشطة مع أرقامها.)

\if :{?treasury}
\else
    \set treasury '00000000-0000-0000-0000-000000000000'
\endif

WITH p AS (SELECT :'treasury'::uuid AS id),
t AS (
    SELECT tr.* FROM treasuries tr CROSS JOIN p
    WHERE (p.id = '00000000-0000-0000-0000-000000000000'::uuid AND tr.is_active)
       OR tr.id = p.id
), op AS (
    SELECT s.id, s.code, s.branch_id, s.opened_at, s.opening_cash, s.carried_balance,
           s.status, s.review_status
    FROM cashier_shifts s
    WHERE s.branch_id = (SELECT branch_id FROM t LIMIT 1)
      AND s.status = 'open'
    ORDER BY s.opened_at DESC
    LIMIT 1
)
SELECT t.code AS treasury, t.name_ar, t.branch_id, t.is_company_wide,
       -- (١) الرصيد المرحّل على حساب الخزينة
       COALESCE((SELECT SUM(l.debit - l.credit)
                 FROM journal_entry_lines l
                 JOIN journal_entries e ON e.id = l.entry_id
                 WHERE e.status = 'posted' AND l.account_id = t.account_id
                   AND (t.is_company_wide OR e.branch_id = t.branch_id)), 0) AS posted_balance,
       -- (٢) صافي القيود المسودة (اليوم أو المرتبطة بشفت)
       COALESCE((SELECT SUM(l.debit - l.credit)
                 FROM journal_entry_lines l
                 JOIN journal_entries e ON e.id = l.entry_id
                 WHERE e.status = 'draft' AND l.account_id = t.account_id
                   AND (t.is_company_wide OR e.branch_id = t.branch_id)
                   AND (e.shift_id IS NOT NULL OR e.entry_date >= CURRENT_DATE)), 0) AS draft_entries,
       -- (٣) سندات بلا قيد (مسودة أو «مرحّلة بلا قيد»)
       COALESCE((SELECT SUM(CASE
                   WHEN v.voucher_type = 'receipt' THEN v.total_amount - v.provider_fee_total
                   WHEN v.voucher_type = 'payment' THEN -v.total_amount
                   WHEN v.voucher_type = 'transfer' AND v.treasury_id = t.id
                        THEN -(v.total_amount + v.fee_total)
                   WHEN v.voucher_type = 'transfer' AND v.to_treasury_id = t.id
                        THEN v.total_amount ELSE 0 END)
                 FROM vouchers v
                 WHERE v.journal_entry_id IS NULL AND v.status IN ('draft', 'posted')
                   AND (v.treasury_id = t.id OR v.to_treasury_id = t.id)), 0) AS vouchers_without_entry,
       -- (٤) مصروفات مسودة بلا قيد
       COALESCE((SELECT SUM(o.total_amount) FROM operating_expenses o
                 WHERE o.treasury_id = t.id AND o.status = 'DRAFT'), 0) AS draft_expenses,
       (SELECT opening_cash FROM op) AS shift_opening_cash,
       (SELECT code FROM op) AS open_shift_code,
       (SELECT review_status FROM op) AS open_shift_review
FROM t
ORDER BY t.code
LIMIT 5;

\echo '=== الشفت المفتوح: حركات الخزينة خلال الشفت (سندات/قيود) ==='
WITH op AS (
    SELECT s.id, s.branch_id, s.opened_at, s.closed_at
    FROM cashier_shifts s WHERE s.status = 'open'
    ORDER BY s.opened_at DESC LIMIT 1
)
SELECT v.voucher_type, v.status AS voucher_status, v.doc_no, v.doc_date,
       v.total_amount, v.journal_entry_id IS NOT NULL AS has_entry,
       e.status AS entry_status, t.name_ar AS treasury,
       (v.treasury_id = t.id) AS from_treasury, (v.to_treasury_id = t.id) AS to_treasury
FROM vouchers v
JOIN op ON true
JOIN treasuries t ON (t.id = v.treasury_id OR t.id = v.to_treasury_id)
LEFT JOIN journal_entries e ON e.id = v.journal_entry_id
WHERE v.branch_id = op.branch_id
  AND v.created_at >= op.opened_at
  AND (op.closed_at IS NULL OR v.created_at <= op.closed_at)
ORDER BY v.created_at DESC
LIMIT 50;

\echo '=== الشفت المفتوح: القيود المسودة على حساب أي خزينة خلال الشفت ==='
WITH op AS (
    SELECT s.id, s.branch_id, s.opened_at, s.closed_at
    FROM cashier_shifts s WHERE s.status = 'open'
    ORDER BY s.opened_at DESC LIMIT 1
)
SELECT e.id, e.entry_no, e.source_type, e.status, e.shift_id, e.entry_date,
       t.code AS treasury, a.code AS account_code, a.name_ar AS account_name,
       l.debit, l.credit
FROM journal_entry_lines l
JOIN journal_entries e ON e.id = l.entry_id
JOIN op ON true
JOIN treasuries t ON t.account_id = l.account_id
JOIN accounts a ON a.id = l.account_id
WHERE e.branch_id = op.branch_id
  AND l.entry_date >= op.opened_at::date
  AND e.status = 'draft'
ORDER BY l.entry_date DESC, l.line_no
LIMIT 100;
