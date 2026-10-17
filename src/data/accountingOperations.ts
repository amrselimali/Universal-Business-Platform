/**
 * كتالوج العمليات المحاسبية والخلايا الرقمية (Operations & Amount Cells)
 * ---------------------------------------------------------------------------
 * قائمة **كل عملية في النظام وكل خلية رقمية داخلها يمكن أن تولّد سطراً في
 * القيد**. الشاشة تعرض الكتالوج كاملاً، ويظهر أي حقل بلا قاعدة «غير مربوط»
 * حتى لا يبقى في النظام رقم لا نعرف إلى أي حساب يذهب.
 *
 *   • `required = true`  : بدون قاعدة فعّالة ⇒ الترحيل مرفوض (Default-Deny).
 *   • `required = false` : إن لم توجد قاعدة له يُتجاهل (اختياري).
 *   • `selector`         : محور تفرّع القاعدة (نوع طريقة الدفع مثلاً).
 */

export type FieldSelector = 'payment_method';

export interface OperationField {
  key: string;
  labelAr: string;
  labelEn: string;
  required: boolean;
  selector?: FieldSelector;
  hintAr?: string;
  hintEn?: string;
}

export interface OperationDef {
  type: string;
  labelAr: string;
  labelEn: string;
  screenAr: string;
  screenEn: string;
  fields: OperationField[];
}

/** أنواع طرق الدفع كما هي في نموذج التطبيق. */
export const PAYMENT_METHOD_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: 'نقدي', en: 'Cash' },
  card: { ar: 'بطاقة', en: 'Card' },
  transfer: { ar: 'تحويل بنكي', en: 'Transfer' },
  wallet: { ar: 'محفظة إلكترونية', en: 'Wallet' },
  credit: { ar: 'آجل', en: 'Credit' },
  custom: { ar: 'مخصص', en: 'Custom' },
};

/** طريقة دفع مبسطة كما تأتي من سياق التطبيق. */
export interface PaymentMethodRef {
  id: string;
  nameAr: string;
  code?: string;
  type?: string;
}

/**
 * سلسلة اختيار القاعدة بالترتيب (أول مطابقة تفوز):
 *   1) الطريقة نفسها  = pm:<id>
 *   2) نوع الطريقة     = pmt:<type>   (cash/card/transfer/wallet/credit/custom)
 *   3) مجموعة قديمة    = cash | bank  (توافق مع البذور السابقة)
 *   4) الافتراضي       = default
 */
export const paymentSelectorChain = (method?: PaymentMethodRef | null): string[] => {
  const chain: string[] = [];
  if (method?.id) chain.push(`pm:${method.id}`);
  const type = (method?.type ?? '').toLowerCase();
  if (type) chain.push(`pmt:${type}`);
  if (type === 'cash') chain.push('cash');
  if (['card', 'transfer', 'wallet', 'credit'].includes(type)) chain.push('bank');
  chain.push('default');
  return [...new Set(chain)];
};

/**
 * مفاتيح القاعدة المعروضة في الشاشة لخلية مرتبطة بطريقة الدفع:
 * الافتراضي + المجموعتان + أنواع الطرق الموجودة فعلاً + كل طريقة بمفردها.
 */
/** يحوّل اختيار المستخدم في الواجهة إلى سلسلة أولوية فعلية. */
export const selectorChainForValue = (value: string, methods: PaymentMethodRef[]): string[] => {
  if (value.startsWith('pm:')) {
    const id = value.slice(3);
    const method = methods.find((m) => m.id === id) ?? { id, nameAr: '', type: '' };
    return paymentSelectorChain(method);
  }
  if (value === 'cash' || value === 'bank') return [value, 'default'];
  return ['default'];
};

export const paymentSelectorOptions = (
  methods: PaymentMethodRef[]
): { key: string; labelAr: string; labelEn: string }[] => {
  const types = [...new Set(methods.map((m) => (m.type ?? '').toLowerCase()).filter(Boolean))];
  return [
    { key: 'default', labelAr: 'افتراضي (أي طريقة)', labelEn: 'Default (any method)' },
    { key: 'cash', labelAr: 'أي طريقة نقدية (مجموعة)', labelEn: 'Any cash (group)' },
    { key: 'bank', labelAr: 'أي بطاقة/تحويل (مجموعة)', labelEn: 'Any card/transfer (group)' },
    ...types.map((type) => ({
      key: `pmt:${type}`,
      labelAr: `أي ${PAYMENT_METHOD_TYPE_LABELS[type]?.ar ?? type}`,
      labelEn: `Any ${PAYMENT_METHOD_TYPE_LABELS[type]?.en ?? type}`,
    })),
    ...methods.map((method) => ({
      key: `pm:${method.id}`,
      labelAr: `${method.nameAr} (هذه الطريقة فقط)`,
      labelEn: `${method.nameAr} (this method only)`,
    })),
  ];
};

