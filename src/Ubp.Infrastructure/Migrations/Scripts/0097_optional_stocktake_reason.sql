-- 0097 — جعل ملاحظات/سبب فرق الجرد اختياريًا
-- --------------------------------------------------
-- لم يعد اعتماد الجرد يشترط إدخال سبب لكل فرق؛ تبقى الملاحظات محفوظة إن أُدخلت،
-- لكنها لا تمنع الحفظ أو الترحيل.

DROP TRIGGER IF EXISTS trg_stocktake_reason_guard ON stocktake_lines;
DROP FUNCTION IF EXISTS fn_stocktake_reason_guard();
