-- =========================================================================
-- ترسيب إيرادات الورديات كفواتير حقيقية (Materialize shift revenue)
-- =========================================================================
-- المشكلة: `v_revenue_invoices` كانت تشتقّ إيرادات الورديات وقت الاستعلام بـ
-- jsonb_array_elements على runRows — بلا فهرس على التاريخ، ومع NOT EXISTS
-- LIKE '%…%'، وفرز فوق UNION ALL. على مقياس كبير يصبح هذا هو عنق الزجاجة.
--
-- الحل: عند **إقفال** الوردية تُكتب صفوفها كفواتير فعلية في `sales_invoices`
-- (مع source_run_row_id). وبما أن منطق الاستبعاد في الـ View يعتمد على وجود
-- فاتورة محفوظة بنفس `sourceRunRowId` (أو آخر 6 أحرف)، فإن الصفوف المرسّبة
-- تُستثنى تلقائياً من الجزء المشتق — بلا أي تعديل على الـ View.
--
-- متكرر بأمان: ON CONFLICT DO NOTHING + الاستبعادات نفسها الموجودة في الواجهة.
-- =========================================================================

-- 1) مفتاح الربط بالمصدر + عمود الإصدار (If-Match) -------------------------
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS source_run_row_id VARCHAR(200);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_source_run_row
  ON sales_invoices (tenant_id, source_run_row_id)
  WHERE source_run_row_id IS NOT NULL;

-- فهرس trigram على رقم الفاتورة (البحث كان OR على عمودين بلا فهرس للرقم)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_number_trgm
  ON sales_invoices USING gin ((invoice_number) gin_trgm_ops);

-- 2) ربط السطور بالفاتورة (FK) -------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_lines_invoice'
  ) THEN
    ALTER TABLE invoice_lines
      ADD CONSTRAINT fk_invoice_lines_invoice
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- بيانات قديمة يتيمة تُمنع الإضافة: نُبلّغ بلا إسقاط الترحيل
  RAISE NOTICE 'تعذّر إضافة FK invoice_lines→sales_invoices: %', SQLERRM;
END $$;


-- 3) دالة الترسيب: تُنقل صفوف الوردية إلى sales_invoices ------------------
CREATE OR REPLACE FUNCTION fn_materialize_shift_revenue(p_tenant text, p_shift_id text)
RETURNS integer AS $$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO sales_invoices
    (id, tenant_id, branch_id, invoice_number, net_amount, invoice_date, status,
     customer_id, customer_name, tax_amount, created_at, source_run_row_id, payload)
  SELECT
    'inv-ops-' || (r.value->>'id'),
    sh.tenant_id,
    sh.branch_id,
    'INV-OPS-' || upper(right(r.value->>'id', 6)),
    COALESCE((r.value->>'totalRevenue')::numeric, 0),
    COALESCE(NULLIF(r.value->>'date', '')::date, NULLIF(sh.shift_date, '')::date, CURRENT_DATE),
    CASE WHEN COALESCE(r.value->>'serviceName', '') LIKE '%(ملغي)%' THEN 'Cancelled' ELSE 'Posted' END,
    NULLIF(COALESCE(r.value->>'customerId', r.value->>'patientId'), ''),
    COALESCE(NULLIF(r.value->>'customerName', ''), NULLIF(r.value->>'patientName', ''), 'عميل تشغيل نقدي'),
    0,
    COALESCE(NULLIF(r.value->>'date', '')::timestamptz, sh.updated_at),
    (r.value->>'id')::text,
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
      'materialized', true,
      'items', jsonb_build_array(jsonb_build_object(
        'productId', 'srv-reception',
        'productNameAr', COALESCE(r.value->>'serviceName', 'خدمة تشغيل'),
        'productNameEn', COALESCE(r.value->>'serviceName', 'Reception service'),
        'quantity', COALESCE((r.value->>'consumedQuantity')::numeric, 1),
        'unitPrice', COALESCE((r.value->>'unitPrice')::numeric, COALESCE((r.value->>'totalRevenue')::numeric, 0)),
        'discount', 0, 'tax', 0,
        'lineTotal', COALESCE((r.value->>'totalRevenue')::numeric, 0)))
    )
  FROM reception_shifts sh
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sh.payload->'runRows', '[]'::jsonb)) AS r(value)
  WHERE sh.tenant_id = p_tenant
    AND sh.id = p_shift_id
    AND sh.deleted_at IS NULL
    AND COALESCE((r.value->>'totalRevenue')::numeric, 0) > 0
    AND COALESCE(r.value->>'description', '') NOT LIKE '%فاتورة نقطة بيع رقم INV-%'
    AND COALESCE(r.value->>'roomNumber', '') <> 'نقطة البيع (POS)'
    AND COALESCE(r.value->>'description', '') NOT LIKE '%فاتورة ضريبية رسمية رقم INV-%'
    AND COALESCE(r.value->>'roomNumber', '') <> 'فاتورة ضريبية رسمية'
    AND COALESCE(r.value->>'serviceName', '') NOT LIKE '%تسوية%'
    AND COALESCE(r.value->>'serviceName', '') NOT LIKE '%فرق تعديل%'
    AND COALESCE(r.value->>'description', '') NOT LIKE '%فرق تعديل%'
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- سطور الفاتورة المرسّبة (لتكامل invoice_lines)
  INSERT INTO invoice_lines
    (tenant_id, invoice_id, line_no, product_id, product_name, quantity, unit_price, discount, tax, line_total)
  SELECT sh.tenant_id, 'inv-ops-' || (r.value->>'id'), 1,
         'srv-reception', COALESCE(r.value->>'serviceName', 'خدمة تشغيل'),
         COALESCE((r.value->>'consumedQuantity')::numeric, 1),
         COALESCE((r.value->>'unitPrice')::numeric, COALESCE((r.value->>'totalRevenue')::numeric, 0)),
         0, 0, COALESCE((r.value->>'totalRevenue')::numeric, 0)
    FROM reception_shifts sh
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sh.payload->'runRows', '[]'::jsonb)) AS r(value)
   WHERE sh.tenant_id = p_tenant AND sh.id = p_shift_id AND sh.deleted_at IS NULL
     AND COALESCE((r.value->>'totalRevenue')::numeric, 0) > 0
  ON CONFLICT (tenant_id, invoice_id, line_no) DO NOTHING;

  RETURN v_count;