const payment: Pick<OperationField, 'selector'> = { selector: 'payment_method' };

export const ACCOUNTING_OPERATIONS: OperationDef[] = [
  {
    type: 'pos_sale',
    labelAr: 'مبيعات الكاشير (POS)',
    labelEn: 'POS sale',
    screenAr: 'نقطة البيع السريعة',
    screenEn: 'POS terminal',
    fields: [
      { key: 'collected_amount', labelAr: 'المبلغ المحصَّل', labelEn: 'Collected amount', required: true, ...payment,
        hintAr: 'مدين: خزينة أو بنك حسب طريقة الدفع', hintEn: 'Debit: cash or bank by payment method' },
      { key: 'receivable_amount', labelAr: 'المتبقي الآجل على العميل', labelEn: 'Receivable remainder', required: true,
        hintAr: 'مدين: ذمم العملاء', hintEn: 'Debit: accounts receivable' },
      { key: 'revenue_amount', labelAr: 'إيراد المبيعات', labelEn: 'Sales revenue', required: true,
        hintAr: 'دائن: إيراد بضاعة', hintEn: 'Credit: goods revenue' },
      { key: 'service_revenue_amount', labelAr: 'إيراد الخدمات', labelEn: 'Service revenue', required: false },
      { key: 'discount_amount', labelAr: 'الخصم الممنوح', labelEn: 'Discount granted', required: false },
      { key: 'tax_amount', labelAr: 'ضريبة القيمة المضافة', labelEn: 'VAT amount', required: false },
      { key: 'cogs_amount', labelAr: 'تكلفة البضاعة المباعة', labelEn: 'Cost of goods sold', required: false },
    ],
  },
  {
    type: 'session',
    labelAr: 'كشف تشغيل يومي (وردية)',
    labelEn: 'Daily session',
    screenAr: 'شاشة التشغيل',
    screenEn: 'Operations run-sheet',
    fields: [
      { key: 'collected_amount', labelAr: 'المحصَّل في الوردية', labelEn: 'Collected in shift', required: true, ...payment },
      { key: 'service_revenue_amount', labelAr: 'إيراد الخدمات', labelEn: 'Service revenue', required: true },
      { key: 'expense_amount', labelAr: 'مصروفات الوردية', labelEn: 'Shift expenses', required: false },
    ],
  },
  {
    type: 'expense',
    labelAr: 'مصروف / سند صرف',
    labelEn: 'Expense voucher',
    screenAr: 'المصروفات / الوردية',
    screenEn: 'Expenses / shift',
    fields: [
      { key: 'expense_amount', labelAr: 'قيمة المصروف', labelEn: 'Expense amount', required: true },
      { key: 'paid_amount', labelAr: 'المدفوع فعلياً', labelEn: 'Actually paid', required: true, ...payment },
      { key: 'tax_amount', labelAr: 'ضريبة المصروف', labelEn: 'Expense VAT', required: false },
    ],
  },
  {
    type: 'customer_collection',
    labelAr: 'تحصيل من عميل',
    labelEn: 'Customer collection',
    screenAr: 'إيصالات التحصيل',
    screenEn: 'Collection receipts',
    fields: [
      { key: 'collected_amount', labelAr: 'المبلغ المحصَّل', labelEn: 'Collected amount', required: true, ...payment },
      { key: 'receivable_settlement', labelAr: 'تسوية ذمة العميل', labelEn: 'Receivable settlement', required: true },
      { key: 'discount_allowed', labelAr: 'خصم مسموح به', labelEn: 'Discount allowed', required: false },
    ],
  },
  {
    type: 'cash_receipt',
    labelAr: 'سند قبض نقدي',
    labelEn: 'Cash receipt voucher',
    screenAr: 'سندات القبض',
    screenEn: 'Cash receipts',
    fields: [
      { key: 'amount', labelAr: 'مبلغ السند', labelEn: 'Voucher amount', required: true, ...payment },
      { key: 'receivable_settlement', labelAr: 'تسوية الذمة', labelEn: 'Receivable settlement', required: true },
    ],
  },
  {
    type: 'cash_payment',
    labelAr: 'سند صرف نقدي',
    labelEn: 'Cash payment voucher',
    screenAr: 'سندات الصرف',
    screenEn: 'Cash payments',
    fields: [
      { key: 'expense_amount', labelAr: 'قيمة المصروف', labelEn: 'Expense amount', required: true },
      { key: 'paid_amount', labelAr: 'المبلغ المصروف', labelEn: 'Paid amount', required: true, ...payment },
    ],
  },
  {
    type: 'supplier_payment',
    labelAr: 'سداد مورد',
    labelEn: 'Supplier payment',
    screenAr: 'الموردون والمشتريات',
    screenEn: 'Suppliers / purchasing',
    fields: [
      { key: 'payable_settlement', labelAr: 'تسوية مديونية المورد', labelEn: 'Payable settlement', required: true },
      { key: 'paid_amount', labelAr: 'المبلغ المسدَّد', labelEn: 'Paid amount', required: true, ...payment },
    ],
  },
  {
    type: 'purchase_receipt',
    labelAr: 'استلام بضاعة من مورد',
    labelEn: 'Purchase receipt',
    screenAr: 'إذن استلام',
    screenEn: 'Goods receipt',
    fields: [
      { key: 'inventory_amount', labelAr: 'قيمة المخزون المستلم', labelEn: 'Inventory received', required: true },
      { key: 'payable_amount', labelAr: 'المستحق للمورد', labelEn: 'Payable to supplier', required: true },
      { key: 'tax_amount', labelAr: 'ضريبة الشراء', labelEn: 'Purchase VAT', required: false },
    ],
  },
  {
    type: 'goods_issue',
    labelAr: 'صرف مخزني',
    labelEn: 'Goods issue',
    screenAr: 'إذن صرف',
    screenEn: 'Goods issue',
    fields: [
      { key: 'cogs_amount', labelAr: 'تكلفة البضاعة المصروفة', labelEn: 'COGS issued', required: true },
      { key: 'inventory_amount', labelAr: 'تخفيض المخزون', labelEn: 'Inventory reduction', required: true },
    ],
  },
  {
    type: 'payroll',
    labelAr: 'مسير رواتب',
    labelEn: 'Payroll',
    screenAr: 'مسير الرواتب',
    screenEn: 'Payroll run',
    fields: [
      { key: 'salary_expense', labelAr: 'مصروف الرواتب', labelEn: 'Salary expense', required: true },
      { key: 'net_paid', labelAr: 'الصافي المدفوع', labelEn: 'Net paid', required: true, ...payment },
      { key: 'deductions', labelAr: 'الاستقطاعات', labelEn: 'Deductions', required: false },
    ],
  },
  {
    type: 'inventory_adjustment',
    labelAr: 'تسوية جرد مخزني',
    labelEn: 'Inventory adjustment',
    screenAr: 'إدارة المخزون',
    screenEn: 'Inventory management',
    fields: [
      { key: 'shortage_expense', labelAr: 'عجز الجرد (مصروف)', labelEn: 'Inventory shortage', required: true },
      { key: 'inventory_amount', labelAr: 'تسوية حساب المخزون', labelEn: 'Inventory adjustment', required: true },
    ],
  },
  {
    type: 'asset_depreciation',
    labelAr: 'إهلاك أصل ثابت',
    labelEn: 'Asset depreciation',
    screenAr: 'الأصول الثابتة',
    screenEn: 'Fixed assets',
    fields: [
      { key: 'depreciation_expense', labelAr: 'مصروف الإهلاك', labelEn: 'Depreciation expense', required: true },
      { key: 'accumulated_depreciation', labelAr: 'مجمع الإهلاك', labelEn: 'Accumulated depreciation', required: true },
    ],
  },
];

