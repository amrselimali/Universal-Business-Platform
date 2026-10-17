/**
 * القواعد الافتراضية لمحرك الترحيل — مولَّدة من بذور SQL
 * ---------------------------------------------------------------------------
 * مصدر التوافق: `scripts/neon_posting_rules_seed.sql`. تُستخدم لتهيئة منشأة
 * جديدة من داخل الشاشة (زر «تهيئة القواعد الافتراضية») بدل تنفيذ SQL يدوياً.
 * يوجد اختبار يضمن تطابق القائمتين ومنع انحرافهما.
 */

export interface DefaultPostingRule {
  transactionType: string;
  fieldKey: string;
  selectorKey: string;
  direction: 'debit' | 'credit';
  accountCode: string;
}

export const DEFAULT_POSTING_RULES: DefaultPostingRule[] = [
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'bank', direction: 'debit', accountCode: '1112' },
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'default', direction: 'debit', accountCode: '1111' },
  { transactionType: 'pos_sale', fieldKey: 'receivable_amount', selectorKey: 'default', direction: 'debit', accountCode: '1120' },
  { transactionType: 'pos_sale', fieldKey: 'revenue_amount', selectorKey: 'default', direction: 'credit', accountCode: '4100' },
  { transactionType: 'pos_sale', fieldKey: 'service_revenue_amount', selectorKey: 'default', direction: 'credit', accountCode: '4200' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'bank', direction: 'debit', accountCode: '1112' },
  { transactionType: 'session', fieldKey: 'service_revenue_amount', selectorKey: 'default', direction: 'credit', accountCode: '4200' },
  { transactionType: 'expense', fieldKey: 'expense_amount', selectorKey: 'default', direction: 'debit', accountCode: '5200' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'bank', direction: 'credit', accountCode: '1112' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'bank', direction: 'debit', accountCode: '1112' },
  { transactionType: 'customer_collection', fieldKey: 'receivable_settlement', selectorKey: 'default', direction: 'credit', accountCode: '1120' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'bank', direction: 'debit', accountCode: '1112' },
  { transactionType: 'cash_receipt', fieldKey: 'receivable_settlement', selectorKey: 'default', direction: 'credit', accountCode: '1120' },
  { transactionType: 'cash_payment', fieldKey: 'expense_amount', selectorKey: 'default', direction: 'debit', accountCode: '5200' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'bank', direction: 'credit', accountCode: '1112' },
  { transactionType: 'supplier_payment', fieldKey: 'payable_settlement', selectorKey: 'default', direction: 'debit', accountCode: '2100' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'bank', direction: 'credit', accountCode: '1112' },
  { transactionType: 'purchase_receipt', fieldKey: 'inventory_amount', selectorKey: 'default', direction: 'debit', accountCode: '1130' },
  { transactionType: 'purchase_receipt', fieldKey: 'payable_amount', selectorKey: 'default', direction: 'credit', accountCode: '2100' },
  { transactionType: 'goods_issue', fieldKey: 'cogs_amount', selectorKey: 'default', direction: 'debit', accountCode: '5100' },
  { transactionType: 'goods_issue', fieldKey: 'inventory_amount', selectorKey: 'default', direction: 'credit', accountCode: '1130' },
  { transactionType: 'payroll', fieldKey: 'salary_expense', selectorKey: 'default', direction: 'debit', accountCode: '5300' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'bank', direction: 'credit', accountCode: '1112' },
  { transactionType: 'inventory_adjustment', fieldKey: 'shortage_expense', selectorKey: 'default', direction: 'debit', accountCode: '5200' },
  { transactionType: 'inventory_adjustment', fieldKey: 'inventory_amount', selectorKey: 'default', direction: 'credit', accountCode: '1130' },
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'pmt:cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'pmt:wallet', direction: 'debit', accountCode: '1111' },
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'pmt:card', direction: 'debit', accountCode: '1112' },
  { transactionType: 'pos_sale', fieldKey: 'collected_amount', selectorKey: 'pmt:transfer', direction: 'debit', accountCode: '1112' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'pmt:cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'pmt:wallet', direction: 'debit', accountCode: '1111' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'pmt:card', direction: 'debit', accountCode: '1112' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'pmt:transfer', direction: 'debit', accountCode: '1112' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'pmt:cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'pmt:wallet', direction: 'credit', accountCode: '1111' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'pmt:card', direction: 'credit', accountCode: '1112' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'pmt:transfer', direction: 'credit', accountCode: '1112' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'pmt:cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'pmt:wallet', direction: 'debit', accountCode: '1111' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'pmt:card', direction: 'debit', accountCode: '1112' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'pmt:transfer', direction: 'debit', accountCode: '1112' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'pmt:cash', direction: 'debit', accountCode: '1111' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'pmt:wallet', direction: 'debit', accountCode: '1111' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'pmt:card', direction: 'debit', accountCode: '1112' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'pmt:transfer', direction: 'debit', accountCode: '1112' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:wallet', direction: 'credit', accountCode: '1111' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:card', direction: 'credit', accountCode: '1112' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:transfer', direction: 'credit', accountCode: '1112' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:wallet', direction: 'credit', accountCode: '1111' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:card', direction: 'credit', accountCode: '1112' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'pmt:transfer', direction: 'credit', accountCode: '1112' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'pmt:cash', direction: 'credit', accountCode: '1111' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'pmt:wallet', direction: 'credit', accountCode: '1111' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'pmt:card', direction: 'credit', accountCode: '1112' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'pmt:transfer', direction: 'credit', accountCode: '1112' },
  { transactionType: 'session', fieldKey: 'collected_amount', selectorKey: 'default', direction: 'debit', accountCode: '1111' },
  { transactionType: 'expense', fieldKey: 'paid_amount', selectorKey: 'default', direction: 'credit', accountCode: '1111' },
  { transactionType: 'customer_collection', fieldKey: 'collected_amount', selectorKey: 'default', direction: 'debit', accountCode: '1111' },
  { transactionType: 'cash_receipt', fieldKey: 'amount', selectorKey: 'default', direction: 'debit', accountCode: '1111' },
  { transactionType: 'cash_payment', fieldKey: 'paid_amount', selectorKey: 'default', direction: 'credit', accountCode: '1111' },
  { transactionType: 'supplier_payment', fieldKey: 'paid_amount', selectorKey: 'default', direction: 'credit', accountCode: '1111' },
  { transactionType: 'payroll', fieldKey: 'net_paid', selectorKey: 'default', direction: 'credit', accountCode: '1111' },
];
