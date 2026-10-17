-- =========================================================================
-- توحيد مصدر الفواتير في قاعدة البيانات (Persisted + Reception-ops derived)
-- =========================================================================
-- شاشة الفواتير تجمع حالياً مصدرين: فواتير sales_invoices المحفوظة، وإيرادات
-- مشتقة من صفوف الورديات (reception_shifts.payload.runRows). هذا الملف ينقل
-- القاعدة نفسها إلى الداتابيز في View واحد، ليكون للشاشة مصدر واحد (السيرفر).
--
-- نفس قواعد الاستثناء المطبّقة في الواجهة: استبعاد صفوف POS/الفاتورة الضريبية/
-- التسويات، واستبعاد ما له فاتورة محفوظة بالفعل (sourceRunRowId أو آخر 6 أحرف).
-- متكرر بأمان.
-- =========================================================================

CREATE OR REPLACE VIEW v_revenue_invoices AS
WITH persisted AS (
  SELECT s.id,
         s.tenant_id,
         s.branch_id,
         s.invoice_number,
         COALESCE(s.customer_id, s.payload->>'customerId') AS customer_id,
         COALESCE(s.customer_name, s.payload->>'customerName') AS customer_name,
         COALESCE(s.net_amount, 0)::numeric AS net_amount,
         COALESCE(s.tax_amount, 0)::numeric AS tax_amount,
         COALESCE(NULLIF(s.status, ''), 'Paid') AS status,
         COALESCE(s.invoice_date,
                  NULLIF(substr(COALESCE(s.payload->>'createdAt', ''), 1, 10), '')::date,
                  CURRENT_DATE) AS invoice_date,
         s.created_at,
         COALESCE(NULLIF(s.payload->>'source', ''),
                  CASE WHEN COALESCE(s.invoice_number, '') LIKE 'INV-TAX%' THEN 'manual_tax_invoice'
                       ELSE 'pos' END) AS source,
         NULL::text AS run_row_id
    FROM sales_invoices s
   WHERE s.deleted_at IS NULL
), derived AS (
  SELECT 'inv-ops-' || (r.value->>'id') AS id,
         sh.tenant_id,
         sh.branch_id,
         'INV-OPS-' || upper(right(r.value->>'id', 6)) AS invoice_number,
         NULLIF(COALESCE(r.value->>'customerId', r.value->>'patientId'), '') AS customer_id,
         COALESCE(NULLIF(r.value->>'customerName', ''), NULLIF(r.value->>'patientName', ''), 'عميل تشغيل نقدي') AS customer_name,
         COALESCE((r.value->>'totalRevenue')::numeric, 0)::numeric AS net_amount,
         0::numeric AS tax_amount,
         CASE WHEN COALESCE(r.value->>'serviceName', '') LIKE '%(ملغي)%' THEN 'Cancelled' ELSE 'Posted' END AS status,
         COALESCE(NULLIF(r.value->>'date', '')::date, NULLIF(sh.shift_date, '')::date, CURRENT_DATE) AS invoice_date,
         COALESCE(NULLIF(r.value->>'date', '')::timestamptz, sh.updated_at) AS created_at,
         'reception_ops'::text AS source,
         (r.value->>'id')::text AS run_row_id
    FROM reception_shifts sh
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sh.payload->'runRows', '[]'::jsonb)) AS r(value)
   WHERE sh.deleted_at IS NULL
     AND COALESCE((r.value->>'totalRevenue')::numeric, 0) > 0
     AND COALESCE(r.value->>'description', '') NOT LIKE '%فاتورة نقطة بيع رقم INV-%'
     AND COALESCE(r.value->>'roomNumber', '') <> 'نقطة البيع (POS)'
     AND COALESCE(r.value->>'description', '') NOT LIKE '%فاتورة ضريبية رسمية رقم INV-%'
     AND COALESCE(r.value->>'roomNumber', '') <> 'فاتورة ضريبية رسمية'
     AND COALESCE(r.value->>'serviceName', '') NOT LIKE '%تسوية%'
     AND COALESCE(r.value->>'serviceName', '') NOT LIKE '%فرق تعديل%'
     AND COALESCE(r.value->>'description', '') NOT LIKE '%فرق تعديل%'
)
SELECT * FROM persisted
UNION ALL
SELECT d.* FROM derived d
 WHERE NOT EXISTS (
   SELECT 1 FROM sales_invoices s
    WHERE s.tenant_id = d.tenant_id
      AND s.deleted_at IS NULL
      AND (s.payload->>'sourceRunRowId' = d.run_row_id
           OR (d.run_row_id IS NOT NULL AND COALESCE(s.invoice_number, '') LIKE '%' || right(d.run_row_id, 6) || '%'))
 );


