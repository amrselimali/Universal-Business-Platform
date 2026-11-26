-- تشخيص «ترحيل الشفت» مقابل ميزان المراجعة/الأستاذ (يتطلب Migration 0220).
-- الاستخدام:  psql -h 127.0.0.1 -U postgres -d ubp -f scripts/diag-shift-posting.sql

\echo '=== 1) الشفتات: الحالة + حالة المراجعة + عدد القيود المسودة/المرحّلة ==='
SELECT s.code AS shift_code, s.status, s.review_status,
       s.opened_at, s.closed_at,
       count(e.id) FILTER (WHERE e.status = 'draft')  AS draft_entries,
       count(e.id) FILTER (WHERE e.status = 'posted') AS posted_entries,
       coalesce(sum(e.total_debit) FILTER (WHERE e.status = 'draft'), 0) AS draft_debit
FROM cashier_shifts s
LEFT JOIN journal_entries e ON e.shift_id = s.id
GROUP BY s.id, s.code, s.status, s.review_status, s.opened_at, s.closed_at
ORDER BY s.opened_at DESC
LIMIT 20;

\echo '=== 2) كل القيود المسودة (لا تظهر في الميزان/الأستاذ قبل «اعتماد المراجعة») ==='
SELECT e.entry_no, e.entry_date, e.source_type, e.reference,
       coalesce(e.description, '') AS description, e.total_debit, e.status
FROM journal_entries e
WHERE e.status = 'draft'
ORDER BY e.entry_date DESC, e.created_at DESC
LIMIT 50;

\echo '=== 3) فروق بين القيود المرحّلة والأرصدة الشهرية لكل حساب/فرع/شهر ==='
\echo '(أي صف هنا = قيد «مرحّل» لم يدخل gl_balances، أو تجميع قديم يحتاج إعادة بناء)'
WITH lines AS (
    SELECT l.branch_id, date_trunc('month', l.entry_date)::date AS period_month,
           l.account_id, sum(l.debit) AS debit, sum(l.credit) AS credit
    FROM journal_entry_lines l
    JOIN journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
    GROUP BY 1, 2, 3
), bal AS (
    SELECT b.branch_id, b.period_month, b.account_id,
           sum(b.debit) AS debit, sum(b.credit) AS credit
    FROM gl_balances b
    GROUP BY 1, 2, 3
)
SELECT coalesce(l.branch_id, b.branch_id) AS branch_id,
       coalesce(l.period_month, b.period_month) AS period_month,
       a.code, a.name_ar,
       coalesce(l.debit, 0)  AS lines_debit,  coalesce(b.debit, 0)  AS gl_debit,
       coalesce(l.credit, 0) AS lines_credit, coalesce(b.credit, 0) AS gl_credit,
       coalesce(l.debit, 0)  - coalesce(b.debit, 0)  AS debit_gap,
       coalesce(l.credit, 0) - coalesce(b.credit, 0) AS credit_gap
FROM lines l
FULL JOIN bal b
       ON b.branch_id = l.branch_id
      AND b.period_month = l.period_month
      AND b.account_id = l.account_id
JOIN accounts a ON a.id = coalesce(l.account_id, b.account_id)
WHERE coalesce(l.debit, 0) <> coalesce(b.debit, 0)
   OR coalesce(l.credit, 0) <> coalesce(b.credit, 0)
ORDER BY 2 DESC, a.code;