/** كل الحقول الإلزامية (تُستخدم في فحص التغطية وفي الاختبارات). */
export const REQUIRED_FIELDS: { type: string; field: string; labelAr: string }[] =
  ACCOUNTING_OPERATIONS.flatMap((op) =>
    op.fields
      .filter((field) => field.required)
      .map((field) => ({
        type: op.type,
        field: field.key,
        labelAr: `${op.labelAr} ← ${field.labelAr}`,
      }))
  );

export const findOperation = (type: string): OperationDef | undefined =>
  ACCOUNTING_OPERATIONS.find((op) => op.type === type);

/** فحص تغطية: أي حقل إلزامي بلا قاعدة فعّالة = فجوة تُعرض وتُفشل الترحيل. */
export interface CoverageGapRow {
  type: string;
  labelAr: string;
  field: string;
  fieldLabelAr: string;
}

export const computeCoverage = (
  rules: { transactionType: string; fieldKey: string; isActive: boolean }[]
): { total: number; covered: number; gaps: CoverageGapRow[] } => {
  const active = new Set(
    rules.filter((rule) => rule.isActive).map((rule) => `${rule.transactionType}|${rule.fieldKey}`)
  );
  const gaps: CoverageGapRow[] = [];

  for (const op of ACCOUNTING_OPERATIONS) {
    for (const field of op.fields) {
      if (!field.required) continue;
      if (active.has(`${op.type}|${field.key}`)) continue;
      gaps.push({
        type: op.type,
        labelAr: op.labelAr,
        field: field.key,
        fieldLabelAr: field.labelAr,
      });
    }
  }

  const total = REQUIRED_FIELDS.length;
  return { total, covered: total - gaps.length, gaps };
};
