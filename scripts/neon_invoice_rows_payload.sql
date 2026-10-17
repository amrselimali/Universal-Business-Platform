-- =========================================================================
-- إرجاع حمولة الفاتورة الكاملة من القائمة (لرسم نفس أعمدة شاشة الفواتير)
-- =========================================================================
-- الجدول يعرض: العميل/الكاشير/الأصناف/طريقة الدفع/الشيفت/الحالة/المبالغ.
-- لذلك تُرجع fn_invoice_list حقل payload لكل صف:
--   • للفواتير المحفوظة: s.payload كما هو.
--   • لإيرادات الورديات المشتقة: payload مُصنَّع من صف الوردية بنفس الشكل.
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
         NULL::text AS run_row_id,
         s.payload AS payload
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
         (r.value->>'id')::text AS run_row_id,
         jsonb_build_object(
           'id', 'inv-ops-' || (r.value->>'id'),
           'tenantId', sh.tenant_id,
           'branchId', sh.branch_id,
           'invoiceNumber', 'INV-OPS-' || upper(right(r.value->>'id', 6)),
           'customerId', COALESCE(r.value->>'customerId', r.value->>'patientId', ''),
           'customerName', COALESCE(NULLIF(r.value->>'customerName', ''), NULLIF(r.value->>'patientName', ''), 'عميل تشغيل نقدي'),
           'cashierName', COALESCE(NULLIF(r.value->>'doctorName', ''), NULLIF(sh.payload->>'receptionistName', ''), 'الاستقبال'),
           'paymentMethod', COALESCE(NULLIF(r.value->>'paymentMethod', ''), 'نقداً (كاش)'),
           'notes', COALESCE(r.value->>'notes', r.value->>'description'),
           'source', 'reception_ops',
           'sourceShiftId', sh.id,
           'sourceShiftNumber', sh.shift_number,
           'sourceRunRowId', r.value->>'id',
           'status', CASE WHEN COALESCE(r.value->>'serviceName', '') LIKE '%(ملغي)%' THEN 'Cancelled' ELSE 'Posted' END,
           'createdAt', COALESCE(NULLIF(r.value->>'date', '')::timestamptz, sh.updated_at),
           'netAmount', COALESCE((r.value->>'totalRevenue')::numeric, 0),
           'taxAmount', 0,
           'subtotal', COALESCE((r.value->>'totalRevenue')::numeric, 0),
           'discountAmount', 0,
           'items', jsonb_build_array(jsonb_build_object(
              'productId', 'srv-reception',
              'productNameAr', COALESCE(r.value->>'serviceName', 'خدمة تشغيل'),
              'productNameEn', COALESCE(r.value->>'serviceName', 'Reception service'),
              'quantity', COALESCE((r.value->>'consumedQuantity')::numeric, 1),
              'unitPrice', COALESCE((r.value->>'unitPrice')::numeric, COALESCE((r.value->>'totalRevenue')::numeric, 0)),
              'discount', 0,
              'tax', 0,
              'lineTotal', COALESCE((r.value->>'totalRevenue')::numeric, 0)))
         ) AS payload
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

-- القائمة تُرجع payload لكل صف (نفس توقيع الدالة السابق + عمود الحمولة)
CREATE OR REPLACE FUNCTION fn_invoice_list(
  p_tenant text, p_search text DEFAULT NULL, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_status text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_after_date date DEFAULT NULL, p_after_id text DEFAULT NULL, p_source text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_items jsonb;
  v_last jsonb;
BEGIN
  WITH page AS (
    SELECT id, invoice_number, invoice_date, status, customer_name, net_amount, tax_amount,
           created_at, source, payload
      FROM v_revenue_invoices
     WHERE tenant_id = p_tenant
       AND (p_from IS NULL OR invoice_date >= p_from)
       AND (p_to IS NULL OR invoice_date <= p_to)
       AND (p_status IS NULL OR status = p_status)
       AND (p_source IS NULL OR p_source = '' OR source = p_source)
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
