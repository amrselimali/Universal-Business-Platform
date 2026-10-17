-- =========================================================================
-- إضافة فلتر المصدر إلى دوال الفواتير (pos / reception_ops / manual_tax_invoice)
-- =========================================================================
-- الشاشة تفلتر بالمصدر؛ يجب أن يُنفَّذ الفلتر في SQL حتى تبقى العدادات صحيحة.
-- تغيير التوقيع يتطلب DROP ثم CREATE (لا يكفي CREATE OR REPLACE).
-- =========================================================================

DROP FUNCTION IF EXISTS fn_invoice_list(text, text, date, date, text, integer, date, text);
DROP FUNCTION IF EXISTS fn_invoice_summary(text, text, date, date, text);

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
    SELECT id, invoice_number, invoice_date, status, customer_name, net_amount, tax_amount, created_at, source
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

CREATE OR REPLACE FUNCTION fn_invoice_summary(
  p_tenant text, p_search text DEFAULT NULL, p_from date DEFAULT NULL,
  p_to date DEFAULT NULL, p_status text DEFAULT NULL, p_source text DEFAULT NULL
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
     AND (p_source IS NULL OR p_source = '' OR source = p_source)
     AND (p_search IS NULL OR p_search = '' OR
          invoice_number ILIKE '%' || p_search || '%' OR
          lower(customer_name) LIKE '%' || lower(p_search) || '%');
$$ LANGUAGE sql STABLE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_invoice_list(text,text,date,date,text,integer,date,text,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_invoice_summary(text,text,date,date,text,text) TO app_api';
  END IF;
END $$;