-- الدوال تقرأ الآن من الـ View الموحّد (نفس أسماء الأعمدة) ------------------
CREATE OR REPLACE FUNCTION fn_invoice_list(
  p_tenant text, p_search text DEFAULT NULL, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_status text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_after_date date DEFAULT NULL, p_after_id text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_items jsonb;
  v_last jsonb;
BEGIN
  WITH page AS (
    SELECT id, invoice_number, invoice_date, status, customer_name, net_amount, tax_amount, created_at, source
      FROM v_revenue_invoices
     WHERE tenant_id = p_tenant
       AND (p_from IS NULL OR invoice_date >= p_from)
       AND (p_to IS NULL OR invoice_date <= p_to)
       AND (p_status IS NULL OR status = p_status)
       AND (p_search IS NULL OR p_search = '' OR
            invoice_number ILIKE '%' || p_search || '%' OR
            lower(customer_name) LIKE '%' || lower(p_search) || '%')
       AND (p_after_date IS NULL OR (invoice_date, id) < (p_after_date, p_after_id))
     ORDER BY invoice_date DESC, id DESC
     LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(page)), '[]'::jsonb),
         (SELECT to_jsonb(p2) FROM page p2 ORDER BY p2.invoice_date ASC, p2.id ASC LIMIT 1)
    INTO v_items, v_last
    FROM page;

  RETURN jsonb_build_object('items', v_items,
    'nextAfterDate', v_last->>'invoice_date',
    'nextAfterId', v_last->>'id',
    'limit', v_limit);
END; $$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_invoice_summary(
  p_tenant text, p_search text DEFAULT NULL, p_from date DEFAULT NULL,
  p_to date DEFAULT NULL, p_status text DEFAULT NULL
) RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'netTotal', COALESCE(SUM(net_amount), 0),
    'taxTotal', COALESCE(SUM(tax_amount), 0)
  )
    FROM v_revenue_invoices
   WHERE tenant_id = p_tenant
     AND (p_from IS NULL OR invoice_date >= p_from)
     AND (p_to IS NULL OR invoice_date <= p_to)
     AND (p_status IS NULL OR status = p_status)
     AND (p_search IS NULL OR p_search = '' OR
          invoice_number ILIKE '%' || p_search || '%' OR
          lower(customer_name) LIKE '%' || lower(p_search) || '%');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION fn_invoice_detail(p_tenant text, p_invoice_id text)
RETURNS jsonb AS $$
DECLARE v_header jsonb; v_lines jsonb;
BEGIN
  SELECT to_jsonb(h) INTO v_header
    FROM (SELECT id, invoice_number, invoice_date, status, customer_id, customer_name,
                 net_amount, tax_amount, created_at, source
            FROM v_revenue_invoices
           WHERE tenant_id = p_tenant AND id = p_invoice_id) h;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.line_no), '[]'::jsonb) INTO v_lines
    FROM invoice_lines l
   WHERE l.tenant_id = p_tenant AND l.invoice_id = p_invoice_id;

  RETURN jsonb_build_object('header', v_header, 'lines', v_lines);
END; $$ LANGUAGE plpgsql STABLE;
