-- =========================================================================
-- بذور قواعد الترحيل (Seeding) — تعكس **السلوك المحاسبي الحالي** حرفياً
-- =========================================================================
-- المبدأ: عند تشغيل هذا الملف أول مرة، يصبح النظام مُداراً بالقواعد بلا أي
-- تغيير في النتيجة المحاسبية. بعد ذلك، أي تعديل يجرى من شاشة «ربط العمليات
-- بالقيود» هو المصدر الوحيد — ولا يعود أي كود يقرأ حسابات من ملفات أخرى.
--
-- آمن للتشغيل المتكرر: ON CONFLICT DO NOTHING (لا يمس أي تعديل يدوي للمالك).
-- =========================================================================

INSERT INTO accounting_posting_rules (
  tenant_id, transaction_type, field_key, selector_key, direction,
  account_code, account_name, notes
)
SELECT 'tenant-eg-001', v.t_type, v.field, v.sel, v.dir, v.code,
       (SELECT a.name_ar FROM accounts a
         WHERE a.tenant_id = 'tenant-eg-001' AND a.code = v.code
           AND a.deleted_at IS NULL LIMIT 1),
       'قاعدة أساسية = السلوك المحاسبي المعتمد قبل تفعيل المصدر الوحيد'
  FROM (VALUES
    -- مبيعات الكاشير: نقدية/بنك مدين + ذمم مدين + إيراد دائن
    ('pos_sale', 'collected_amount',    'cash',    'debit',  '1111'),
    ('pos_sale', 'collected_amount',    'bank',    'debit',  '1112'),
    ('pos_sale', 'collected_amount',    'default', 'debit',  '1111'),
    ('pos_sale', 'receivable_amount',   'default', 'debit',  '1120'),
    ('pos_sale', 'revenue_amount',      'default', 'credit', '4100'),
    ('pos_sale', 'service_revenue_amount', 'default', 'credit', '4200'),
    -- كشف التشغيل اليومي (جلسات/خدمات)
    ('session', 'collected_amount',     'cash',    'debit',  '1111'),
    ('session', 'collected_amount',     'bank',    'debit',  '1112'),
    ('session', 'service_revenue_amount', 'default', 'credit', '4200'),
    -- المصروفات
    ('expense', 'expense_amount',       'default', 'debit',  '5200'),
    ('expense', 'paid_amount',          'cash',    'credit', '1111'),
    ('expense', 'paid_amount',          'bank',    'credit', '1112'),
    -- تحصيل من العملاء
    ('customer_collection', 'collected_amount',      'cash',    'debit',  '1111'),
    ('customer_collection', 'collected_amount',      'bank',    'debit',  '1112'),
    ('customer_collection', 'receivable_settlement', 'default', 'credit', '1120'),
    -- سندات القبض النقدية
    ('cash_receipt', 'amount',                'cash',    'debit',  '1111'),
    ('cash_receipt', 'amount',                'bank',    'debit',  '1112'),
    ('cash_receipt', 'receivable_settlement', 'default', 'credit', '1120'),
    -- سندات الصرف النقدية
    ('cash_payment', 'expense_amount', 'default', 'debit',  '5200'),
    ('cash_payment', 'paid_amount',    'cash',    'credit', '1111'),
    ('cash_payment', 'paid_amount',    'bank',    'credit', '1112'),
    -- سداد الموردين
    ('supplier_payment', 'payable_settlement', 'default', 'debit',  '2100'),
    ('supplier_payment', 'paid_amount',        'cash',    'credit', '1111'),
    ('supplier_payment', 'paid_amount',        'bank',    'credit', '1112'),
    -- استلام بضاعة من مورد
    ('purchase_receipt', 'inventory_amount', 'default', 'debit',  '1130'),
    ('purchase_receipt', 'payable_amount',   'default', 'credit', '2100'),
    -- صرف مخزني (تكلفة مبيعات)
    ('goods_issue', 'cogs_amount',      'default', 'debit',  '5100'),
    ('goods_issue', 'inventory_amount', 'default', 'credit', '1130'),
    -- مسير الرواتب
    ('payroll', 'salary_expense', 'default', 'debit',  '5300'),
    ('payroll', 'net_paid',       'cash',    'credit', '1111'),
    ('payroll', 'net_paid',       'bank',    'credit', '1112'),
    -- تسوية الجرد
    ('inventory_adjustment', 'shortage_expense', 'default', 'debit',  '5200'),
    ('inventory_adjustment', 'inventory_amount', 'default', 'credit', '1130')
  ) AS v(t_type, field, sel, dir, code)
 WHERE EXISTS (
   SELECT 1 FROM accounts a
    WHERE a.tenant_id = 'tenant-eg-001' AND a.code = v.code AND a.deleted_at IS NULL
 )
ON CONFLICT (tenant_id, transaction_type, field_key, selector_key) DO NOTHING;
