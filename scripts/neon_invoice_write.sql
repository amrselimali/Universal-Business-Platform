-- =========================================================================
-- كتابة الفواتير في قاعدة البيانات (تعديل/إلغاء) — لإزالة الاعتماد على المصفوفة
-- =========================================================================
-- يُستخدم من شاشة الفواتير بعد نقل القراءة للسيرفر، حتى تصبح الكتابة على DB فقط.
-- متكرر بأمان.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_invoice_update(
  p_tenant text, p_invoice_id text, p_net_amount numeric,
  p_payment_method text, p_reason text, p_actor text
) RETURNS jsonb AS $$
DECLARE v_new_version integer;
BEGIN
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'سبب التعديل مطلوب';
  END IF;

  UPDATE sales_invoices
     SET net_amount = p_net_amount,
         payload = jsonb_set(
           jsonb_set(
             jsonb_set(COALESCE(payload, '{}'::jsonb), '{netAmount}', to_jsonb(p_net_amount), true),
             '{paymentMethod}', to_jsonb(COALESCE(p_payment_method, payload->>'paymentMethod')), true),
           '{lastEditReason}', to_jsonb(p_reason), true),
         updated_at = NOW(),
         updated_by = COALESCE(p_actor, 'ui')
   WHERE tenant_id = p_tenant AND id = p_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة: %', p_invoice_id;
  END IF;

  SELECT COALESCE((payload->>'version')::integer, 1) + 1 INTO v_new_version
    FROM sales_invoices WHERE tenant_id = p_tenant AND id = p_invoice_id;

  RETURN jsonb_build_object('invoiceId', p_invoice_id, 'version', v_new_version);
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_invoice_cancel(
  p_tenant text, p_invoice_id text, p_reason text, p_actor text
) RETURNS jsonb AS $$
BEGIN
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'سبب الإلغاء مطلوب';
  END IF;

  UPDATE sales_invoices
     SET status = 'Cancelled',
         payload = jsonb_set(
           jsonb_set(COALESCE(payload, '{}'::jsonb), '{status}', to_jsonb('Cancelled'::text), true),
           '{cancelReason}', to_jsonb(p_reason), true),
         updated_at = NOW(),
         updated_by = COALESCE(p_actor, 'ui')
   WHERE tenant_id = p_tenant AND id = p_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة: %', p_invoice_id;
  END IF;

  RETURN jsonb_build_object('invoiceId', p_invoice_id, 'status', 'Cancelled');
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_invoice_update(text,text,numeric,text,text,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_invoice_cancel(text,text,text,text) TO app_api';
  END IF;
END $$;