END; $$ LANGUAGE plpgsql;


-- 4) Trigger: الترسيب عند إقفال الوردية (تلقائي داخل الداتابيز) --------------
CREATE OR REPLACE FUNCTION fn_trg_materialize_shift_revenue()
RETURNS TRIGGER AS $$
BEGIN
  -- يُرسَّب الإيراد عند الانتقال إلى الحالة المغلقة (أو عند تحديث صفوف وردية مغلقة)
  IF COALESCE(NEW.status, '') = 'Closed'
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.payload IS DISTINCT FROM NEW.payload) THEN
    PERFORM fn_materialize_shift_revenue(NEW.tenant_id, NEW.id);
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_materialize_shift_revenue ON reception_shifts;
CREATE TRIGGER trg_materialize_shift_revenue
  AFTER INSERT OR UPDATE ON reception_shifts
  FOR EACH ROW EXECUTE FUNCTION fn_trg_materialize_shift_revenue();

-- 5) تعبئة الورديات المُقفلة السابقة (مرة واحدة، متكرر بأمان) ----------------
DO $$
DECLARE v_shift RECORD;
BEGIN
  FOR v_shift IN
    SELECT id, tenant_id FROM reception_shifts
     WHERE deleted_at IS NULL AND COALESCE(status, '') = 'Closed'
     LIMIT 500
  LOOP
    PERFORM fn_materialize_shift_revenue(v_shift.tenant_id, v_shift.id);
  END LOOP;
END $$;

-- 6) الإصدار في التعديل (If-Match): يعتمد على عمود version -------------------
DROP FUNCTION IF EXISTS fn_invoice_update(text,text,numeric,text,text,text);
CREATE OR REPLACE FUNCTION fn_invoice_update(
  p_tenant text, p_invoice_id text, p_net_amount numeric,
  p_payment_method text, p_reason text, p_actor text,
  p_expected_version integer DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE v_new_version integer;
BEGIN
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'سبب التعديل مطلوب';
  END IF;

  UPDATE sales_invoices
     SET net_amount = p_net_amount,
         version = version + 1,
         payload = jsonb_set(
           jsonb_set(
             jsonb_set(COALESCE(payload, '{}'::jsonb), '{netAmount}', to_jsonb(p_net_amount), true),
             '{paymentMethod}', to_jsonb(COALESCE(p_payment_method, payload->>'paymentMethod')), true),
           '{lastEditReason}', to_jsonb(p_reason), true),
         updated_at = NOW(),
         updated_by = COALESCE(p_actor, 'ui')
   WHERE tenant_id = p_tenant AND id = p_invoice_id AND deleted_at IS NULL
     AND (p_expected_version IS NULL OR version = p_expected_version)
   RETURNING version INTO v_new_version;

  IF v_new_version IS NULL THEN
    -- إما غير موجودة، وإما تعديلها شخص آخر (تعارض إصدار)
    IF EXISTS (SELECT 1 FROM sales_invoices WHERE tenant_id = p_tenant AND id = p_invoice_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'تعارض إصدار: الفاتورة عُدّلت من مستخدم آخر — أعد تحميلها';
    END IF;
    RAISE EXCEPTION 'الفاتورة غير موجودة: %', p_invoice_id;
  END IF;

  RETURN jsonb_build_object('invoiceId', p_invoice_id, 'version', v_new_version);
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_materialize_shift_revenue(text,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_invoice_update(text,text,numeric,text,text,text,integer) TO app_api';
  END IF;
END $$;
